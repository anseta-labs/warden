import { getAddress, hexlify } from 'ethers';
import {
  GENESIS_FORK_VERSION_HOODI,
  GENESIS_FORK_VERSION_MAINNET,
  GENESIS_FORK_VERSION_SEPOLIA,
} from './constants';

/**
 * EVM L1 chain id + official deposit contract + consensus genesis fork (for BLS DOMAIN).
 */
export type EthDepositNetwork = {
  chainId: number;
  /** Checksummed deposit contract address (execution layer) */
  depositContractAddress: string;
  genesisForkVersion: Uint8Array;
};

const MAINNET = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
const SEPOLIA = '0x7f02C3E3c98b133055B8B348B2Ac625669Ed295D';
const HOODI = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

export const ETH_DEPOSIT_MAINNET: EthDepositNetwork = {
  chainId: 1,
  depositContractAddress: getAddress(MAINNET),
  genesisForkVersion: GENESIS_FORK_VERSION_MAINNET,
};

export const ETH_DEPOSIT_SEPOLIA: EthDepositNetwork = {
  chainId: 11155111,
  depositContractAddress: getAddress(SEPOLIA),
  genesisForkVersion: GENESIS_FORK_VERSION_SEPOLIA,
};

export const ETH_DEPOSIT_HOODI: EthDepositNetwork = {
  chainId: 17000,
  depositContractAddress: getAddress(HOODI),
  genesisForkVersion: GENESIS_FORK_VERSION_HOODI,
};

const byChain = new Map<number, EthDepositNetwork>([
  [ETH_DEPOSIT_MAINNET.chainId, ETH_DEPOSIT_MAINNET],
  [ETH_DEPOSIT_SEPOLIA.chainId, ETH_DEPOSIT_SEPOLIA],
]);

export function getEthDepositNetwork(chainId: number | undefined | null) {
  if (chainId == null || Number.isNaN(chainId)) {
    return undefined;
  }
  return byChain.get(chainId);
}

export function isDepositContract(
  to: string,
  network: EthDepositNetwork,
): boolean {
  return getAddress(to) === network.depositContractAddress;
}

/**
 * 32-byte withdrawal credentials: 0x01 + 0x0 * 11 + 20-byte eth1 address, or 0x00 (BLS).
 */
export function withdrawalCredentialsToEth1Address(
  creds: Uint8Array,
): string | null {
  if (creds.length !== 32) {
    return null;
  }
  if (creds[0] !== 0x01) {
    return null;
  }
  const onlyZeros = creds.subarray(1, 12).every((b) => b === 0);
  if (!onlyZeros) {
    return null;
  }
  return getAddress(hexlify(creds.subarray(12, 32)));
}
