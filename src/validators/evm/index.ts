export {
  ETH_MAINNET as ETH_DEPOSIT_MAINNET,
  ETH_HOODI as ETH_DEPOSIT_HOODI,
} from './eth2-staking/networks';
export { EthereumBeaconValidator as EthereumBeaconDepositValidator } from './ethereum-beacon.validator';
export { validateEthBeaconDeposit } from './eth2-staking/validate-eth-deposit';
export { validateEip7002WithdrawalRequest } from './eth2-staking/validate-eip7002-withdrawal';
export type { EthBeaconStaticValidationResult } from './eth2-staking/validation-result';
export {
  EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY,
  EIP7002_WITHDRAWAL_REQUEST_CALLDATA_BYTES,
} from './eth2-staking/constants';
