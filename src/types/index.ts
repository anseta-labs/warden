export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  details?: {
    actionId?: string;
    matchedTypes?: TransactionType[];
    supportedTypes?: TransactionType[];
    /** Eth2 deposit validation failed at this sub-stage, when present */
    stage?: string; // todo: we dont care about stage, we just want to know if the transaction is valid or not, remove this
    warning?: string;
    attempts?: {
      type?: TransactionType;
      reason?: string;
    }[];
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
  DEPOSIT = 'DEPOSIT',
  STAKE = 'STAKE',
  UNSTAKE = 'UNSTAKE',
  CLAIM_REWARDS = 'CLAIM_REWARDS',
  WITHDRAW = 'WITHDRAW',
}
