import { BaseValidator } from './base.validator';
import {
  ACTION_ID_ETH_DEPOSIT_HOODI,
  ACTION_ID_ETH_DEPOSIT_MAINNET,
  ACTION_ID_ETH_DEPOSIT_SEPOLIA,
} from './evm/eth2-deposit/constants';
import {
  ETH_DEPOSIT_HOODI,
  ETH_DEPOSIT_MAINNET,
  ETH_DEPOSIT_SEPOLIA,
} from './evm/eth2-deposit/networks';
import { EthereumBeaconDepositValidator } from './evm/ethereum-beacon-deposit.validator';

/**
 * Maps stakeFi action IDs to transaction validators.
 * Add more transaction validators here as they are added to the project
 * actionId could be the named-validator-node-id or the validator-node address
 */
export const validatorRegistry = new Map<string, BaseValidator>([
  [
    ACTION_ID_ETH_DEPOSIT_MAINNET,
    new EthereumBeaconDepositValidator(ETH_DEPOSIT_MAINNET),
  ],
  [
    ACTION_ID_ETH_DEPOSIT_SEPOLIA,
    new EthereumBeaconDepositValidator(ETH_DEPOSIT_SEPOLIA),
  ],
  [
    ACTION_ID_ETH_DEPOSIT_HOODI,
    new EthereumBeaconDepositValidator(ETH_DEPOSIT_HOODI),
  ],
  // for example:
  //   [
  //     "some-named-validator-here",
  //     new CosmosValidator(someParamsHere),
  //   ],
  //   [
  //     "0xvalidator-node-address-here",
  //     new SomeNetworkValidator(someParamsHere),
  //   ],
]);
