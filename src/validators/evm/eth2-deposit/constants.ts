/** Matches `stakingKey` from the developer API (`network:token`) for native ETH → beacon deposit. */
export const ACTION_ID_ETH_DEPOSIT_MAINNET = 'ethereum-mainnet:ETH' as const;
export const ACTION_ID_ETH_DEPOSIT_SEPOLIA =
  'ethereum-sepolia-testnet:ETH' as const;
export const ACTION_ID_ETH_DEPOSIT_HOODI =
  'ethereum-hoodi-testnet:ETH' as const;

/** @see https://github.com/ethereum/solidity-deposit-contract */
export const DEPOSIT_FUNC =
  'function deposit(bytes,bytes,bytes,bytes32) payable';

/** `msg.value / 1 gwei` must be ≥ this (1 ETH worth of gwei count on the contract). */
export const MIN_DEPOSIT_GWEI_COUNT = 1_000_000_000n;
export const GWEI = 1_000_000_000n;

export const BLS_WITHDRAWAL_PREFIX = 0x00;
export const ETH1_ADDRESS_WITHDRAWAL_PREFIX = 0x01;

/** 4-byte domain type for deposit (phase 0) */
export const DOMAIN_DEPOSIT_TYPE = new Uint8Array([3, 0, 0, 0]);
export const GENESIS_FORK_VERSION_MAINNET = new Uint8Array([0, 0, 0, 0]);
export const GENESIS_FORK_VERSION_SEPOLIA = new Uint8Array([0x90, 0, 0, 0x69]);
export const GENESIS_FORK_VERSION_HOODI = new Uint8Array([0x90, 0, 0, 0x69]);

export const ZERO_HASH = new Uint8Array(32);
