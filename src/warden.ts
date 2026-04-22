import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from './types';
import { validatorRegistry } from './validators';
import { isNonEmptyString, isNullOrUndefined } from './utils/validation';

export interface ValidationRequest {
  /** StakeFi actionId = named-validator-node-id or validator-node address */
  actionId: string;
  unsignedTransaction: string;
  userAddress: string;
  /** EVM chain ID (e.g. 1 for Ethereum mainnet). Optional but recommended for EVM validators. */
  chainId?: number;
  args?: ActionArguments;
  context?: ValidationContext;
}

export class Warden {
  getSupportedActionIds(): string[] {
    return Array.from(validatorRegistry.keys());
  }

  isSupported(actionId: string): boolean {
    return validatorRegistry.has(actionId);
  }

  validate(request: ValidationRequest): ValidationResult {
    if (isNullOrUndefined(request)) {
      return {
        isValid: false,
        reason: 'Missing validation request',
      };
    }

    const validator = validatorRegistry.get(request.actionId);

    if (!validator) {
      return {
        isValid: false,
        reason: 'Unknown action ID',
        details: { actionId: request.actionId },
      };
    }

    if (
      !isNonEmptyString(request.unsignedTransaction) ||
      !isNonEmptyString(request.userAddress)
    ) {
      return {
        isValid: false,
        reason: 'Invalid request parameters',
      };
    }

    const supportedTypes = validator.getSupportedTransactionTypes();
    const attempts: Array<{
      type: TransactionType;
      result: ValidationResult;
    }> = [];
    const matches: Array<{ type: TransactionType; result: ValidationResult }> =
      [];

    for (const transactionType of supportedTypes) {
      try {
        const result = validator.validate(
          request.unsignedTransaction,
          transactionType,
          request.userAddress,
          request.args,
          {
            ...(request.context ?? {}),
            ...(request.chainId != null ? { chainId: request.chainId } : {}),
          },
        );

        attempts.push({ type: transactionType, result });

        if (result.isValid) {
          matches.push({ type: transactionType, result });
        }
      } catch (error) {
        attempts.push({
          type: transactionType,
          result: {
            isValid: false,
            reason: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    if (matches.length === 1) {
      return {
        ...matches[0].result,
        detectedType: matches[0].type,
      };
    }

    if (matches.length > 1) {
      return {
        isValid: false,
        reason:
          'Transaction validation failed: Ambiguous transaction pattern detected. Transaction matches multiple operation types, which may indicate a security risk.',
        details: {
          actionId: request.actionId,
          matchedTypes: matches.map((m) => m.type),
          warning:
            'A legitimate transaction must match exactly one pattern. Multiple matches indicate potential manipulation.',
        },
      };
    }

    return {
      isValid: false,
      reason:
        'Transaction validation failed: No matching operation pattern found. This transaction may be malicious or corrupted.',
      details: {
        actionId: request.actionId,
        supportedTypes,
        warning:
          'A legitimate transaction should match exactly one supported pattern',
        attempts: attempts.map((a) => ({
          type: a.type,
          reason: a.result.reason,
        })),
      },
    };
  }
}
