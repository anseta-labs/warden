import {
  ActionArguments,
  TransactionType,
  ValidationContext,
  ValidationResult,
} from '../../types';
import { BaseValidator } from '../base.validator';
import type { EthDepositNetwork } from './eth2-deposit/networks';
import { validateEthBeaconDeposit } from './eth2-deposit/validate-eth-deposit';

/**
 * Eth2 native 32-ETH (or 1–32 ETH) deposit calls to the official beacon chain deposit contract.
 * Maps one {@link EthDepositNetwork} to one registered action id (e.g. `ethereum-mainnet:ETH`).
 */
export class EthereumBeaconDepositValidator extends BaseValidator {
  constructor(private readonly network: EthDepositNetwork) {
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
        'Only DEPOSIT transactions are supported for beacon deposits',
      );
    }
    const chainId =
      typeof _context?.chainId === 'number' ? _context.chainId : undefined;
    const r = validateEthBeaconDeposit(
      unsignedTransaction,
      userAddress,
      chainId,
      this.network,
    );
    if (!r.ok) {
      return {
        isValid: false,
        reason: r.reason,
        details: { stage: r.stage },
      };
    }
    return this.safe();
  }
}
