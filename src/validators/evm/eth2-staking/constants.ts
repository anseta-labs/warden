// deposit function signature
export const DEPOSIT_FUNC_SIGNATURE =
  'function deposit(bytes,bytes,bytes,bytes32) payable';
export const DEPOSIT_FUNC_NAME = 'deposit';

// 1 ETH worth of gwei
export const MIN_DEPOSIT_GWEI_COUNT = 1_000_000_000n;
export const GWEI = 1_000_000_000n;
export const ONE_ETH_WEI = 1_000_000_000_000_000_000n;

export const BLS_WITHDRAWAL_PREFIX = 0x00;
export const ETH1_ADDRESS_WITHDRAWAL_PREFIX = 0x01;
export const PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX = 0x02;

//4-byte domain type for deposit
export const DOMAIN_DEPOSIT_TYPE = new Uint8Array([3, 0, 0, 0]);
export const GENESIS_FORK_VERSION_MAINNET = new Uint8Array([0, 0, 0, 0]);
export const GENESIS_FORK_VERSION_HOODI = new Uint8Array([0x90, 0, 0, 0x69]);

export const ZERO_HASH = new Uint8Array(32);
