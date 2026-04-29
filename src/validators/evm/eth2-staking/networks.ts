import { getAddress, hexlify } from 'ethers';
import {
  GENESIS_FORK_VERSION_HOODI,
  GENESIS_FORK_VERSION_MAINNET,
} from './constants';

// EVM L1 chain id + official deposit contract + consensus genesis fork (for BLS DOMAIN).
export type EthNetwork = {
  chainId: number;
  // Checksummed deposit contract address
  depositContractAddress: string;
  genesisForkVersion: Uint8Array;
};

const MAINNET = '0x00000000219ab540356cBB839Cbe05303d7705Fa';
const HOODI = '0x00000000219ab540356cBB839Cbe05303d7705Fa';

export const ETH_MAINNET: EthNetwork = {
  chainId: 1,
  depositContractAddress: getAddress(MAINNET),
  genesisForkVersion: GENESIS_FORK_VERSION_MAINNET,
};

export const ETH_HOODI: EthNetwork = {
  chainId: 560048,
  depositContractAddress: getAddress(HOODI),
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

export function isDepositContract(to: string, network: EthNetwork): boolean {
  return getAddress(to) === network.depositContractAddress;
}

// 32-byte execution-layer withdrawal: 0x01 or 0x02, then 11 zero bytes, then 20-byte address.
export function withdrawalCredentialsToExecutionAddress(
  creds: Uint8Array,
): string | null {
  if (creds.length !== 32) {
    return null;
  }
  if (creds[0] !== 0x01 && creds[0] !== 0x02) {
    return null;
  }
  const onlyZeros = creds.subarray(1, 12).every((b) => b === 0);
  if (!onlyZeros) {
    return null;
  }
  return getAddress(hexlify(creds.subarray(12, 32)));
}

// 32-byte withdrawal credentials: 0x01 + 0x0 * 11 + 20-byte eth1 address, or 0x00 (BLS).
export function withdrawalCredentialsToEth1Address(
  creds: Uint8Array,
): string | null {
  if (creds.length !== 32) {
    return null;
  }
  if (creds[0] !== 0x01) {
    return null;
  }
  return withdrawalCredentialsToExecutionAddress(creds);
}
