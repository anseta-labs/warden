import { BaseValidator } from './base.validator';
import { TransactionType } from '../types';
import { ETH_HOODI, ETH_MAINNET } from './evm/eth2-staking/networks';
import { EthereumBeaconValidator } from './evm/ethereum-beacon.validator';

/**
 * Map key: `${chainId}:${TransactionType}` (see {@link makeValidatorRegistryKey}).
 * Register a validator for each (chain, operation) pair the library supports.
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

validatorRegistry.set(
  makeValidatorRegistryKey(ETH_MAINNET.chainId, TransactionType.DEPOSIT),
  new EthereumBeaconValidator(ETH_MAINNET),
);

validatorRegistry.set(
  makeValidatorRegistryKey(ETH_HOODI.chainId, TransactionType.DEPOSIT),
  new EthereumBeaconValidator(ETH_HOODI),
);
