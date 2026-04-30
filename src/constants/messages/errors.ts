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
const INVALID_BLS_WITHDRAWAL_CREDENTIALS_ALL_ZERO =
  'BLS withdrawal credentials (0x00) are all zero';
const INVALID_UNSUPPORTED_WITHDRAWAL_CREDENTIALS_PREFIX =
  'Unsupported withdrawal credentials prefix (expected 0x00, 0x01, or 0x02)';
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
    INVALID_0x02_WITHDRAWAL_CREDENTIALS_LAYOUT,
    INVALID_0x01_WITHDRAWAL_CREDENTIALS_LAYOUT,
    INVALID_WITHDRAWAL_CREDENTIALS_NOT_TARGET_STAKER,
    INVALID_BLS_WITHDRAWAL_CREDENTIALS_ALL_ZERO,
    INVALID_UNSUPPORTED_WITHDRAWAL_CREDENTIALS_PREFIX,
    INVALID_BLS_SIGNATURE_LENGTH,
    INVALID_DEPOSIT_DATA_ROOT_LENGTH,
    INVALID_DEPOSIT_DATA_ROOT_NOT_MATCH_SSZ_ROOT,
    SIGNING_ROOT_FAILED,
    BLS_VERIFICATION_ERROR,
    BLS_SIGNATURE_DID_NOT_VERIFY,
    INVALID_0x02_DEPOSIT_VALUE_NOT_WHOLE_NUMBER_OF_ETH,
    INVALID_0x02_TOP_UP_VALUE_BELOW_MINIMUM,
  },
};
