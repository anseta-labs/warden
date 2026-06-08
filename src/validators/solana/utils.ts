import { PublicKey } from '@solana/web3.js';
import { ActionArguments } from '../../types';

function isValidBase58Pubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

function getDiscriminator(data: Buffer | Uint8Array): number {
  return data.length >= 4 ? Buffer.from(data).readUInt32LE(0) : -1;
}

// Solana `short_vec`-encoded length prefix (signature count before message)
function readShortVecLength(
  buf: Buffer,
  offset = 0,
): [length: number, bytesUsed: number] {
  let len = 0;
  let size = 0;
  for (;;) {
    const elem = buf[offset + size];
    if (elem === undefined) {
      throw new RangeError('short_vec length: truncated buffer');
    }
    len |= (elem & 0x7f) << (size * 7);
    size += 1;
    if ((elem & 0x80) === 0) break;
    if (size > 5) throw new RangeError('short_vec length: invalid encoding');
  }
  return [len, size];
}

function validatorVotePubkey(args?: ActionArguments): string | undefined {
  const v =
    typeof args?.validatorAddress === 'string'
      ? args.validatorAddress.trim()
      : typeof args?.validatorPublicKey === 'string'
        ? args.validatorPublicKey.trim()
        : '';
  return v || undefined;
}

function lamportsAmount(args?: ActionArguments): string | undefined {
  const a = typeof args?.amount === 'string' ? args.amount.trim() : '';
  return a || undefined;
}

export {
  isValidBase58Pubkey,
  getDiscriminator,
  readShortVecLength,
  validatorVotePubkey,
  lamportsAmount,
};
