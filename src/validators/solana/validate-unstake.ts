import {
  StakeInstruction,
  SystemInstruction,
  Transaction,
} from '@solana/web3.js';
import type { ActionArguments } from '../../types';
import { ERRORS } from '../../constants/messages/errors';
import {
  STAKE_DISC,
  STAKE_PROGRAM_ID,
  SYS_DISC,
  SYSTEM_PROGRAM_ID,
  SYSVAR_CLOCK,
  PARTIAL_UNSTAKE_INSTRUCTION_COUNT,
  FULL_UNSTAKE_INSTRUCTION_COUNT,
} from './constants';
import type { SolanaNetwork } from './networks';
import type { BaseValidatorValidationResult } from '../../types';
import {
  getDiscriminator,
  isValidBase58Pubkey,
  lamportsAmount,
  readShortVecLength,
} from './utils';

/**
 * Static validation for Solana stake undelegation.
 *
 * Routes to the correct validator based on instruction count:
 *   1 instruction  -> full unstake   (Deactivate only)
 *   3 instructions -> partial unstake (CreateAccountWithSeed -> Split -> Deactivate)
 */
export function validateSolanaUnstake(
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

  //  Decode once to inspect instruction count
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

  //  Route based on instruction count
  const count = decoded.instructions.length;
  switch (count) {
    case FULL_UNSTAKE_INSTRUCTION_COUNT:
      return validateSolanaFullUnstake(
        unsignedTransaction,
        userAddress,
        requestChainId,
        network,
        args,
      );

    case PARTIAL_UNSTAKE_INSTRUCTION_COUNT:
      return validateSolanaPartialUnstake(
        unsignedTransaction,
        userAddress,
        requestChainId,
        network,
        args,
      );

    default:
      return {
        ok: false,
        reason:
          `Unexpected instruction count for unstake: ${count}. ` +
          `Expected ${FULL_UNSTAKE_INSTRUCTION_COUNT} (full unstake) or ` +
          `${PARTIAL_UNSTAKE_INSTRUCTION_COUNT} (partial unstake).`,
      };
  }
}

/**
 * Static validation for a **legacy** Solana transaction (base64) that performs
 * a partial native stake undelegation: `CreateAccountWithSeed` -> `Split` -> `Deactivate`.
 *
 * This is the partial unstake path - a portion of the stake is split off into a
 * new account which is immediately deactivated. The original source stake account
 * remains active and delegated.
 *
 * - `unsignedTransaction` - base64 encoded transaction
 * - `userAddress`         - staker's Solana wallet (base58), from the request payload
 * - `requestChainId`      - 101 for mainnet-beta, from the request payload
 * - `args.amount`         - lamports to split (decimal string), from the request payload.
 *                           Checked against the Split instruction lamports in the tx -
 *                           if the API tampers with the split amount, this catches it.
 *
 * Note: the source stake account is API-chosen at runtime based on the user's
 * active delegations. It is not user-supplied and therefore not validated here.
 * The staker authority on the Split instruction is checked to confirm the user
 * controls the source account.
 */
export function validateSolanaPartialUnstake(
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

  const amountStr = lamportsAmount(args);
  if (!amountStr) {
    return {
      ok: false,
      reason:
        'Missing split amount: set args.amount (lamports as a decimal string)',
    };
  }

  if (!isValidBase58Pubkey(userAddress.trim())) {
    return {
      ok: false,
      reason: `Invalid userAddress (staker): ${userAddress}`,
    };
  }

  let expectedSplitLamports: bigint;
  try {
    expectedSplitLamports = BigInt(amountStr);
    if (expectedSplitLamports <= 0n) throw new Error('non-positive');
  } catch {
    return {
      ok: false,
      reason: `Invalid args.amount (lamports): ${amountStr}`,
    };
  }

  const staker = userAddress.trim();

  //  Decode encodedTx
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

  //  Transaction-level checks
  const feePayer = decoded.feePayer?.toBase58();
  if (feePayer !== staker) {
    return {
      ok: false,
      reason: `feePayer must be the staker. got ${feePayer ?? '(none)'}, expected ${staker}`,
    };
  }

  if (!decoded.recentBlockhash) {
    return { ok: false, reason: 'Transaction is missing recentBlockhash' };
  }

  if (decoded.instructions.length !== 3) {
    return {
      ok: false,
      reason:
        `Expected 3 instructions (CreateAccountWithSeed -> Split -> Deactivate), ` +
        `got ${decoded.instructions.length}. ` +
        `Note: ComputeBudget instructions are added by the wallet, not the API.`,
    };
  }

  const [ix0, ix1, ix2] = decoded.instructions;

  //  ix0: System Program CreateAccountWithSeed
  // Creates the new stake account that will receive the split amount.
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

  // New account must be owned by the Stake Program - otherwise it can't be
  // used as a stake account and the Split will fail on-chain.
  if (createDecoded.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason:
        `CreateAccountWithSeed: new account owner must be Stake Program, ` +
        `got ${createDecoded.programId.toBase58()}`,
    };
  }

  // Capture the new split account address - must be consistent across ix1 + ix2.
  const splitAccount = createDecoded.newAccountPubkey.toBase58();

  //  ix1: Stake Program Split
  // Splits args.amount lamports from the source stake account into splitAccount.
  //
  // Note: the lamports in CreateAccountWithSeed (ix0) are the rent-exempt reserve
  // for the new account - NOT the split amount. args.amount maps to Split lamports.
  if (ix1.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 1: expected Stake Program, got ${ix1.programId.toBase58()}`,
    };
  }
  if (getDiscriminator(ix1.data) !== STAKE_DISC.Split) {
    return {
      ok: false,
      reason:
        `Instruction 1: expected Split (disc ${STAKE_DISC.Split}), ` +
        `got ${getDiscriminator(ix1.data)}`,
    };
  }

  let splitDecoded: ReturnType<typeof StakeInstruction.decodeSplit>;
  try {
    splitDecoded = StakeInstruction.decodeSplit({
      keys: ix1.keys,
      programId: ix1.programId,
      data: ix1.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode Split: ${String(e)}`,
    };
  }

  // Split destination must match the account created in ix0
  if (splitDecoded.splitStakePubkey.toBase58() !== splitAccount) {
    return {
      ok: false,
      reason:
        `Split: destination does not match CreateAccountWithSeed new account. ` +
        `got ${splitDecoded.splitStakePubkey.toBase58()}, expected ${splitAccount}`,
    };
  }

  // Staker must be the authority on the source account
  if (splitDecoded.authorizedPubkey.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Split: authority must be the staker. ` +
        `got ${splitDecoded.authorizedPubkey.toBase58()}, expected ${staker}`,
    };
  }

  // Split lamports must match args.amount - this is the amount the user
  // requested to unstake, coming directly from the request payload.
  // Catches any API tampering with the split amount.
  const actualSplitLamports = BigInt(splitDecoded.lamports);
  if (actualSplitLamports !== expectedSplitLamports) {
    return {
      ok: false,
      reason:
        `Split: lamports mismatch. ` +
        `got ${actualSplitLamports}, expected ${expectedSplitLamports} (args.amount)`,
    };
  }

  //  ix2: Stake Program Deactivate
  // Immediately deactivates the new split account, beginning the cooldown period.
  // The source stake account remains active and delegated.
  if (ix2.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 2: expected Stake Program, got ${ix2.programId.toBase58()}`,
    };
  }
  if (getDiscriminator(ix2.data) !== STAKE_DISC.Deactivate) {
    return {
      ok: false,
      reason:
        `Instruction 2: expected Deactivate (disc ${STAKE_DISC.Deactivate}), ` +
        `got ${getDiscriminator(ix2.data)}`,
    };
  }

  let deactivateDecoded: ReturnType<typeof StakeInstruction.decodeDeactivate>;
  try {
    deactivateDecoded = StakeInstruction.decodeDeactivate({
      keys: ix2.keys,
      programId: ix2.programId,
      data: ix2.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode Deactivate: ${String(e)}`,
    };
  }

  // Deactivated account must be the split account from ix0 + ix1
  if (deactivateDecoded.stakePubkey.toBase58() !== splitAccount) {
    return {
      ok: false,
      reason:
        `Deactivate: stake account does not match split account. ` +
        `got ${deactivateDecoded.stakePubkey.toBase58()}, expected ${splitAccount}`,
    };
  }

  // Staker must be the authority
  if (deactivateDecoded.authorizedPubkey.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Deactivate: authority must be the staker. ` +
        `got ${deactivateDecoded.authorizedPubkey.toBase58()}, expected ${staker}`,
    };
  }

  // SysvarClock must be present - required by the Stake Program for Deactivate
  const deactivateAccounts = ix2.keys.map((k) => k.pubkey.toBase58());
  if (!deactivateAccounts.includes(SYSVAR_CLOCK)) {
    return {
      ok: false,
      reason: 'Deactivate: missing required SysvarClock account',
    };
  }

  return { ok: true };
}

/**
 * Static validation for a **legacy** Solana transaction (base64) that performs
 * a full native stake undelegation: a single `Deactivate` instruction.
 *
 * This is the 100% unstake path - the entire stake account is deactivated and
 * enters the cooldown period. No split is involved.
 *
 * - `unsignedTransaction` - base64 encoded transaction
 * - `userAddress`         - staker's Solana wallet (base58), from the request payload
 * - `requestChainId`      - 101 for mainnet-beta, from the request payload
 *
 * Note: `args.amount` is not validated here. For a full unstake the user
 * is deactivating the entire stake account balance - no specific lamport
 * amount is encoded in the Deactivate instruction itself.
 *
 * Note: the stake account being deactivated is API-chosen at runtime.
 * The staker authority check confirms the user controls it.
 */
export function validateSolanaFullUnstake(
  unsignedTransaction: string,
  userAddress: string,
  requestChainId: number | undefined,
  network: SolanaNetwork,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  if (!isValidBase58Pubkey(userAddress.trim())) {
    return {
      ok: false,
      reason: `Invalid userAddress (staker): ${userAddress}`,
    };
  }

  const staker = userAddress.trim();

  //  Decode encodedTx
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

  //  Transaction-level checks
  const feePayer = decoded.feePayer?.toBase58();
  if (feePayer !== staker) {
    return {
      ok: false,
      reason: `feePayer must be the staker. got ${feePayer ?? '(none)'}, expected ${staker}`,
    };
  }

  if (!decoded.recentBlockhash) {
    return { ok: false, reason: 'Transaction is missing recentBlockhash' };
  }

  if (decoded.instructions.length !== 1) {
    return {
      ok: false,
      reason:
        `Expected 1 instruction (Deactivate), got ${decoded.instructions.length}. ` +
        `Note: ComputeBudget instructions are added by the wallet, not the API.`,
    };
  }

  const [ix0] = decoded.instructions;

  //  ix0: Stake Program Deactivate
  if (ix0.programId.toBase58() !== STAKE_PROGRAM_ID) {
    return {
      ok: false,
      reason: `Instruction 0: expected Stake Program, got ${ix0.programId.toBase58()}`,
    };
  }

  if (getDiscriminator(ix0.data) !== STAKE_DISC.Deactivate) {
    return {
      ok: false,
      reason:
        `Instruction 0: expected Deactivate (disc ${STAKE_DISC.Deactivate}), ` +
        `got ${getDiscriminator(ix0.data)}`,
    };
  }

  let deactivateDecoded: ReturnType<typeof StakeInstruction.decodeDeactivate>;
  try {
    deactivateDecoded = StakeInstruction.decodeDeactivate({
      keys: ix0.keys,
      programId: ix0.programId,
      data: ix0.data,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Failed to decode Deactivate: ${String(e)}`,
    };
  }

  // Staker must be the authority on the stake account being deactivated
  if (deactivateDecoded.authorizedPubkey.toBase58() !== staker) {
    return {
      ok: false,
      reason:
        `Deactivate: authority must be the staker. ` +
        `got ${deactivateDecoded.authorizedPubkey.toBase58()}, expected ${staker}`,
    };
  }

  // SysvarClock is required by the Stake Program for Deactivate
  const accounts = ix0.keys.map((k) => k.pubkey.toBase58());
  if (!accounts.includes(SYSVAR_CLOCK)) {
    return {
      ok: false,
      reason: 'Deactivate: missing required SysvarClock account',
    };
  }

  return { ok: true };
}
