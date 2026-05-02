/**
 * EIP-7002 withdrawal examples: partial withdrawal (`WITHDRAW`) and full-exit request
 * (`FORCE_EXIT`). Calldata is always 48-byte validator pubkey + uint64 amount in **gwei**
 * (big-endian); `amount == 0` means "sfull exit” on the consensus layer.
 *
 * In production you obtain `unsignedTransaction` from the developer API. Here we build
 * structurally valid txs with helpers from `src/utils/build-eth2-tx.ts`.
 *
 * Run from the package root:
 *   pnpm exec ts-node examples/02_eip7002_partial_and_full_exit.ts
 */

import { hexlify } from 'ethers';
import { Warden, TransactionType } from '../src/index';
import {
  buildEip7002WithdrawalUnsignedSerialized,
  createDemoEip7002ValidatorPubkey,
} from '../src/utils/build-eth2-tx';

const GWEI_WEI = 1_000_000_000n;

function main() {
  const userAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const chainId = 1;
  /** Illustrative EL fee; real networks may require a higher minimum. */
  const requestFeeWei = 1_000_000_000_000n;

  const demoPubkey = createDemoEip7002ValidatorPubkey();
  const pubkeyHex = hexlify(demoPubkey);

  const warden = new Warden();

  // --- Partial withdrawal: calldata amount > 0, validate as WITHDRAW
  const partialAmountGwei = 68n * 10n ** 9n;
  const partialTx = buildEip7002WithdrawalUnsignedSerialized({
    network: 'mainnet',
    validatorPubkey: demoPubkey,
    amountGwei: partialAmountGwei,
    requestFeeWei,
  });

  const partialOk = warden.validate({
    unsignedTransaction: partialTx,
    userAddress,
    chainId,
    transactionType: TransactionType.WITHDRAW,
    args: {
      validatorPublicKey: pubkeyHex,
      amountWei: (partialAmountGwei * GWEI_WEI).toString(),
    },
  });
  if (partialOk.isValid) {
    console.log('[Partial] Valid EIP-7002 partial withdrawal request.');
    console.log('[Partial] detectedType:', partialOk.detectedType);
  } else {
    console.error('[Partial] Validation failed:', partialOk.reason);
  }

  // --- Full exit: calldata amount == 0, validate as FORCE_EXIT (not WITHDRAW)
  const fullExitTx = buildEip7002WithdrawalUnsignedSerialized({
    network: 'mainnet',
    validatorPubkey: demoPubkey,
    amountGwei: 0n,
    requestFeeWei,
  });

  const fullOk = warden.validate({
    unsignedTransaction: fullExitTx,
    userAddress,
    chainId,
    transactionType: TransactionType.FORCE_EXIT,
    args: {
      validatorPublicKey: pubkeyHex,
    },
  });
  if (fullOk.isValid) {
    console.log(
      '[Full exit] Valid EIP-7002 full-exit request (amount field = 0 gwei).',
    );
    console.log('[Full exit] detectedType:', fullOk.detectedType);
  } else {
    console.error('[Full exit] Validation failed:', fullOk.reason);
  }

  // --- Same full-exit calldata must fail under WITHDRAW (partial-only path)
  const wrongType = warden.validate({
    unsignedTransaction: fullExitTx,
    userAddress,
    chainId,
    transactionType: TransactionType.WITHDRAW,
  });
  if (!wrongType.isValid) {
    console.log(
      '[Mismatch] WITHDRAW correctly rejects amount=0 (full-exit sentinel):',
      wrongType.reason,
    );
  } else {
    console.error(
      '[Mismatch] Expected rejection when using WITHDRAW with full-exit calldata.',
    );
  }
}

main();
