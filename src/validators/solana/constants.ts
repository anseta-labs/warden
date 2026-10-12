const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

const SYSVAR_CLOCK = 'SysvarC1ock11111111111111111111111111111111';
const SYSVAR_STAKE_HISTORY = 'SysvarStakeHistory1111111111111111111111111';
const STAKE_CONFIG = 'StakeConfig11111111111111111111111111111111';

const PARTIAL_UNSTAKE_INSTRUCTION_COUNT = 3; // CreateAccountWithSeed -> Split -> Deactivate
const FULL_UNSTAKE_INSTRUCTION_COUNT = 1; // Deactivate only

const STAKE_DISC = {
  Initialize: 0,
  Authorize: 1,
  Delegate: 2,
  Split: 3,
  Withdraw: 4,
  Deactivate: 5,
} as const;
const SYS_DISC = {
  CreateAccount: 0,
  Assign: 1,
  Transfer: 2,
  CreateAccountWithSeed: 3,
  Allocate: 8,
  AllocateWithSeed: 9,
} as const;

export {
  SYSTEM_PROGRAM_ID,
  STAKE_PROGRAM_ID,
  SYSVAR_CLOCK,
  SYSVAR_STAKE_HISTORY,
  STAKE_CONFIG,
  STAKE_DISC,
  SYS_DISC,
  PARTIAL_UNSTAKE_INSTRUCTION_COUNT,
  FULL_UNSTAKE_INSTRUCTION_COUNT,
};

/**
 * Ceiling on the lamports funding the new split stake account in a partial
 * unstake (CreateAccountWithSeed). Real value today is the rent-exempt minimum
 * for a 200-byte stake account (2,282,880 lamports); the buffer tolerates future
 * rent changes. Excess would move the user's SOL into the new account.
 */
export const MAX_SPLIT_ACCOUNT_RENT_LAMPORTS = 10_000_000;
/** Size of a stake account in bytes. */
export const STAKE_ACCOUNT_SPACE = 200;
