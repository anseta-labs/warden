export {
  ETH2_DEPOSIT_CONTRACT_MAINNET,
  ETH2_DEPOSIT_CONTRACT_HOODI,
} from './eth2-staking/constants';
export { EthereumBeaconValidator as EthereumBeaconDepositValidator } from './ethereum-beacon.validator';
export { validateEthBeaconDeposit } from './eth2-staking/validate-eth-deposit';
export { validateEip7002WithdrawalRequest } from './eth2-staking/validate-eip7002-withdrawal';
export {
  EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY,
  EIP7002_WITHDRAWAL_REQUEST_CALLDATA_BYTES,
} from './eth2-staking/constants';
