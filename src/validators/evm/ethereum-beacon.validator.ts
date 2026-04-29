import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../types';
import { BaseValidator } from '../base.validator';
import type { EthNetwork } from './eth2-staking/networks';
import {
  EthDepositValidationResult,
  validateEthBeaconDeposit,
} from './eth2-staking/validate-eth-deposit';

export class EthereumBeaconValidator extends BaseValidator {
  constructor(private readonly network: EthNetwork) {
    super();
  }

  getSupportedTransactionTypes(): TransactionType[] {
    return [TransactionType.DEPOSIT]; // add more later
  }

  validate(
    unsignedTransaction: string,
    transactionType: TransactionType,
    userAddress: string,
    _args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    if (transactionType !== TransactionType.DEPOSIT) {
      return this.blocked(
        `Only ${this.getSupportedTransactionTypes().join(', ')} transactions are supported for ETH.`,
      );
    }
    const chainId =
      typeof _context?.chainId === 'number' ? _context.chainId : undefined;

    let valResult: EthDepositValidationResult;
    switch (transactionType) {
      case TransactionType.DEPOSIT:
        valResult = validateEthBeaconDeposit(
          unsignedTransaction,
          userAddress,
          chainId,
          this.network,
        );
      // add more transaction types here
    }

    if (!valResult.ok) {
      return {
        isValid: false,
        reason: valResult.reason ?? 'Unknown error',
      };
    }
    return this.safe();
  }
}
