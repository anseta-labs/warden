/**
 * EVM-specific validators are registered from `./validators/index.ts`.
 * Eth2 beacon `deposit` flows: `./ethereum-beacon-deposit.validator.ts` and `./eth2-deposit/*`.
 */

export {
  ACTION_ID_ETH_DEPOSIT_MAINNET,
  ACTION_ID_ETH_DEPOSIT_SEPOLIA,
} from './eth2-deposit/constants';
export {
  ETH_DEPOSIT_MAINNET,
  ETH_DEPOSIT_SEPOLIA,
} from './eth2-deposit/networks';
export { EthereumBeaconDepositValidator } from './ethereum-beacon-deposit.validator';
export { validateEthBeaconDeposit } from './eth2-deposit/validate-eth-deposit';
