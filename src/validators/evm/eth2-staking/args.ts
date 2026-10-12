import type { ActionArguments } from '../../../types';
import { ERRORS } from '../../../constants/messages/errors';
import { GWEI } from './constants';

/**
 * Integrator-args readers for the ETH validators.
 *
 * Rule: a binding the reviewer relies on is REQUIRED. Missing, empty, or
 * wrongly-typed values fail validation. They are never silently skipped.
 */

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; reason: string };

const HEX_RE = /^[0-9a-f]*$/;

function normalizeHex(s: string): string {
  const t = s.trim().toLowerCase();
  return t.startsWith('0x') ? t.slice(2) : t;
}

/** Fixed-length hex string (e.g. 48-byte BLS pubkey, 32-byte credentials). */
function readHexArg(
  args: ActionArguments | undefined,
  key: string,
  byteLength: number,
  missingReason: string,
  invalidReason: string,
): Ok<string> | Err {
  const raw = args?.[key];
  if (raw === undefined || raw === null)
    return { ok: false, reason: missingReason };
  if (typeof raw !== 'string') return { ok: false, reason: invalidReason };
  const hex = normalizeHex(raw);
  if (hex.length !== byteLength * 2 || !HEX_RE.test(hex)) {
    return { ok: false, reason: invalidReason };
  }
  return { ok: true, value: hex };
}

/** Required `args.validatorPublicKey`: 48-byte hex string. */
export function readRequiredValidatorPubkey(
  args: ActionArguments | undefined,
): Ok<string> | Err {
  return readHexArg(
    args,
    'validatorPublicKey',
    48,
    ERRORS.ETH.MISSING_ARGS_VALIDATOR_PUBKEY,
    ERRORS.ETH.INVALID_ARGS_VALIDATOR_PUBKEY_FORMAT,
  );
}

/**
 * Wei amount as a decimal string or bigint (numbers are rejected: they lose
 * precision above 2^53). Must be a non-negative whole number of gwei.
 */
function parseWei(raw: unknown, key: string): Ok<bigint> | Err {
  let wei: bigint;
  if (typeof raw === 'bigint') {
    wei = raw;
  } else if (typeof raw === 'string' && /^\s*\d+\s*$/.test(raw)) {
    wei = BigInt(raw.trim());
  } else {
    return {
      ok: false,
      reason: `${ERRORS.ETH.INVALID_ARGS_WEI_FORMAT} (args.${key})`,
    };
  }
  if (wei < 0n) {
    return {
      ok: false,
      reason: `${ERRORS.ETH.INVALID_ARGS_WEI_FORMAT} (args.${key})`,
    };
  }
  return { ok: true, value: wei };
}

/** Required wei amount that must also be a whole number of gwei. */
export function readRequiredGweiAlignedWei(
  args: ActionArguments | undefined,
  key: string,
): Ok<bigint> | Err {
  const raw = args?.[key];
  if (raw === undefined || raw === null || raw === '') {
    return {
      ok: false,
      reason: `${ERRORS.ETH.MISSING_ARGS_AMOUNT_WEI} (args.${key})`,
    };
  }
  const parsed = parseWei(raw, key);
  if (!parsed.ok) return parsed;
  if (parsed.value % GWEI !== 0n) {
    return {
      ok: false,
      reason: ERRORS.ETH.INVALID_EIP7002_ARGS_AMOUNT_WEI_NOT_GWEI_MULTIPLE,
    };
  }
  return parsed;
}

/** Optional wei amount (any wei value); `undefined` when absent. */
export function readOptionalWei(
  args: ActionArguments | undefined,
  key: string,
): Ok<bigint | undefined> | Err {
  const raw = args?.[key];
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  return parseWei(raw, key);
}
