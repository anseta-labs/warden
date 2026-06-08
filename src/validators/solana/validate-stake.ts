import {
  StakeInstruction,
  SystemInstruction,
  Transaction,
} from '@solana/web3.js';
import type { ActionArguments } from '../../types';
import { ERRORS } from '../../constants/messages/errors';
import {
  STAKE_CONFIG,
  STAKE_DISC,
  STAKE_PROGRAM_ID,
  SYS_DISC,
  SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK,
  SYSVAR_STAKE_HISTORY,
} from './constants';
import type { SolanaNetwork } from './networks';
import type { BaseValidatorValidationResult } from '../../types';
import {
  getDiscriminator,
  isValidBase58Pubkey,
  lamportsAmount,
  readShortVecLength,
  validatorVotePubkey,
} from './utils';

/**
 * Static validation for a **legacy** Solana transaction (base64) that performs
 * native stake delegation: `CreateAccountWithSeed` --> `Initialize` --> `Delegate`.
 *
 * - `unsignedTransaction` - base64 encoded transaction
 * - `userAddress` - staker's Solana wallet (base58)
 * - `requestChainId` - 101 for mainnet-beta
 * - `args.validatorAddress` (or `args.validatorPublicKey`) - validator vote account (base58)
 * - `args.amount` - lamports decimal string matching `CreateAccountWithSeed`
 */
export function validateSolanaNativeStake(
  unsignedTransaction: string,
  userAddress: string,
  requestChainId: number | undefined,
  network: SolanaNetwork,
  args?: ActionArguments,
): BaseValidatorValidationResult {
  const txB64 = unsignedTransaction.trim();
  if (!txB64) {
    return { ok: false, reason: ERRORS.INVALID_UNSIGNED_TX };
  }

  if (!userAddress.trim()) {
    return { ok: false, reason: ERRORS.INVALID_USER_ADDR };
  }

  if (requestChainId != null && requestChainId !== network.chainId) {
    return {
      ok: false,
      reason: ERRORS.INVALID_CHAIN_ID_NOT_MATCH_REQUEST,
    };
  }

  const validatorVote = validatorVotePubkey(args);
  if (!validatorVote) {
    return {
      ok: false,
      reason:
        'Missing validator vote account: set args.validatorAddress (or validatorPublicKey)',
    };
  }

  const amountStr = lamportsAmount(args);
  if (!amountStr) {
    return {
      ok: false,
      reason:
        'Missing stake amount: set args.amount (lamports as a decimal string)',
    };
  }

  if (!isValidBase58Pubkey(userAddress.trim())) {
    return {
      ok: false,
      reason: `Invalid userAddress (staker): ${userAddress}`,
    };
  }
  if (!isValidBase58Pubkey(validatorVote)) {
    return {
      ok: false,
      reason: `Invalid validator vote account: ${validatorVote}`,
    };
  }

  let expectedLamports: bigint;
  try {
    expectedLamports = BigInt(amountStr);
    if (expectedLamports <= 0n) throw new Error('non-positive');
  } catch {
    return {
      ok: false,
      reason: `Invalid args.amount (lamports): ${amountStr}`,
    };
  }

  const staker = userAddress.trim();

  let decoded: Transaction;
  try {
    const txBuf = Buffer.from(txB64, 'base64');

    const [signatureCount, sigPrefixLen] = readShortVecLength(txBuf, 0);
    const signaturesSectionEnd = sigPrefixLen + signatureCount * 64;
    if (signaturesSectionEnd > txBuf.length) {
      return {
        ok: false,
        reason:
          'Serialized transaction truncated (signatures extend past buffer end)',
      };
    }

    const versionProbe = txBuf.readUInt8(signaturesSectionEnd);
    if (versionProbe & 0x80) {
      return {
        ok: false,
        reason:
          `Versioned (v${versionProbe & 0x7f}) transactions are not supported. ` +
          `Only legacy Solana transactions are currently accepted.`,
      };
    }

    decoded = Transaction.from(txBuf);
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode unsigned transaction: ${String(e)}`,
    };
  }

  const feePayer = decoded.feePayer?.toBase58();
  if (feePayer !== staker) {
    return {
      ok: false,
      reason: `feePayer must be the staker. got ${feePayer ?? '(none)'}, expected ${staker}`,
    };
  }

  if (!decoded.recentBlockhash) {
    return {
      ok: false,
      reason: 'Transaction is missing recentBlockhash',
    };
  }

  if (decoded.instructions.length !== 3) {
    return {
      ok: false,
      reason:
        `Expected 3 instructions, got ${decoded.instructions.length}. ` +
        `Note: ComputeBudget instructions are added by the wallet, not the API.`,
    };
  }

  const [ix0, ix1, ix2] = decoded.instructions;

  if (ix0.programId.toBase58() !== SYSTEM_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 0: expected System Program, got ${ix0.programId.toBase58()}`,
    };
  }
  if (getDiscriminator(ix0.data) !== SYS_DISC.CreateAccountWithSeed) {
    return {
      ok: false,
      reason:
        `Instruction 0: expected CreateAccountWithSeed (disc ${SYS_DISC.CreateAccountWithSeed}), ` +
        `got ${getDiscriminator(ix0.data)}`,
    };
  }

  let createDecoded: ReturnType<typeof SystemInstruction.decodeCreateWithSeed>;
  try {
    createDecoded = SystemInstruction.decodeCreateWithSeed({
      keys: ix0.keys,
      programId: ix0.programId,
      data: ix0.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode CreateAccountWithSeed: ${String(e)}`,
    };
  }

  if (createDecoded.fromPubkey.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `CreateAccountWithSeed: funder must be staker. ` +
        `got ${createDecoded.fromPubkey.toBase58()}, expected ${staker}`,
    };
  }
  if (createDecoded.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason:
        `CreateAccountWithSeed: new account owner must be Stake Program, ` +
        `got ${createDecoded.programId.toBase58()}`,
    };
  }

  const actualLamports = BigInt(createDecoded.lamports);
  if (actualLamports !== expectedLamports) {
    return {
      ok: false,
      reason:
        `CreateAccountWithSeed: lamports mismatch. ` +
        `got ${actualLamports}, expected ${expectedLamports}`,
    };
  }

  const stakeAccount = createDecoded.newAccountPubkey.toBase58();

  if (ix1.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 1: expected Stake Program, got ${ix1.programId.toBase58()}`,
    };
  }
  if (getDiscriminator(ix1.data) !== STAKE_DISC.Initialize) {
    return {
      ok: false,
      reason:
        `Instruction 1: expected Initialize (disc ${STAKE_DISC.Initialize}), ` +
        `got ${getDiscriminator(ix1.data)}`,
    };
  }
  if (ix1.keys[0]?.pubkey.toBase58() !== stakeAccount) {
    return {
      ok: false,
      reason:
        `Initialize: stake account mismatch. ` +
        `got ${ix1.keys[0]?.pubkey.toBase58()}, expected ${stakeAccount}`,
    };
  }

  let initDecoded: ReturnType<typeof StakeInstruction.decodeInitialize>;
  try {
    initDecoded = StakeInstruction.decodeInitialize({
      keys: ix1.keys,
      programId: ix1.programId,
      data: ix1.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode Initialize: ${String(e)}`,
    };
  }

  if (initDecoded.authorized.staker.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Initialize: staker authority must be the user. ` +
        `got ${initDecoded.authorized.staker.toBase58()}, expected ${staker}`,
    };
  }
  if (initDecoded.authorized.withdrawer.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Initialize: withdrawer authority must be the user. ` +
        `got ${initDecoded.authorized.withdrawer.toBase58()}, expected ${staker}`,
    };
  }

  if (ix2.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 2: expected Stake Program, got ${ix2.programId.toBase58()}`,
    };
  }
  if (getDiscriminator(ix2.data) !== STAKE_DISC.Delegate) {
    return {
      ok: false,
      reason:
        `Instruction 2: expected Delegate (disc ${STAKE_DISC.Delegate}), ` +
        `got ${getDiscriminator(ix2.data)}`,
    };
  }

  let delegateDecoded: ReturnType<typeof StakeInstruction.decodeDelegate>;
  try {
    delegateDecoded = StakeInstruction.decodeDelegate({
      keys: ix2.keys,
      programId: ix2.programId,
      data: ix2.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode Delegate: ${String(e)}`,
    };
  }

  if (delegateDecoded.stakePubkey.toBase58() !== stakeAccount) {
    return {
      ok: false,
      reason:
        `Delegate: stake account mismatch. ` +
        `got ${delegateDecoded.stakePubkey.toBase58()}, expected ${stakeAccount}`,
    };
  }
  if (delegateDecoded.votePubkey.toBase58() !== validatorVote) {
    return {
      ok: false,
      reason:
        `Delegate: validator vote account does not match args. ` +
        `got ${delegateDecoded.votePubkey.toBase58()}, expected ${validatorVote}`,
    };
  }
  if (delegateDecoded.authorizedPubkey.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Delegate: authority must be the staker. ` +
        `got ${delegateDecoded.authorizedPubkey.toBase58()}, expected ${staker}`,
    };
  }

  const delegateAccounts = ix2.keys.map((k) => k.pubkey.toBase58());
  if (!delegateAccounts.includes(SYSVAR_CLOCK)) {
    return {
      ok: false,
      reason: `Delegate: missing required SysvarClock account`,
    };
  }
  if (!delegateAccounts.includes(SYSVAR_STAKE_HISTORY)) {
    return {
      ok: false,
      reason: `Delegate: missing required SysvarStakeHistory account`,
    };
  }
  if (!delegateAccounts.includes(STAKE_CONFIG)) {
    return {
      ok: false,
      reason: `Delegate: missing required StakeConfig account`,
    };
  }

  return { ok: true };
}
