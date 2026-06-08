export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  details?: {
    chainId?: number;
    transactionType?: TransactionType;
  };
  detectedType?: TransactionType;
}

export interface ValidationRequest {
  unsignedTransaction: string;
  userAddress: string;
  chainId: number;
  transactionType: TransactionType;
  args?: ActionArguments;
  context?: ValidationContext;
}

export type ActionArguments = {
  amount?: string;
  validatorAddress?: string;
  validatorAddresses?: string[];
  receiverAddress?: string;
  inputToken?: string;
  duration?: number;
  [key: string]: unknown;
};

export interface ValidationContext {
  [key: string]: unknown;
}

/**
 * Internal outcome of protocol-specific static checks (`ok` + optional `reason`)
 * before mapping to the public ValidationResult returned by Warden.validate()
 */
export type BaseValidatorValidationResult = {
  ok: boolean;
  reason?: string;
};

export enum TransactionType {
  // eth2 staking specific transaction types
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  FORCE_EXIT = 'FORCE_EXIT',

  // other transaction types, for future use
  EXIT = 'EXIT',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARDS = 'CLAIM_REWARDS',
}
