/**
 * Writes src/validators/evm/__fixtures__/eth2-deposit-unsigned-hex.json
 *
 * @nobles/curves doesn't go well with Jest (commonJS)
 * We use this script to generate the fixtures so we don't have to pull @noble/curves into Jest
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildEth2DepositApiResponse } from '../src/utils/build-eth2-tx';

const staker = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function main() {
  const out: Record<string, string> = {};
  const add = async (
    key: string,
    p: Parameters<typeof buildEth2DepositApiResponse>[0],
  ) => {
    const api = await buildEth2DepositApiResponse(p);
    out[key] = api.data.transactions[0].encodedTx;
  };
  await add('mainnet_32eth_0x01', {
    withdrawalAddress: staker,
    network: 'mainnet',
    amountEth: 32n,
    credentialType: 0x01,
  });
  await add('mainnet_32eth_0x02', {
    withdrawalAddress: staker,
    network: 'mainnet',
    amountEth: 32n,
    credentialType: 0x02,
  });
  await add('mainnet_64eth_0x02', {
    withdrawalAddress: staker,
    network: 'mainnet',
    amountEth: 64n,
    credentialType: 0x02,
  });
  await add('mainnet_8eth_topup_0x02', {
    withdrawalAddress: staker,
    network: 'mainnet',
    amountEth: 8n,
  });

  const dir = join(__dirname, '../src/validators/evm/__fixtures__');
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, 'eth2-deposit-unsigned-hex.json');
  writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log('Wrote', dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
