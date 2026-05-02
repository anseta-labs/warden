import { PublicKey, Signature, verify } from '@chainsafe/blst';
import { byteArrayEquals } from '@chainsafe/ssz';
import {
  getAddress,
  getBytes,
  Interface,
  isAddress,
  Transaction,
} from 'ethers';
import {
  BLS_WITHDRAWAL_PREFIX,
  DOMAIN_DEPOSIT_TYPE,
  ETH1_ADDRESS_WITHDRAWAL_PREFIX,
  GWEI,
  MIN_DEPOSIT_GWEI_COUNT,
  ONE_ETH_WEI,
  PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX,
  DEPOSIT_FUNC_SIGNATURE,
  DEPOSIT_FUNC_NAME,
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
import { ERRORS } from '../../../constants/messages/errors';
import type { EthBeaconStaticValidationResult } from './validation-result';
import { isAllZero } from '../../../utils/validation';

const depositInterface = new Interface([DEPOSIT_FUNC_SIGNATURE]);
const depositSelector = getBytes(
  depositInterface.getFunction(DEPOSIT_FUNC_NAME)!.selector,
);

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
): EthBeaconStaticValidationResult {
  if (!userAddress) {
    return { ok: false, reason: ERRORS.INVALID_USER_ADDR };
  }

  if (!isAddress(userAddress)) {
    return { ok: false, reason: ERRORS.ETH.INVALID_ETH_USER_ADDR };
  }

  const userAddr = getAddress(userAddress);
  // --- 1) Transaction shape
  let tx: Transaction;
  try {
    tx = Transaction.from(unsignedTransactionHex);
  } catch {
    return {
      ok: false,
      reason: ERRORS.INVALID_UNSIGNED_TX,
    };
  }
  if (tx.to == null) {
    return {
      ok: false,
      reason: ERRORS.INVALID_TX_TO_ADDR,
    };
  }
  if (!isDepositContract(tx.to, network)) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_TX_TO_ADDR_NOT_DEPOSIT_CONTRACT,
    };
  }
  if (tx.chainId == null) {
    return {
      ok: false,
      reason: ERRORS.INVALID_CHAIN_ID,
    };
  }
  if (tx.chainId !== BigInt(network.chainId)) {
    return {
      ok: false,
      reason: ERRORS.INVALID_CHAIN_ID_NOT_MATCH_NETWORK,
    };
  }
  if (requestChainId != null && requestChainId !== network.chainId) {
    return {
      ok: false,
      reason: ERRORS.INVALID_CHAIN_ID_NOT_MATCH_REQUEST,
    };
  }
  if (requestChainId != null && requestChainId !== Number(tx.chainId)) {
    return {
      ok: false,
      reason: ERRORS.INVALID_CHAIN_ID_NOT_MATCH_TRANSACTION,
    };
  }
  const { value } = tx;
  const dataBytes = new Uint8Array(getBytes(tx.data));
  if (value === 0n) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_VALUE_ZERO,
    };
  }
  if (value % GWEI !== 0n) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_VALUE_MULTIPLE_OF_GWEI,
    };
  }
  const gwei = value / GWEI;
  if (gwei < MIN_DEPOSIT_GWEI_COUNT) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_VALUE_BELOW_MINIMUM,
    };
  }
  if (gwei > 0xffffffffffffffffn) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_VALUE_EXCEEDS_UINT64,
    };
  }
  if (dataBytes.length < 4) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_CALLDATA_TOO_SHORT,
    };
  }
  if (!byteArrayEquals(dataBytes.subarray(0, 4), depositSelector)) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_CALLDATA_NOT_CALL_TO_DEPOSIT,
    };
  }

  // --- 2) ABI decode
  let pubKey: Uint8Array;
  let withdrawalCredentials: Uint8Array;
  let signature: Uint8Array;
  let depositDataRoot: Uint8Array;
  try {
    const decoded = depositInterface.decodeFunctionData(
      DEPOSIT_FUNC_NAME,
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
      reason: ERRORS.ETH.INVALID_CALLDATA_NOT_VALID_DEPOSIT_CALL,
    };
  }

  if (gwei > BigInt(Number.MAX_SAFE_INTEGER)) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_VALUE_TOO_LARGE,
    };
  }
  const amountGwei = Number(gwei);

  // --- 3) Semantic field checks
  if (pubKey.length !== 48) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_BLS_PUBKEY_LENGTH,
    };
  }
  if (isAllZero(pubKey)) {
    return { ok: false, reason: ERRORS.ETH.INVALID_BLS_PUBKEY_ALL_ZERO };
  }
  if (withdrawalCredentials.length !== 32) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_WITHDRAWAL_CREDENTIALS_LENGTH,
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
            ? ERRORS.ETH.INVALID_0x02_WITHDRAWAL_CREDENTIALS_LAYOUT
            : ERRORS.ETH.INVALID_0x01_WITHDRAWAL_CREDENTIALS_LAYOUT,
      };
    }
    if (addr !== userAddr) {
      return {
        ok: false,
        reason: ERRORS.ETH.INVALID_WITHDRAWAL_CREDENTIALS_NOT_TARGET_STAKER,
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
        reason: ERRORS.ETH.INVALID_BLS_WITHDRAWAL_CREDENTIALS_ALL_ZERO,
      };
    }
  } else {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_UNSUPPORTED_WITHDRAWAL_CREDENTIALS_PREFIX,
    };
  }
  if (signature.length !== 96) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_BLS_SIGNATURE_LENGTH,
    };
  }
  if (depositDataRoot.length !== 32) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_DEPOSIT_DATA_ROOT_LENGTH,
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
      reason: ERRORS.ETH.INVALID_DEPOSIT_DATA_ROOT_NOT_MATCH_SSZ_ROOT,
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
      reason: `${ERRORS.ETH.SIGNING_ROOT_FAILED}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  try {
    const pk = PublicKey.fromBytes(pubKey, true);
    const sig = Signature.fromBytes(signature, true);
    if (!verify(signingRoot, pk, sig, true, true)) {
      return {
        ok: false,
        reason: ERRORS.ETH.BLS_SIGNATURE_DID_NOT_VERIFY,
      };
    }
  } catch (e) {
    return {
      ok: false,
      reason: `${ERRORS.ETH.BLS_VERIFICATION_ERROR}: ${e instanceof Error ? e.message : String(e)}`,
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
    return ERRORS.ETH.INVALID_0x02_DEPOSIT_VALUE_NOT_WHOLE_NUMBER_OF_ETH;
  }
  const eth = valueWei / ONE_ETH_WEI;
  if (eth === 0n) {
    return ERRORS.ETH.INVALID_DEPOSIT_VALUE_BELOW_MINIMUM;
  }
  if (eth < 32n) {
    if (eth < 1n) {
      return ERRORS.ETH.INVALID_0x02_TOP_UP_VALUE_BELOW_MINIMUM;
    }
    return null;
  }
  return null;
}

function toBytes(x: string | Uint8Array): Uint8Array {
  if (x instanceof Uint8Array) {
    return new Uint8Array(x);
  }
  return new Uint8Array(getBytes(x));
}
