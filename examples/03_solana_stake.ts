/**
 * Solana native stake: validate an unsigned legacy transaction that performs
 * CreateAccountWithSeed -> Initialize -> Delegate.
 *
 * In production you POST a stake request to the developer API, then take
 * `data.transactions[0].encodedTx` (base64) as `unsignedTransaction`.
 * Here we use a frozen capture from a real API response.
 *
 * Run from the package root:
 *   pnpm exec ts-node examples/03_solana_stake.ts
 */

import { Warden, TransactionType } from '../src/index';
import { SOLANA_MAINNET } from '../src/validators/solana/networks';

/** Developer API stake request payload */
const stakeRequest = {
  amount: '14994751',
  staker: 'BFE3swWkG6Tr5nnUHZjc7EXqeffuxVEo7x1ejhEHfRaf',
  validator: 'CBSrVMzHqnjb1td6diYaqy2Nq1GotkKQBB6i5eaR1ZyR',
  network: 'solana',
  token: 'SOL',
} as const;

/** Frozen encoded tx from the developer API response */
const encodedTx =
  'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAcJmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xCvpN2nOhmLnsaTA2unK5BkQyZ8425rHkLVrNjRJbdQ1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAph2YvkU3gCFZ7YWApBGtAc1fpQNJZLURpHNEhGWIGKgGodgXkTdUKpg0N73+KnqyVX9TXIp4citopJ3AAAAAAAah2BelAgULaAeR5s5tuI4eW3FQ9h/GeQpOtNEAAAAABqfVFxjHdMkoVmOYaR1etoteuKObS21cc1VbIQAAAAAGp9UXGSxcUSGMyUw9SvF/WNruCJuh/UTj29mKAAAAAAan1RcZNYTQ/u2bs0MdEyBr5UQoG1e4VmzFN1/0AAAAMgdv81bLU7lD8EexLJdBwBlnf0V7Z56/5D7wNSrLD3sDAgIAAXMDAAAAmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xAXAAAAAAAAAHN0YWtlZmlDQlNyVk16SG1xMGV0eDQ1P83kAAAAAADIAAAAAAAAAAah2BeRN1QqmDQ3vf4qerJVf1NcinhyK2ikncAAAAAABAIBB3QAAAAAmDnBf1MHmD68pHDY/66aYm2B8zrHgyld8nyhMLXv0xCYOcF/UweYPrykcNj/rppibYHzOseDKV3yfKEwte/TEAAAAAAAAAAAAAAAAAAAAACYOcF/UweYPrykcNj/rppibYHzOseDKV3yfKEwte/TEAQGAQMGCAUABAIAAAA=';

function main() {
  const warden = new Warden();

  const result = warden.validate({
    unsignedTransaction: encodedTx,
    userAddress: stakeRequest.staker,
    chainId: SOLANA_MAINNET.chainId,
    transactionType: TransactionType.STAKE,
    args: {
      validatorAddress: stakeRequest.validator,
      amount: stakeRequest.amount,
    },
  });

  if (result.isValid) {
    console.log('[Tx1] Valid solana stake delegation tx.');
    console.log('[Tx1] detectedType:', result.detectedType);
  } else {
    console.error('[Tx1] Validation failed:', result.reason);
    if (result.details) console.error('[Tx1] details:', result.details);
  }

  // Attack vector: Attacker tries to switch the validator address to their own address
  const wrongValidator = warden.validate({
    unsignedTransaction: encodedTx,
    userAddress: stakeRequest.staker,
    chainId: SOLANA_MAINNET.chainId,
    transactionType: TransactionType.STAKE,
    args: {
      validatorAddress: 'Vote111111111111111111111111111111111111111',
      amount: stakeRequest.amount,
    },
  });

  if (!wrongValidator.isValid) {
    console.log(
      '[Tx2] Wrong validatorAddress correctly rejected:',
      wrongValidator.reason,
    );
  } else {
    console.error(
      '[Tx2] Expected rejection when args.validatorAddress does not match tx.',
    );
  }

  // Attack vector: args.amount does not match lamports in the unsigned tx
  const wrongAmount = warden.validate({
    unsignedTransaction: encodedTx,
    userAddress: stakeRequest.staker,
    chainId: SOLANA_MAINNET.chainId,
    transactionType: TransactionType.STAKE,
    args: {
      validatorAddress: stakeRequest.validator,
      amount: '10000000',
    },
  });

  if (!wrongAmount.isValid) {
    console.log(
      '[Tx3] Request amount without matching tx lamports correctly rejected:',
      wrongAmount.reason,
    );
  } else {
    console.error(
      '[Tx3] Expected rejection when args.amount does not match tx lamports.',
    );
  }
}

main();
