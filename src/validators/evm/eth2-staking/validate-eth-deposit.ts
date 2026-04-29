import { PublicKey, Signature, verify } from '@chainsafe/blst';
import { byteArrayEquals } from '@chainsafe/ssz';
import { getAddress, getBytes, Interface, Transaction } from 'ethers';
import {
  BLS_WITHDRAWAL_PREFIX,
  DOMAIN_DEPOSIT_TYPE,
  ETH1_ADDRESS_WITHDRAWAL_PREFIX,
  GWEI,
  MIN_DEPOSIT_GWEI_COUNT,
  ONE_ETH_WEI,
  PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX,
  DEPOSIT_FUNC,
} from './constants';
import type { EthNetwork } from './networks';
import {
  isDepositContract,
  withdrawalCredentialsToExecutionAddress,
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

export type EthDepositValidationResult = { ok: boolean; reason?: string };

/**
 * Full static validation for a beacon `deposit` call (shape -> ABI -> semantics ->
 * SSZ `DepositData` root -> BLS proof-of-possession).
 *
 * Supports `0x00`, `0x01`, and `0x02` (Pectra) withdrawal credentials. `0x01` and
 * `0x02` must embed the staker EVM address; `0x02` also requires a whole-ETH
 * value (1-31 ETH for top-up, or >=32 ETH for a new compounding deposit).
 *
 * @param userAddress Staker address; `0x01` / `0x02` credentials must point at this address.
 * @param requestChainId Caller’s chain id - should match the tx and this network.
 */
export function validateEthBeaconDeposit(
  unsignedTransactionHex: string,
  userAddress: string,
  requestChainId: number | undefined,
  network: EthNetwork,
): EthDepositValidationResult {
  if (!userAddress) {
    return { ok: false, reason: 'Missing user address' };
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
    };
  }
  if (tx.to == null) {
    return {
      ok: false,
      reason: 'Transaction has no "to" (contract) address',
    };
  }
  if (!isDepositContract(tx.to, network)) {
    return {
      ok: false,
      reason:
        'Transaction "to" is not the official beacon deposit contract for this network',
    };
  }
  if (tx.chainId == null) {
    return {
      ok: false,
      reason: 'Transaction must include chainId (EIP-155)',
    };
  }
  if (tx.chainId !== BigInt(network.chainId)) {
    return {
      ok: false,
      reason: 'Transaction chainId does not match network configuration',
    };
  }
  if (requestChainId != null && requestChainId !== network.chainId) {
    return {
      ok: false,
      reason: 'Request chainId does not match this validator network',
    };
  }
  if (requestChainId != null && requestChainId !== Number(tx.chainId)) {
    return {
      ok: false,
      reason: 'Request chainId does not match transaction chainId',
    };
  }
  const { value } = tx;
  const dataBytes = new Uint8Array(getBytes(tx.data));
  if (value === 0n) {
    return {
      ok: false,
      reason: 'Deposit must send a non-zero ETH value',
    };
  }
  if (value % GWEI !== 0n) {
    return {
      ok: false,
      reason:
        'Deposit value must be a multiple of 1 gwei (as required on-chain)',
    };
  }
  const gwei = value / GWEI;
  if (gwei < MIN_DEPOSIT_GWEI_COUNT) {
    return {
      ok: false,
      reason: 'Deposit below minimum (1 ETH on the deposit contract)',
    };
  }
  if (gwei > 0xffffffffffffffffn) {
    return {
      ok: false,
      reason: 'Deposit amount in gwei exceeds uint64',
    };
  }
  if (dataBytes.length < 4) {
    return {
      ok: false,
      reason: 'Calldata too short for a function call',
    };
  }
  if (!byteArrayEquals(dataBytes.subarray(0, 4), depositSelector)) {
    return {
      ok: false,
      reason: 'Calldata is not a call to deposit(bytes,bytes,bytes,bytes32)',
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
    };
  }

  if (gwei > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      reason:
        'Deposit gwei is too large for this validator (Number-safe range)',
    };
  }
  const amountGwei = Number(gwei);

  // --- 3) Semantic field checks
  if (pubKey.length !== 48) {
    return {
      ok: false,
      reason: 'BLS pubkey must be 48 bytes',
    };
  }
  if (isAllZero(pubKey)) {
    return { ok: false, reason: 'BLS pubkey is all zero' };
  }
  if (withdrawalCredentials.length !== 32) {
    return {
      ok: false,
      reason: 'Withdrawal credentials must be 32 bytes',
    };
  }
  const prefix = withdrawalCredentials[0];
  if (
    prefix === ETH1_ADDRESS_WITHDRAWAL_PREFIX ||
    prefix === PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX
  ) {
    const addr = withdrawalCredentialsToExecutionAddress(withdrawalCredentials);
    if (addr == null) {
      return {
        ok: false,
        reason:
          prefix === PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX
            ? 'Invalid 0x02 withdrawal credentials layout'
            : 'Invalid 0x01 withdrawal credentials layout',
      };
    }
    if (addr !== userAddr) {
      return {
        ok: false,
        reason:
          'Withdrawal credentials do not target the staker (user) address',
      };
    }
    if (prefix === PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX) {
      const valueErr = validatePectra0x02ValueWei(value);
      if (valueErr) {
        return { ok: false, reason: valueErr };
      }
    }
  } else if (prefix === BLS_WITHDRAWAL_PREFIX) {
    if (isAllZero(withdrawalCredentials)) {
      return {
        ok: false,
        reason: 'BLS withdrawal credentials (0x00) are all zero',
      };
    }
  } else {
    return {
      ok: false,
      reason:
        'Unsupported withdrawal credentials prefix (expected 0x00, 0x01, or 0x02)',
    };
  }
  if (signature.length !== 96) {
    return {
      ok: false,
      reason: 'BLS signature must be 96 bytes',
    };
  }
  if (depositDataRoot.length !== 32) {
    return {
      ok: false,
      reason: 'deposit_data_root must be 32 bytes',
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
    };
  }
  if (!byteArrayEquals(expectedRoot, depositDataRoot)) {
    return {
      ok: false,
      reason:
        'deposit_data_root does not match SSZ root of (pubkey, withdrawal credentials, amount, signature)',
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
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: `BLS verification error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  return { ok: true };
}

/**
 * 0x02: whole-ETH `msg.value` only; 1-31 ETH = top-up, >=32 = new (matches product rules).
 * See also MIN_DEPOSIT (1 ETH) checked earlier in tx shape.
 */
function validatePectra0x02ValueWei(valueWei: bigint): string | null {
  if (valueWei % ONE_ETH_WEI !== 0n) {
    return '0x02 deposits must send a whole number of ETH';
  }
  const eth = valueWei / ONE_ETH_WEI;
  if (eth === 0n) {
    return 'Deposit below minimum (1 ETH on the deposit contract)';
  }
  if (eth < 32n) {
    if (eth < 1n) {
      return '0x02 top-up must be at least 1 ETH';
    }
    return null;
  }
  return null;
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
