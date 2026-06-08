import { TransactionType, ValidationRequest, ValidationResult } from './types';
import { makeValidatorRegistryKey, validatorRegistry } from './validators';
import { isNonEmptyString, isNullOrUndefined } from './utils/validation';
import { ERRORS } from './constants/messages/errors';

function isValidChainId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

function isValidTransactionType(t: unknown): t is TransactionType {
  return (
    typeof t === 'string' &&
    (Object.values(TransactionType) as string[]).includes(t)
  );
}

/** Parse `${chainId}:${TransactionType}` registry keys. */
function parseValidatorRegistryKeys(): Array<{
  chainId: number;
  transactionType: TransactionType;
}> {
  return Array.from(validatorRegistry.keys()).map((key) => {
    const sep = key.indexOf(':');
    return {
      chainId: Number(key.slice(0, sep)),
      transactionType: key.slice(sep + 1) as TransactionType,
    };
  });
}

export class Warden {
  /**
   * Distinct L1 chain ids that have at least one registered validator, ascending.
   */
  getSupportedChains(): number[] {
    const chainIds = new Set(
      parseValidatorRegistryKeys().map((p) => p.chainId),
    );
    return Array.from(chainIds).sort((a, b) => a - b);
  }

  /**
   * Transaction types registered for `chainId`. Empty if the chain has no validators.
   * Invalid `chainId` (non-positive or non-integer) yields `[]`.
   */
  getSupportedTransactionTypes(chainId: number): TransactionType[] {
    if (!isValidChainId(chainId)) {
      return [];
    }
    const types = parseValidatorRegistryKeys()
      .filter((p) => p.chainId === chainId)
      .map((p) => p.transactionType);
    return Array.from(new Set(types)).sort((a, b) => a.localeCompare(b));
  }

  /**
   * All `(chainId, transactionType)` pairs with a registered validator.
   */
  getSupportedChainTypePairs(): Array<{
    chainId: number;
    transactionType: TransactionType;
  }> {
    return parseValidatorRegistryKeys().sort((a, b) =>
      a.chainId !== b.chainId
        ? a.chainId - b.chainId
        : a.transactionType.localeCompare(b.transactionType),
    );
  }

  isSupported(chainId: number, transactionType: TransactionType): boolean {
    if (!isValidChainId(chainId) || !isValidTransactionType(transactionType)) {
      return false;
    }
    return validatorRegistry.has(
      makeValidatorRegistryKey(chainId, transactionType),
    );
  }

  /**
   * @param unsignedTransaction Unsigned transaction payload from the dev API (`0x`-prefixed hex for EVM,
   *   base64 for Solana legacy wire format)
   * @param chainId L1 chain the user intends (must match the tx, e.g. `1`, `560048` for Ethereum, `101` for Solana mainnet-beta)
   * @param userAddress Address of the wallet that will sign
   * @param transactionType Operation the user expects (must match a registered pair with `chainId`)
   * @param args Optional integrator hints; context: optional; Warden merges chainId into context for validators
   * @param context Optional context for the validator
   * @returns ValidationResult
   */
  validate(request: ValidationRequest): ValidationResult {
    if (isNullOrUndefined(request)) {
      return {
        isValid: false,
        reason: ERRORS.MISSING_VALIDATION_REQUEST,
      };
    }

    if (!isValidChainId(request.chainId)) {
      return {
        isValid: false,
        reason: ERRORS.INVALID_CHAIN_ID,
        details: { chainId: request.chainId },
      };
    }

    if (!isValidTransactionType(request.transactionType)) {
      return {
        isValid: false,
        reason: ERRORS.INVALID_TX_TYPE,
        details: { transactionType: request.transactionType },
      };
    }

    const validator = validatorRegistry.get(
      makeValidatorRegistryKey(request.chainId, request.transactionType),
    );

    if (!validator) {
      return {
        isValid: false,
        reason: ERRORS.NO_VALIDATOR_CHAIN_ID_TX_TYPE,
        details: {
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    }

    if (!isNonEmptyString(request.unsignedTransaction)) {
      return {
        isValid: false,
        reason: ERRORS.INVALID_UNSIGNED_TX,
        details: {
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    }

    if (!isNonEmptyString(request.userAddress)) {
      return {
        isValid: false,
        reason: ERRORS.INVALID_USER_ADDR,
        details: {
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    }

    const supported = validator.getSupportedTransactionTypes();
    if (!supported.includes(request.transactionType)) {
      return {
        isValid: false,
        reason: ERRORS.UNSUPPORTED_TX_TYPE,
        details: {
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    }

    try {
      const result = validator.validate(
        request.unsignedTransaction,
        request.transactionType,
        request.userAddress,
        request.args,
        {
          ...(request.context ?? {}),
          chainId: request.chainId,
        },
      );

      if (result.isValid) {
        return {
          ...result,
          detectedType: request.transactionType,
        };
      }
      return {
        ...result,
        details: {
          ...result.details,
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        reason: error instanceof Error ? error.message : String(error),
        details: {
          chainId: request.chainId,
          transactionType: request.transactionType,
        },
      };
    }
  }
}
