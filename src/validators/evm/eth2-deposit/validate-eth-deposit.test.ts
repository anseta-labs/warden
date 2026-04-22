import { Interface, Transaction } from 'ethers';
import { DEPOSIT_FUNC } from './constants';
import { ETH_DEPOSIT_MAINNET } from './networks';
import { validateEthBeaconDeposit } from './validate-eth-deposit';

function makeUnsignedEip1559Tx(params: {
  to: string;
  valueWei: bigint;
  data: string;
  chainId: number;
}) {
  const t = Transaction.from({
    type: 2,
    to: params.to,
    value: params.valueWei,
    data: params.data,
    chainId: params.chainId,
    nonce: 0,
    gasLimit: 500_000n,
    maxFeePerGas: 50n * 10n ** 9n,
    maxPriorityFeePerGas: 1n * 10n ** 9n,
  });
  return t.unsignedSerialized;
}

describe('validateEthBeaconDeposit', () => {
  it('fails on invalid transaction hex', () => {
    const r = validateEthBeaconDeposit(
      '0x',
      '0x' + '11'.repeat(20),
      1,
      ETH_DEPOSIT_MAINNET,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.stage).toBe('tx_shape');
    }
  });

  it('fails when "to" is not the deposit contract', () => {
    const data = new Interface([DEPOSIT_FUNC]).encodeFunctionData('deposit', [
      '0x' + '00'.repeat(48),
      '0x' + '00'.repeat(32),
      '0x' + '00'.repeat(96),
      '0x' + '00'.repeat(32),
    ]);
    const txHex = makeUnsignedEip1559Tx({
      to: '0x0000000000000000000000000000000000000001',
      valueWei: 32n * 10n ** 18n,
      data,
      chainId: 1,
    });
    const r = validateEthBeaconDeposit(
      txHex,
      '0x' + '11'.repeat(20),
      1,
      ETH_DEPOSIT_MAINNET,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.stage).toBe('tx_shape');
    }
  });
});
