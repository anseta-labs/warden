import type { Transaction } from 'ethers';
import type { BaseValidatorValidationResult } from '../../../types';
import { ERRORS } from '../../../constants/messages/errors';

/**
 * Only EIP-1559 (type 2) transactions with no access list are accepted. Other
 * envelopes (legacy, 2930, blob, 7702 set-code) are not produced by the Anseta
 * API and add fields Warden would otherwise have to reason about.
 */
export function validateTxEnvelope(
  tx: Transaction,
): BaseValidatorValidationResult {
  if (tx.type !== 2) {
    return { ok: false, reason: ERRORS.ETH.INVALID_TX_TYPE_NOT_EIP1559 };
  }
  if (tx.accessList && tx.accessList.length > 0) {
    return { ok: false, reason: ERRORS.ETH.INVALID_TX_ACCESS_LIST_NOT_EMPTY };
  }
  return { ok: true };
}
