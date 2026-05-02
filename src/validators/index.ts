import { BaseValidator } from './base.validator';
import { TransactionType } from '../types';
import { ETH_HOODI, ETH_MAINNET } from './evm/eth2-staking/networks';
import { EthereumBeaconValidator } from './evm/ethereum-beacon.validator';

/**
 * Map key: `${chainId}:${TransactionType}` (see {@link makeValidatorRegistryKey}).
 * Register a validator for each (chain, operation) pair the library supports.

 *
 * for example:
 *    [
 *      "some-named-validator-here",
 *      new CosmosValidator(someParamsHere),
 *    ],
 *    [
 *      "0xvalidator-node-address-here",
 *      new SomeNetworkValidator(someParamsHere),
 *    ],
 *
 */
export const validatorRegistry = new Map<string, BaseValidator>();

/**
 * Build the registry key used for {@link validatorRegistry} and {@link Warden}.
 */
export function makeValidatorRegistryKey(
  chainId: number,
  transactionType: TransactionType,
): string {
  return `${chainId}:${transactionType}`;
}

const ethereumMainnetValidator = new EthereumBeaconValidator(ETH_MAINNET);
const ethereumHoodiValidator = new EthereumBeaconValidator(ETH_HOODI);

validatorRegistry.set(
  makeValidatorRegistryKey(ETH_MAINNET.chainId, TransactionType.DEPOSIT),
  ethereumMainnetValidator,
);
validatorRegistry.set(
  makeValidatorRegistryKey(ETH_MAINNET.chainId, TransactionType.WITHDRAW),
  ethereumMainnetValidator,
);
validatorRegistry.set(
  makeValidatorRegistryKey(ETH_MAINNET.chainId, TransactionType.FORCE_EXIT),
  ethereumMainnetValidator,
);

validatorRegistry.set(
  makeValidatorRegistryKey(ETH_HOODI.chainId, TransactionType.DEPOSIT),
  ethereumHoodiValidator,
);
validatorRegistry.set(
  makeValidatorRegistryKey(ETH_HOODI.chainId, TransactionType.WITHDRAW),
  ethereumHoodiValidator,
);
validatorRegistry.set(
  makeValidatorRegistryKey(ETH_HOODI.chainId, TransactionType.FORCE_EXIT),
  ethereumHoodiValidator,
);
