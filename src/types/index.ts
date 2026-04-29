export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  details?: {
    chainId?: number;
    transactionType?: TransactionType;
  };
  detectedType?: TransactionType;
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

export enum TransactionType {
  // eth2 staking specific transaction types
  DEPOSIT = 'DEPOSIT',
  STAKE = 'STAKE',
  WITHDRAW = 'WITHDRAW',
  EXIT = 'EXIT',
  FORCE_EXIT = 'FORCE_EXIT',

  // other transaction types, for future use
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARDS = 'CLAIM_REWARDS',
}
