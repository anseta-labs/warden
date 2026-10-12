import { getAddress, getBytes, hexlify, Transaction } from 'ethers';
import { ERRORS } from '../../../constants/messages/errors';
import type { ActionArguments } from '../../../types';
import {
  EIP7002_DEFAULT_MAX_WITHDRAWAL_REQUEST_FEE_WEI,
  EIP7002_MIN_WITHDRAWAL_REQUEST_FEE_WEI,
  EIP7002_WITHDRAWAL_REQUEST_CALLDATA_BYTES,
  EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY,
  GWEI,
} from './constants';
import type { EthNetwork } from './networks';
import type { BaseValidatorValidationResult } from '../../../types';
import { bls12_381 as bls } from '@noble/curves/bls12-381.js';
import { isAllZero } from '../../../utils/validation';
import {
  readOptionalWei,
  readRequiredGweiAlignedWei,
  readRequiredValidatorPubkey,
} from './args';
import { validateGasFields } from './gas';
import { validateTxEnvelope } from './envelope';

const predeployChecksummed = getAddress(EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY);

function normalizeOptionalPubkeyHex(value: string): string {
  const s = value.trim();
  const hex = s.startsWith('0x') ? s.slice(2) : s;
  return hex.toLowerCase();
}

/**
 * Static validation for an unsigned tx that calls the EIP-7002 withdrawal request predeploy
 * with 56-byte calldata (validator pubkey + uint64 amount in gwei, big-endian).
 *
 * Does not consult beacon state: cannot prove `userAddress` owns the validator’s withdrawal
 * credentials.
 *
 * Required integrator bindings (fail closed):
 * - `args.validatorPublicKey` (both modes) - 48-byte hex pubkey the user approved.
 * - `args.amountWei` (`partial` mode) - approved amount in wei (calldata carries gwei).
 * Optional:
 * - `args.maxFeeWei` - ceiling on `tx.value` (the request fee). Defaults to
 *   {@link EIP7002_DEFAULT_MAX_WITHDRAWAL_REQUEST_FEE_WEI}. The predeploy does not
 *   refund overpayment, so an uncapped value would be burned.
 *
 * **`mode`:** Under EIP-7002 / Electra, `amount == 0` (gwei) is the **full-exit** sentinel;
 * `amount > 0` requests a **partial** withdrawal. `partial` rejects `amount === 0`;
 * `full-exit` rejects `amount !== 0`. `args.amountWei` is only checked in `partial` mode.
 */
export function validateEip7002WithdrawalRequest(
  unsignedTransactionHex: string,
  userAddress: string,
  requestChainId: number | undefined,
  network: EthNetwork,
  args?: ActionArguments,
  mode: 'partial' | 'full-exit' = 'partial',
): BaseValidatorValidationResult {
  if (!userAddress?.trim()) {
    return { ok: false, reason: ERRORS.INVALID_USER_ADDR };
  }
  getAddress(userAddress);

  let tx: Transaction;
  try {
    tx = Transaction.from(unsignedTransactionHex);
  } catch {
    return { ok: false, reason: ERRORS.INVALID_UNSIGNED_TX };
  }
  if (tx.to == null) {
    return { ok: false, reason: ERRORS.INVALID_TX_TO_ADDR };
  }
  if (getAddress(tx.to) !== predeployChecksummed) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_TX_TO_ADDR_NOT_EIP7002_WITHDRAWAL_PREDEPLOY,
    };
  }
  if (tx.chainId == null) {
    return { ok: false, reason: ERRORS.INVALID_CHAIN_ID };
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
  const envelopeCheck = validateTxEnvelope(tx);
  if (!envelopeCheck.ok) return envelopeCheck;
  const gasCheck = validateGasFields(tx, args);
  if (!gasCheck.ok) return gasCheck;
  if (tx.value < EIP7002_MIN_WITHDRAWAL_REQUEST_FEE_WEI) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_VALUE_BELOW_MIN_WITHDRAWAL_REQUEST_FEE,
    };
  }
  const maxFee = readOptionalWei(args, 'maxFeeWei');
  if (!maxFee.ok) return maxFee;
  if (
    tx.value > (maxFee.value ?? EIP7002_DEFAULT_MAX_WITHDRAWAL_REQUEST_FEE_WEI)
  ) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_VALUE_ABOVE_MAX_FEE,
    };
  }

  let dataBytes: Uint8Array;
  try {
    dataBytes = new Uint8Array(getBytes(tx.data));
  } catch {
    return { ok: false, reason: ERRORS.ETH.INVALID_EIP7002_CALLDATA_INVALID };
  }
  if (dataBytes.length !== EIP7002_WITHDRAWAL_REQUEST_CALLDATA_BYTES) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_CALLDATA_LENGTH,
    };
  }

  const pubkey = dataBytes.subarray(0, 48);
  if (isAllZero(pubkey)) {
    return { ok: false, reason: ERRORS.ETH.INVALID_BLS_PUBKEY_ALL_ZERO };
  }

  const pubkeyHex = normalizeOptionalPubkeyHex(hexlify(pubkey));

  try {
    // G1.fromHex expects hex without 0x
    bls.G1.Point.fromHex(pubkeyHex);
  } catch {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_BLS_G1_PUBKEY_INVALID,
    };
  }

  let amountGwei = 0n;
  for (let i = 48; i < 56; i++) {
    const b = dataBytes[i];
    if (b === undefined) {
      return { ok: false, reason: ERRORS.ETH.INVALID_EIP7002_CALLDATA_LENGTH };
    }
    amountGwei = (amountGwei << 8n) | BigInt(b);
  }

  // amount == 0 is the EIP-7002 / Electra full-exit sentinel (gwei field).
  if (mode === 'partial' && amountGwei === 0n) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_PARTIAL_AMOUNT_ZERO_FULL_EXIT_SENTINEL,
    };
  }

  // Full-exit mode only: amount must be 0.
  if (mode === 'full-exit' && amountGwei !== 0n) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_FULL_EXIT_AMOUNT_MUST_BE_ZERO,
    };
  }

  // Required: bind to the validator the user approved (both modes).
  const expectedPk = readRequiredValidatorPubkey(args);
  if (!expectedPk.ok) return expectedPk;
  if (expectedPk.value !== pubkeyHex) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_ARGS_VALIDATOR_PUBKEY_MISMATCH,
    };
  }

  // Required in partial mode: bind the amount (args in wei, calldata in gwei).
  if (mode === 'partial') {
    const expectedWei = readRequiredGweiAlignedWei(args, 'amountWei');
    if (!expectedWei.ok) return expectedWei;
    if (expectedWei.value / GWEI !== amountGwei) {
      return {
        ok: false,
        reason: ERRORS.ETH.INVALID_EIP7002_ARGS_AMOUNT_WEI_MISMATCH_CALLDATA,
      };
    }
  }

  return { ok: true };
}
