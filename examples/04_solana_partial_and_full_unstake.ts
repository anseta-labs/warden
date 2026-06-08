/**
 * Solana native unstake: partial (3 instructions) and full (1 instruction).
 *
 * Both flows use the same developer API undelegate request shape; the unsigned
 * tx structure differs by instruction count:
 *   - Partial: CreateAccountWithSeed -> Split -> Deactivate (`args.amount` = split lamports)
 *   - Full:    Deactivate only (`args.amount` is informational; not checked on-chain)
 *
 * In production take `data.transactions[0].encodedTx` from the API response.
 *
 * Run from the package root:
 *   pnpm exec ts-node examples/04_solana_partial_and_full_unstake.ts
 */

import { Warden, TransactionType } from '../src/index';
import { SOLANA_MAINNET } from '../src/validators/solana/networks';

/** Developer API partial-unstake request payload */
const partialUnstakeRequest = {
  amount: '4082278',
  staker: 'BFE3swWkG6Tr5nnUHZjc7EXqeffuxVEo7x1ejhEHfRaf',
  validator: 'CBSrVMzHqnjb1td6diYaqy2Nq1GotkKQBB6i5eaR1ZyR',
  network: 'solana',
  token: 'SOL',
} as const;

/** Developer API full-unstake request payload */
const fullUnstakeRequest = {
  amount: '16329114',
  staker: 'BFE3swWkG6Tr5nnUHZjc7EXqeffuxVEo7x1ejhEHfRaf',
  validator: 'CBSrVMzHqnjb1td6diYaqy2Nq1GotkKQBB6i5eaR1ZyR',
  network: 'solana',
  token: 'SOL',
} as const;

/** Frozen partial-unstake `encodedTx` (3 instructions, split = 4_082_278 lamports). */
const partialEncodedTx =
  'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAMGmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xDxQmIBIPEGcYOh8JlL+eKqMKVFEe91BDN7KqVcjVNF9fmxM00GVsEazPWjEvRh7nUjKo2mno5h/egQ4o16jEVTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGodgXkTdUKpg0N73+KnqyVX9TXIp4citopJ3AAAAAAAan1RcYx3TJKFZjmGkdXraLXrijm0ttXHNVWyEAAAAA6UCOm7KsFvH7mEVHscd0pKP+p33bFxfsbrk0TwL2kwEDAwIAAnADAAAAmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xAUAAAAAAAAAHN0YWtlZml1bnN0a21xMDhtMzN2gNUiAAAAAADIAAAAAAAAAAah2BeRN1QqmDQ3vf4qerJVf1NcinhyK2ikncAAAAAABAMBAgAMAwAAAGZKPgAAAAAABAMCBQAEBQAAAA==';

/** Frozen full-unstake `encodedTx` (1 instruction: Deactivate). */
const fullEncodedTx =
  'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAIEmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xDxQmIBIPEGcYOh8JlL+eKqMKVFEe91BDN7KqVcjVNF9Qah2BeRN1QqmDQ3vf4qerJVf1NcinhyK2ikncAAAAAABqfVFxjHdMkoVmOYaR1etoteuKObS21cc1VbIQAAAADan7TTRN1oEKhPu9JrLvSNPvP9TI8YCWtK3pPWsD00RwECAwEDAAQFAAAA';

function main() {
  const warden = new Warden();
  const chainId = SOLANA_MAINNET.chainId;

  // --- Partial unstake: 3 instructions, args.amount must match Split lamports
  const partialOk = warden.validate({
    unsignedTransaction: partialEncodedTx,
    userAddress: partialUnstakeRequest.staker,
    chainId,
    transactionType: TransactionType.UNSTAKE,
    args: {
      amount: partialUnstakeRequest.amount,
    },
  });

  if (partialOk.isValid) {
    console.log('[Partial] Valid partial unstake tx (Split -> Deactivate).');
    console.log('[Partial] detectedType:', partialOk.detectedType);
  } else {
    console.error('[Partial] Validation failed:', partialOk.reason);
  }

  const partialBadAmount = warden.validate({
    unsignedTransaction: partialEncodedTx,
    userAddress: partialUnstakeRequest.staker,
    chainId,
    transactionType: TransactionType.UNSTAKE,
    args: { amount: '1' },
  });

  if (!partialBadAmount.isValid) {
    console.log(
      '[Partial mismatch] Inflated args.amount correctly rejected:',
      partialBadAmount.reason,
    );
  } else {
    console.error(
      '[Partial mismatch] Expected rejection when Split lamports != args.amount.',
    );
  }

  // --- Full unstake: 1 instruction (Deactivate only)
  const fullOk = warden.validate({
    unsignedTransaction: fullEncodedTx,
    userAddress: fullUnstakeRequest.staker,
    chainId,
    transactionType: TransactionType.UNSTAKE,
    args: {}, // args.amount is not required for full unstake
  });

  if (fullOk.isValid) {
    console.log('[Full] Valid full unstake tx (Deactivate only).');
    console.log('[Full] detectedType:', fullOk.detectedType);
  } else {
    console.error('[Full] Validation failed:', fullOk.reason);
  }
}

main();
