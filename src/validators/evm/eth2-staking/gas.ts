import type { Transaction } from 'ethers';
import type {
  ActionArguments,
  BaseValidatorValidationResult,
} from '../../../types';
import { ERRORS } from '../../../constants/messages/errors';
import {
  DEFAULT_MAX_FEE_PER_GAS_WEI,
  DEFAULT_MAX_GAS_LIMIT,
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI,
} from './constants';
import { readOptionalWei } from './args';

/**
 * Caps the gas fee fields of an unsigned EVM tx. Without this, a tampered tx
 * can set an absurd tip and, if the wallet signs gas fields as given, drain the
 * signer into fees. Unset (null) fields are allowed: the wallet fills them in.
 *
 * Integrators can raise any cap via args: `maxGasLimit`, `maxFeePerGasWei`,
 * `maxPriorityFeePerGasWei` (decimal strings or bigints).
 */
export function validateGasFields(
  tx: Transaction,
  args?: ActionArguments,
): BaseValidatorValidationResult {
  const gasLimitCap = readOptionalWei(args, 'maxGasLimit');
  if (!gasLimitCap.ok) return gasLimitCap;
  const feeCap = readOptionalWei(args, 'maxFeePerGasWei');
  if (!feeCap.ok) return feeCap;
  const tipCap = readOptionalWei(args, 'maxPriorityFeePerGasWei');
  if (!tipCap.ok) return tipCap;

  const maxGasLimit = gasLimitCap.value ?? DEFAULT_MAX_GAS_LIMIT;
  const maxFeePerGas = feeCap.value ?? DEFAULT_MAX_FEE_PER_GAS_WEI;
  const maxTip = tipCap.value ?? DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI;

  if (tx.gasLimit != null && tx.gasLimit > maxGasLimit) {
    return { ok: false, reason: ERRORS.ETH.INVALID_GAS_LIMIT_ABOVE_MAX };
  }
  // EIP-1559 txs use maxFeePerGas; legacy/2930 txs use gasPrice (whole price).
  const feePerGas = tx.maxFeePerGas ?? tx.gasPrice;
  if (feePerGas != null && feePerGas > maxFeePerGas) {
    return { ok: false, reason: ERRORS.ETH.INVALID_MAX_FEE_PER_GAS_ABOVE_MAX };
  }
  if (tx.maxPriorityFeePerGas != null && tx.maxPriorityFeePerGas > maxTip) {
    return { ok: false, reason: ERRORS.ETH.INVALID_PRIORITY_FEE_ABOVE_MAX };
  }
  return { ok: true };
}
