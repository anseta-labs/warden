import {
  GENESIS_FORK_VERSION_HOODI,
  GENESIS_FORK_VERSION_MAINNET,
  ETH2_DEPOSIT_CONTRACT_MAINNET,
  ETH2_DEPOSIT_CONTRACT_HOODI,
} from './constants';
import { getAddress } from 'ethers';

// EVM L1 chain id + official deposit contract + consensus genesis fork (for BLS DOMAIN).
export type EthNetwork = {
  chainId: number;
  // Checksummed deposit contract address
  depositContractAddress: string;
  genesisForkVersion: Uint8Array;
};

export const ETH_MAINNET: EthNetwork = {
  chainId: 1,
  depositContractAddress: getAddress(ETH2_DEPOSIT_CONTRACT_MAINNET),
  genesisForkVersion: GENESIS_FORK_VERSION_MAINNET,
};

export const ETH_HOODI: EthNetwork = {
  chainId: 560048,
  depositContractAddress: getAddress(ETH2_DEPOSIT_CONTRACT_HOODI),
  genesisForkVersion: GENESIS_FORK_VERSION_HOODI,
};

const byChain = new Map<number, EthNetwork>([
  [ETH_MAINNET.chainId, ETH_MAINNET],
  [ETH_HOODI.chainId, ETH_HOODI],
]);

export function getEthNetwork(chainId: number | undefined | null) {
  if (chainId == null || Number.isNaN(chainId)) {
    return undefined;
  }
  return byChain.get(chainId);
}
