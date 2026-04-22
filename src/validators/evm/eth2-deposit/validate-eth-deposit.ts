import { PublicKey, Signature, verify } from '@chainsafe/blst';
import { byteArrayEquals } from '@chainsafe/ssz';
import { getAddress, getBytes, Interface, Transaction } from 'ethers';
import {
  BLS_WITHDRAWAL_PREFIX,
  DOMAIN_DEPOSIT_TYPE,
  ETH1_ADDRESS_WITHDRAWAL_PREFIX,
  GWEI,
  MIN_DEPOSIT_GWEI_COUNT,
  DEPOSIT_FUNC,
} from './constants';
import type { EthDepositNetwork } from './networks';
import {
  isDepositContract,
  withdrawalCredentialsToEth1Address,
} from './networks';
import {
  computeDepositSigningRoot,
  computeDomain,
  hashDepositDataTreeRoot,
} from './ssz-roots';

const depositInterface = new Interface([DEPOSIT_FUNC]);
const depositSelector = getBytes(
  depositInterface.getFunction('deposit')!.selector,
);

export type EthDepositValidationFailedStage =
  | 'tx_shape'
  | 'abi'
  | 'semantics'
  | 'deposit_data_root'
  | 'bls'
  | 'withdrawal_mismatch';

export type EthDepositValidationResult =
  | { ok: true; stage: 'full' }
  | {
      ok: false;
      reason: string;
      stage: EthDepositValidationFailedStage;
    };

/**
 * Full static validation for a beacon `deposit` call (shape → ABI → semantics →
 * SSZ `DepositData` root → BLS proof-of-possession).
 *
 * @param userAddress Staker address; used to require `0x01` withdrawal credentials to point at this address.
 * @param requestChainId `ValidationRequest.chainId` — should match the tx and this network.
 */
export function validateEthBeaconDeposit(
  unsignedTransactionHex: string,
  userAddress: string,
  requestChainId: number | undefined,
  network: EthDepositNetwork,
): EthDepositValidationResult {
  if (!userAddress) {
    return { ok: false, reason: 'Missing user address', stage: 'tx_shape' };
  }
  const userAddr = getAddress(userAddress);
  // --- 1) Transaction shape
  let tx: Transaction;
  try {
    tx = Transaction.from(unsignedTransactionHex);
  } catch {
    return {
      ok: false,
      reason: 'Invalid unsigned EVM transaction bytes',
      stage: 'tx_shape',
    };
  }
  if (tx.to == null) {
    return {
      ok: false,
      reason: 'Transaction has no "to" (contract) address',
      stage: 'tx_shape',
    };
  }
  if (!isDepositContract(tx.to, network)) {
    return {
      ok: false,
      reason:
        'Transaction "to" is not the official beacon deposit contract for this network',
      stage: 'tx_shape',
    };
  }
  if (tx.chainId == null) {
    return {
      ok: false,
      reason: 'Transaction must include chainId (EIP-155)',
      stage: 'tx_shape',
    };
  }
  if (tx.chainId !== BigInt(network.chainId)) {
    return {
      ok: false,
      reason: 'Transaction chainId does not match network configuration',
      stage: 'tx_shape',
    };
  }
  if (requestChainId != null && requestChainId !== network.chainId) {
    return {
      ok: false,
      reason: 'Request chainId does not match this validator network',
      stage: 'tx_shape',
    };
  }
  if (requestChainId != null && requestChainId !== Number(tx.chainId)) {
    return {
      ok: false,
      reason: 'Request chainId does not match transaction chainId',
      stage: 'tx_shape',
    };
  }
  const { value } = tx;
  const dataBytes = new Uint8Array(getBytes(tx.data));
  if (value === 0n) {
    return {
      ok: false,
      reason: 'Deposit must send a non-zero ETH value',
      stage: 'tx_shape',
    };
  }
  if (value % GWEI !== 0n) {
    return {
      ok: false,
      reason:
        'Deposit value must be a multiple of 1 gwei (as required on-chain)',
      stage: 'tx_shape',
    };
  }
  const gwei = value / GWEI;
  if (gwei < MIN_DEPOSIT_GWEI_COUNT) {
    return {
      ok: false,
      reason: 'Deposit below minimum (1 ETH on the deposit contract)',
      stage: 'tx_shape',
    };
  }
  if (gwei > 0xffffffffffffffffn) {
    return {
      ok: false,
      reason: 'Deposit amount in gwei exceeds uint64',
      stage: 'tx_shape',
    };
  }
  if (dataBytes.length < 4) {
    return {
      ok: false,
      reason: 'Calldata too short for a function call',
      stage: 'tx_shape',
    };
  }
  if (!byteArrayEquals(dataBytes.subarray(0, 4), depositSelector)) {
    return {
      ok: false,
      reason: 'Calldata is not a call to deposit(bytes,bytes,bytes,bytes32)',
      stage: 'tx_shape',
    };
  }

  // --- 2) ABI decode
  let pubKey: Uint8Array;
  let withdrawalCredentials: Uint8Array;
  let signature: Uint8Array;
  let depositDataRoot: Uint8Array;
  try {
    const decoded = depositInterface.decodeFunctionData(
      'deposit',
      tx.data,
    ) as unknown as [
      string | Uint8Array,
      string | Uint8Array,
      string | Uint8Array,
      string,
    ];
    pubKey = toBytes(decoded[0]);
    withdrawalCredentials = toBytes(decoded[1]);
    signature = toBytes(decoded[2]);
    depositDataRoot = new Uint8Array(getBytes(decoded[3]));
  } catch {
    return {
      ok: false,
      reason: 'Calldata is not a valid deposit(bytes,bytes,bytes,bytes32) call',
      stage: 'abi',
    };
  }

  if (gwei > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      reason:
        'Deposit gwei is too large for this validator (Number-safe range)',
      stage: 'semantics',
    };
  }
  const amountGwei = Number(gwei);

  // --- 3) Semantic field checks
  if (pubKey.length !== 48) {
    return {
      ok: false,
      reason: 'BLS pubkey must be 48 bytes',
      stage: 'semantics',
    };
  }
  if (isAllZero(pubKey)) {
    return { ok: false, reason: 'BLS pubkey is all zero', stage: 'semantics' };
  }
  if (withdrawalCredentials.length !== 32) {
    return {
      ok: false,
      reason: 'Withdrawal credentials must be 32 bytes',
      stage: 'semantics',
    };
  }
  const prefix = withdrawalCredentials[0];
  if (prefix === ETH1_ADDRESS_WITHDRAWAL_PREFIX) {
    const addr = withdrawalCredentialsToEth1Address(withdrawalCredentials);
    if (addr == null) {
      return {
        ok: false,
        reason: 'Invalid 0x01 withdrawal credentials layout',
        stage: 'semantics',
      };
    }
    if (addr !== userAddr) {
      return {
        ok: false,
        reason:
          'Withdrawal credentials do not target the staker (user) address',
        stage: 'withdrawal_mismatch',
      };
    }
  } else if (prefix === BLS_WITHDRAWAL_PREFIX) {
    if (isAllZero(withdrawalCredentials)) {
      return {
        ok: false,
        reason: 'BLS withdrawal credentials (0x00) are all zero',
        stage: 'semantics',
      };
    }
  } else {
    return {
      ok: false,
      reason:
        'Unsupported withdrawal credentials prefix (expected 0x00 or 0x01)',
      stage: 'semantics',
    };
  }
  if (signature.length !== 96) {
    return {
      ok: false,
      reason: 'BLS signature must be 96 bytes',
      stage: 'semantics',
    };
  }
  if (depositDataRoot.length !== 32) {
    return {
      ok: false,
      reason: 'deposit_data_root must be 32 bytes',
      stage: 'semantics',
    };
  }

  // --- 4) deposit_data_root (SSZ; matches the deposit contract)
  let expectedRoot: Uint8Array;
  try {
    expectedRoot = hashDepositDataTreeRoot({
      pubkey: pubKey,
      withdrawalCredentials,
      amount: amountGwei,
      signature,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `SSZ hash failed: ${e instanceof Error ? e.message : String(e)}`,
      stage: 'deposit_data_root',
    };
  }
  if (!byteArrayEquals(expectedRoot, depositDataRoot)) {
    return {
      ok: false,
      reason:
        'deposit_data_root does not match SSZ root of (pubkey, withdrawal credentials, amount, signature)',
      stage: 'deposit_data_root',
    };
  }

  // --- 5) BLS proof of possession
  const domain = computeDomain(DOMAIN_DEPOSIT_TYPE, network.genesisForkVersion);
  let signingRoot: Uint8Array;
  try {
    signingRoot = computeDepositSigningRoot(
      { pubkey: pubKey, withdrawalCredentials, amount: amountGwei },
      domain,
    );
  } catch (e) {
    return {
      ok: false,
      reason: `Signing root failed: ${e instanceof Error ? e.message : String(e)}`,
      stage: 'bls',
    };
  }
  try {
    const pk = PublicKey.fromBytes(pubKey, true);
    const sig = Signature.fromBytes(signature, true);
    if (!verify(signingRoot, pk, sig, true, true)) {
      return {
        ok: false,
        reason:
          'BLS signature did not verify (deposit message proof of possession)',
        stage: 'bls',
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: `BLS verification error: ${e instanceof Error ? e.message : String(e)}`,
      stage: 'bls',
    };
  }

  return { ok: true, stage: 'full' };
}

function isAllZero(bytes: Uint8Array): boolean {
  return bytes.every((b) => b === 0);
}

function toBytes(x: string | Uint8Array): Uint8Array {
  if (x instanceof Uint8Array) {
    return new Uint8Array(x);
  }
  return new Uint8Array(getBytes(x));
}
