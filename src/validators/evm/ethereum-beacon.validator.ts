import { ERRORS } from '../../constants/messages/errors';
import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../types';
import { BaseValidator } from '../base.validator';
import type { EthNetwork } from './eth2-staking/networks';
import type { EthBeaconStaticValidationResult } from './eth2-staking/validation-result';
import { validateEthBeaconDeposit } from './eth2-staking/validate-eth-deposit';
import { validateEip7002WithdrawalRequest } from './eth2-staking/validate-eip7002-withdrawal';

export class EthereumBeaconValidator extends BaseValidator {
  constructor(private readonly network: EthNetwork) {
    super();
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [
      TransactionType.DEPOSIT,
      TransactionType.WITHDRAW,
      TransactionType.FORCE_EXIT,
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
      case TransactionType.DEPOSIT: {
        const valResult: EthBeaconStaticValidationResult =
          validateEthBeaconDeposit(
            unsignedTransaction,
            userAddress,
            chainId,
            this.network,
          );
        if (!valResult.ok) {
          return {
            isValid: false,
            reason: valResult.reason ?? ERRORS.TRANSACTION_VALIDATION_FAILED,
          };
        }
        return this.safe();
      }
      case TransactionType.WITHDRAW: {
        const valResult: EthBeaconStaticValidationResult =
          validateEip7002WithdrawalRequest(
            unsignedTransaction,
            userAddress,
            chainId,
            this.network,
            args,
            'partial',
          );
        if (!valResult.ok) {
          return {
            isValid: false,
            reason: valResult.reason ?? ERRORS.TRANSACTION_VALIDATION_FAILED,
          };
        }
        return this.safe();
      }
      case TransactionType.FORCE_EXIT: {
        const valResult: EthBeaconStaticValidationResult =
          validateEip7002WithdrawalRequest(
            unsignedTransaction,
            userAddress,
            chainId,
            this.network,
            args,
            'full-exit',
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
          `Only ${this.getSupportedTransactionTypes().join(', ')} are supported for this Ethereum beacon validator.`,
        );
    }
  }
}
