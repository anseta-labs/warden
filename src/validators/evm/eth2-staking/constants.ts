// ethereum mainnet and hoodi deposit contract addresses
export const ETH2_DEPOSIT_CONTRACT_MAINNET =
  '0x00000000219ab540356cBB839Cbe05303d7705Fa';
export const ETH2_DEPOSIT_CONTRACT_HOODI =
  '0x00000000219ab540356cBB839Cbe05303d7705Fa';

// deposit function signature
export const DEPOSIT_FUNC_SIGNATURE =
  'function deposit(bytes,bytes,bytes,bytes32) payable';
export const DEPOSIT_FUNC_NAME = 'deposit';

// 1 ETH worth of gwei
export const MIN_DEPOSIT_GWEI_COUNT = 1_000_000_000n;
export const GWEI = 1_000_000_000n;
export const ONE_ETH_WEI = 1_000_000_000_000_000_000n;

export const ETH1_ADDRESS_WITHDRAWAL_PREFIX = 0x01;
export const PECTRA_COMPOUNDING_WITHDRAWAL_PREFIX = 0x02;

//4-byte domain type for deposit
export const DOMAIN_DEPOSIT_TYPE = new Uint8Array([3, 0, 0, 0]);
export const GENESIS_FORK_VERSION_MAINNET = new Uint8Array([0, 0, 0, 0]);
export const GENESIS_FORK_VERSION_HOODI = new Uint8Array([0x90, 0, 0, 0x69]);

export const ZERO_HASH = new Uint8Array(32);

export const EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY =
  '0x00000961Ef480Eb55e80D19ad83579A64c007002';

// User call: exactly 48-byte BLS pubkey + big-endian uint64 amount (gwei on consensus layer)
export const EIP7002_WITHDRAWAL_REQUEST_CALLDATA_BYTES = 56;

// Minimum fee (wei) for a withdrawal request per EIP-7002; actual fee is often higher
export const EIP7002_MIN_WITHDRAWAL_REQUEST_FEE_WEI = 1n;

/**
 * Default ceiling on the EIP-7002 request fee (tx.value) when the integrator
 * does not pass args.maxFeeWei. The fee is normally 1 wei and only rises
 * exponentially under heavy request volume; the predeploy keeps any overpayment.
 */
export const EIP7002_DEFAULT_MAX_WITHDRAWAL_REQUEST_FEE_WEI =
  1_000_000_000_000_000n;

/**
 * Default gas-field caps (overridable via args). Generous for normal use;
 * worst-case fee = gas limit x max fee per gas = 500k x 500 gwei = 0.25 ETH.
 */
export const DEFAULT_MAX_GAS_LIMIT = 500_000n;
export const DEFAULT_MAX_FEE_PER_GAS_WEI = 500n * 1_000_000_000n; // 500 gwei
export const DEFAULT_MAX_PRIORITY_FEE_PER_GAS_WEI = 50n * 1_000_000_000n; // 50 gwei
