import { getAddress, getBytes, hexlify } from 'ethers';
import { EthNetwork } from './networks';

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

export function toBytes(x: string | Uint8Array): Uint8Array {
  if (x instanceof Uint8Array) {
    return new Uint8Array(x);
  }
  return new Uint8Array(getBytes(x));
}
