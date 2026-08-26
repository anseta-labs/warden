/**
 * Basic example: validate an unsigned EIP-1559 transaction that calls the official
 * beacon deposit contract with post-Pectra (0x02) withdrawal credentials.
 *
 * In production you obtain `unsignedTransaction` from our developer API (Anseta
 * developer API). Here we build a structurally identical deposit using some utils.
 *
 * Run from the package root:
 *   pnpm exec ts-node examples/01_basic_eth2_deposit.ts
 */

import { Warden, TransactionType } from '../src/index'; // or import { Warden, TransactionType } from '@anseta/warden';
import { buildEth2DepositApiResponse } from '../src/utils/build-eth2-tx';

async function main() {
  // Wallet that will sign the tx - 0x01 / 0x02 withdrawal credentials must target this address.
  const userAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  // Simulate a dev-API response: 32 ETH new deposit with 0x02 (Pectra compounding) credentials.
  const apiResponse = await buildEth2DepositApiResponse({
    withdrawalAddress: userAddress,
    network: 'mainnet',
    amountEth: 32n,
    credentialType: 0x02,
  });

  const entry = apiResponse.data.transactions[0];
  const { encodedTx } = entry;
  const raw = entry.tx;
  const unsignedTransaction = encodedTx;
  const chainId = Number(raw.chainId);

  const warden = new Warden();
  const result = warden.validate({
    unsignedTransaction,
    userAddress,
    chainId,
    transactionType: TransactionType.DEPOSIT,
  });

  if (result.isValid) {
    console.log(
      '[Tx1] Valid deposit transaction (post-Pectra 0x02 credentials).',
    );
    console.log('[Tx1] detectedType:', result.detectedType);
  } else {
    console.error('[Tx1] Validation failed:', result.reason);
    if (result.details) {
      console.error('[Tx1] details:', result.details);
    }
  }

  // Attack vector: Attacker tries to switch the withdrawal address to their own address
  const attackerAddress = '0x1659D5616D741B3AC9DbF940d0A9E92fCeFffd5d';
  const attackerApiResponse = await buildEth2DepositApiResponse({
    withdrawalAddress: attackerAddress,
    network: 'mainnet',
    amountEth: 32n,
    credentialType: 0x02,
  });
  const attackerEntry = attackerApiResponse.data.transactions[0];
  const { encodedTx: attackerEncodedTx } = attackerEntry;
  const attackerRaw = attackerEntry.tx;
  const attackerUnsignedTransaction = attackerEncodedTx;
  const attackerChainId = Number(attackerRaw.chainId);

  const attackerResult = warden.validate({
    unsignedTransaction: attackerUnsignedTransaction,
    userAddress: userAddress, // You pass the user address to validate the transaction against (i.e your own address)
    chainId: attackerChainId,
    transactionType: TransactionType.DEPOSIT,
  });

  if (attackerResult.isValid) {
    console.log(
      '[Tx2] Valid deposit transaction (post-Pectra 0x02 credentials).',
    );
    console.log('[Tx2] detectedType:', attackerResult.detectedType);
  } else {
    console.error('[Tx2] Validation failed:', attackerResult.reason);
    if (attackerResult.details) {
      console.error('[Tx2] details:', attackerResult.details);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
