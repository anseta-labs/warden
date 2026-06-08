import { ERRORS } from '../../constants/messages/errors';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../types';
import { BaseValidator } from '../base.validator';
import type { SolanaNetwork } from './networks';
import type { BaseValidatorValidationResult } from '../../types';
import { validateSolanaNativeStake } from './validate-stake';
import { validateSolanaUnstake } from './validate-unstake';

export class SolanaNativeValidator extends BaseValidator {
  constructor(private readonly network: SolanaNetwork) {
    super();
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.STAKE,
      TransactionType.UNSTAKE,
      TransactionType.WITHDRAW,
    ];
  }

  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    const chainId =
      typeof _context?.chainId === 'number' ? _context.chainId : undefined;

    switch (transactionType) {
      case TransactionType.STAKE: {
        const valResult: BaseValidatorValidationResult =
          validateSolanaNativeStake(
            unsignedTransaction,
            userAddress,
            chainId,
            this.network,
            args,
          );
        if (!valResult.ok) {
          return {
            isValid: false,
            reason: valResult.reason ?? ERRORS.TRANSACTION_VALIDATION_FAILED,
          };
        }
        return this.safe();
      }
      case TransactionType.UNSTAKE: {
        const valResult: BaseValidatorValidationResult = validateSolanaUnstake(
          unsignedTransaction,
          userAddress,
          chainId,
          this.network,
          args,
        );
        if (!valResult.ok) {
          return {
            isValid: false,
            reason: valResult.reason ?? ERRORS.TRANSACTION_VALIDATION_FAILED,
          };
        }
        return this.safe();
      }
      default:
        return this.blocked(
          `Only ${this.getSupportedTransactionTypes().join(', ')} are supported for this Solana validator.`,
        );
    }
  }
}
