const INVALID_PARAMS: string = 'Invalid Request Parameters';
const TRANSACTION_VALIDATION_FAILED: string = 'Transaction Validation Failed';
const MISSING_VALIDATION_REQUEST: string = 'Missing Validation Request';
const INVALID_CHAIN_ID =
  'Invalid or missing chainId (positive integer required)';
const INVALID_TX_TYPE = 'Invalid or missing transactionType';
const INVALID_UNSIGNED_TX = 'Invalid or missing unsignedTransaction';
const INVALID_USER_ADDR = 'Invalid or missing userAddress';
const NO_VALIDATOR_CHAIN_ID_TX_TYPE =
  'No validator for this chain and transaction type';
const UNSUPPORTED_TX_TYPE =
  'Validator does not support this transaction type yet';
const INVALID_TX_TO_ADDR = 'Transaction has no "to" (contract) address';

// ETH specific errors
const INVALID_TX_TO_ADDR_NOT_DEPOSIT_CONTRACT =
  'Transaction "to" is not the official beacon deposit contract for this network';
const INVALID_ETH_USER_ADDR = 'userAddress is not a valid Ethereum address';
const INVALID_CHAIN_ID_NOT_MATCH_NETWORK =
  'Transaction chainId does not match network configuration';
const INVALID_CHAIN_ID_NOT_MATCH_REQUEST =
  'Request chainId does not match this validator network';
const INVALID_CHAIN_ID_NOT_MATCH_TRANSACTION =
  'Request chainId does not match transaction chainId';
const INVALID_DEPOSIT_VALUE_ZERO = 'Deposit must send a non-zero ETH value';
const INVALID_DEPOSIT_VALUE_MULTIPLE_OF_GWEI =
  'Deposit value must be a multiple of 1 gwei (as required on-chain)';
const INVALID_DEPOSIT_VALUE_BELOW_MINIMUM =
  'Deposit below minimum (1 ETH on the deposit contract)';
const INVALID_DEPOSIT_VALUE_EXCEEDS_UINT64 =
  'Deposit amount in gwei exceeds uint64';
const INVALID_CALLDATA_TOO_SHORT = 'Calldata too short for a function call';
const INVALID_CALLDATA_NOT_CALL_TO_DEPOSIT =
  'Calldata is not a call to deposit(bytes,bytes,bytes,bytes32)';
const INVALID_CALLDATA_NOT_VALID_DEPOSIT_CALL =
  'Calldata is not a valid deposit(bytes,bytes,bytes,bytes32) call';
const INVALID_DEPOSIT_VALUE_TOO_LARGE =
  'Deposit gwei is too large for this validator (Number-safe range)';
const INVALID_BLS_PUBKEY_LENGTH = 'BLS pubkey must be 48 bytes';
const INVALID_BLS_PUBKEY_ALL_ZERO = 'BLS pubkey is all zero';
const INVALID_WITHDRAWAL_CREDENTIALS_LENGTH =
  'Withdrawal credentials must be 32 bytes';
const INVALID_0x02_WITHDRAWAL_CREDENTIALS_LAYOUT =
  'Invalid 0x02 withdrawal credentials layout';
const INVALID_0x01_WITHDRAWAL_CREDENTIALS_LAYOUT =
  'Invalid 0x01 withdrawal credentials layout';
const INVALID_WITHDRAWAL_CREDENTIALS_NOT_TARGET_STAKER =
  'Withdrawal credentials do not target the staker (user) address';
const INVALID_UNSUPPORTED_WITHDRAWAL_CREDENTIALS_PREFIX =
  'Unsupported withdrawal credentials prefix: only 0x01 and 0x02 are accepted (0x00 BLS credentials cannot be tied to the user address)';
const INVALID_BLS_SIGNATURE_LENGTH = 'BLS signature must be 96 bytes';
const INVALID_DEPOSIT_DATA_ROOT_LENGTH = 'deposit_data_root must be 32 bytes';
const INVALID_DEPOSIT_DATA_ROOT_NOT_MATCH_SSZ_ROOT =
  'deposit_data_root does not match SSZ root of (pubkey, withdrawal credentials, amount, signature)';
const SIGNING_ROOT_FAILED = 'Signing root failed';
const BLS_VERIFICATION_ERROR = 'BLS verification error';
const BLS_SIGNATURE_DID_NOT_VERIFY =
  'BLS signature did not verify (deposit message proof of possession)';
const INVALID_0x02_DEPOSIT_VALUE_NOT_WHOLE_NUMBER_OF_ETH =
  '0x02 deposits must send a whole number of ETH';
const INVALID_0x02_TOP_UP_VALUE_BELOW_MINIMUM =
  '0x02 top-up must be at least 1 ETH';

// EIP-7002 execution-layer withdrawal requests (partial + full-exit sentinel)
const INVALID_TX_TO_ADDR_NOT_EIP7002_WITHDRAWAL_PREDEPLOY =
  'Transaction "to" is not the EIP-7002 withdrawal request predeploy contract';
const INVALID_EIP7002_VALUE_BELOW_MIN_WITHDRAWAL_REQUEST_FEE =
  'Transaction value must cover the EIP-7002 withdrawal request fee (minimum 1 wei)';
const INVALID_EIP7002_CALLDATA_INVALID = 'Invalid transaction calldata';
const INVALID_EIP7002_CALLDATA_LENGTH =
  'EIP-7002 withdrawal request calldata must be exactly 56 bytes (pubkey + uint64 amount)';
const INVALID_EIP7002_BLS_G1_PUBKEY_INVALID =
  'Validator pubkey is not a valid BLS12-381 G1 public key (invalid encoding or not on the prime-order subgroup)';
const INVALID_EIP7002_PARTIAL_AMOUNT_ZERO_FULL_EXIT_SENTINEL =
  'Withdrawal amount is zero: under EIP-7002 this requests a full validator exit, not a partial withdrawal. Use a full-exit flow instead.';
const INVALID_EIP7002_FULL_EXIT_AMOUNT_MUST_BE_ZERO =
  'Force-exit calldata must have amount = 0. For partial withdrawals use the withdraw endpoint instead.';
const INVALID_EIP7002_ARGS_VALIDATOR_PUBKEY_MISMATCH =
  'Validator pubkey in calldata does not match args.validatorPublicKey';
const INVALID_EIP7002_ARGS_AMOUNT_WEI_NOT_INTEGER =
  'args.amountWei is not a valid integer string';
const INVALID_EIP7002_ARGS_AMOUNT_WEI_NEGATIVE =
  'args.amountWei must be non-negative';
const INVALID_EIP7002_ARGS_AMOUNT_WEI_NOT_GWEI_MULTIPLE =
  'args.amountWei must be a multiple of 1 gwei to match uint64 gwei in calldata';
const INVALID_EIP7002_ARGS_AMOUNT_WEI_MISMATCH_CALLDATA =
  'Calldata amount (gwei) does not match args.amountWei / 1e9 (developer API must encode gwei in the uint64 field)';

// Integrator-args bindings (fail closed: required bindings are never skipped)
const MISSING_ARGS_VALIDATOR_PUBKEY =
  'args.validatorPublicKey is required: the 48-byte BLS pubkey (hex string) of the validator the user approved';
const INVALID_ARGS_VALIDATOR_PUBKEY_FORMAT =
  'args.validatorPublicKey must be a 48-byte hex string';
const MISSING_ARGS_AMOUNT_WEI =
  'Required amount binding is missing: pass the approved amount in wei as a decimal string';
const INVALID_ARGS_WEI_FORMAT =
  'Value must be a non-negative integer as a decimal string or bigint';
const INVALID_TX_TYPE_NOT_EIP1559 =
  'Only EIP-1559 (type 2) transactions are accepted';
const INVALID_TX_ACCESS_LIST_NOT_EMPTY =
  'Transaction access list must be empty';
const INVALID_GAS_LIMIT_ABOVE_MAX =
  'Transaction gas limit exceeds the allowed maximum; pass args.maxGasLimit to allow a higher value';
const INVALID_MAX_FEE_PER_GAS_ABOVE_MAX =
  'Transaction max fee per gas (or gas price) exceeds the allowed maximum; pass args.maxFeePerGasWei to allow a higher value';
const INVALID_PRIORITY_FEE_ABOVE_MAX =
  'Transaction priority fee (tip) exceeds the allowed maximum; pass args.maxPriorityFeePerGasWei to allow a higher value';
const INVALID_EIP7002_VALUE_ABOVE_MAX_FEE =
  'Transaction value exceeds the maximum EIP-7002 request fee. The predeploy does not refund overpayment; pass args.maxFeeWei to allow a higher fee';

const INVALID_BLS_WITHDRAWAL_CREDENTIALS_ALL_ZERO =
  'BLS withdrawal credentials (0x00) are all zero';

export const ERRORS = {
  INVALID_PARAMS,
  TRANSACTION_VALIDATION_FAILED,
  MISSING_VALIDATION_REQUEST,
  INVALID_CHAIN_ID,
  INVALID_TX_TYPE,
  INVALID_UNSIGNED_TX,
  INVALID_USER_ADDR,
  NO_VALIDATOR_CHAIN_ID_TX_TYPE,
  UNSUPPORTED_TX_TYPE,
  INVALID_TX_TO_ADDR,
  INVALID_CHAIN_ID_NOT_MATCH_NETWORK,
  INVALID_CHAIN_ID_NOT_MATCH_REQUEST,
  INVALID_CHAIN_ID_NOT_MATCH_TRANSACTION,
  ETH: {
    INVALID_TX_TO_ADDR_NOT_DEPOSIT_CONTRACT,
    INVALID_ETH_USER_ADDR,
    INVALID_DEPOSIT_VALUE_ZERO,
    INVALID_DEPOSIT_VALUE_MULTIPLE_OF_GWEI,
    INVALID_DEPOSIT_VALUE_BELOW_MINIMUM,
    INVALID_DEPOSIT_VALUE_EXCEEDS_UINT64,
    INVALID_CALLDATA_TOO_SHORT,
    INVALID_CALLDATA_NOT_CALL_TO_DEPOSIT,
    INVALID_CALLDATA_NOT_VALID_DEPOSIT_CALL,
    INVALID_DEPOSIT_VALUE_TOO_LARGE,
    INVALID_BLS_PUBKEY_LENGTH,
    INVALID_BLS_PUBKEY_ALL_ZERO,
    INVALID_WITHDRAWAL_CREDENTIALS_LENGTH,
    INVALID_BLS_WITHDRAWAL_CREDENTIALS_ALL_ZERO,
    INVALID_0x02_WITHDRAWAL_CREDENTIALS_LAYOUT,
    INVALID_0x01_WITHDRAWAL_CREDENTIALS_LAYOUT,
    INVALID_WITHDRAWAL_CREDENTIALS_NOT_TARGET_STAKER,
    INVALID_UNSUPPORTED_WITHDRAWAL_CREDENTIALS_PREFIX,
    INVALID_BLS_SIGNATURE_LENGTH,
    INVALID_DEPOSIT_DATA_ROOT_LENGTH,
    INVALID_DEPOSIT_DATA_ROOT_NOT_MATCH_SSZ_ROOT,
    SIGNING_ROOT_FAILED,
    BLS_VERIFICATION_ERROR,
    BLS_SIGNATURE_DID_NOT_VERIFY,
    INVALID_0x02_DEPOSIT_VALUE_NOT_WHOLE_NUMBER_OF_ETH,
    INVALID_0x02_TOP_UP_VALUE_BELOW_MINIMUM,
    INVALID_TX_TO_ADDR_NOT_EIP7002_WITHDRAWAL_PREDEPLOY,
    INVALID_EIP7002_VALUE_BELOW_MIN_WITHDRAWAL_REQUEST_FEE,
    INVALID_EIP7002_CALLDATA_INVALID,
    INVALID_EIP7002_CALLDATA_LENGTH,
    INVALID_EIP7002_BLS_G1_PUBKEY_INVALID,
    INVALID_EIP7002_PARTIAL_AMOUNT_ZERO_FULL_EXIT_SENTINEL,
    INVALID_EIP7002_FULL_EXIT_AMOUNT_MUST_BE_ZERO,
    INVALID_EIP7002_ARGS_VALIDATOR_PUBKEY_MISMATCH,
    INVALID_EIP7002_ARGS_AMOUNT_WEI_NOT_INTEGER,
    INVALID_EIP7002_ARGS_AMOUNT_WEI_NEGATIVE,
    INVALID_EIP7002_ARGS_AMOUNT_WEI_NOT_GWEI_MULTIPLE,
    INVALID_EIP7002_ARGS_AMOUNT_WEI_MISMATCH_CALLDATA,
    MISSING_ARGS_VALIDATOR_PUBKEY,
    INVALID_ARGS_VALIDATOR_PUBKEY_FORMAT,
    MISSING_ARGS_AMOUNT_WEI,
    INVALID_ARGS_WEI_FORMAT,
    INVALID_EIP7002_VALUE_ABOVE_MAX_FEE,
    INVALID_TX_TYPE_NOT_EIP1559,
    INVALID_TX_ACCESS_LIST_NOT_EMPTY,
    INVALID_GAS_LIMIT_ABOVE_MAX,
    INVALID_MAX_FEE_PER_GAS_ABOVE_MAX,
    INVALID_PRIORITY_FEE_ABOVE_MAX,
  },
};
