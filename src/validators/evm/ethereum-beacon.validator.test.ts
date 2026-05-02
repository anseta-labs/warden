/**
 * Valid unsigned txs are frozen in `__fixtures__/eth2-deposit-unsigned-hex.json`.
 * Regenerate after changing `buildEth2DepositApiResponse`:
 *   pnpm run generate-eth2-fixtures
 */
import { getBytes, hexlify, Interface, Transaction } from 'ethers';
import { TransactionType } from '../../types';
import {
  DEPOSIT_FUNC_NAME,
  DEPOSIT_FUNC_SIGNATURE,
  EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY,
  GWEI,
} from './eth2-staking/constants';
import { ETH_MAINNET } from './eth2-staking/networks';
import { hashDepositDataTreeRoot } from './eth2-staking/ssz-roots';
import depositFixtures from './__fixtures__/eth2-deposit-unsigned-hex.json';
import { EthereumBeaconValidator } from './ethereum-beacon.validator';

const depositIf = new Interface([DEPOSIT_FUNC_SIGNATURE]);
const staker = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const attacker = '0x0000000000000000000000000000000000000001';

function mainnetContext(chainId = ETH_MAINNET.chainId) {
  return { chainId };
}

function cloneTx(unsignedHex: string, patch: Partial<Transaction>): string {
  const tx = Transaction.from(unsignedHex);
  return Transaction.from({
    type: tx.type,
    to: patch.to ?? tx.to,
    value: patch.value ?? tx.value,
    data: patch.data ?? tx.data,
    chainId: patch.chainId ?? tx.chainId,
    nonce: patch.nonce ?? tx.nonce,
    gasLimit: patch.gasLimit ?? tx.gasLimit,
    maxFeePerGas: patch.maxFeePerGas ?? tx.maxFeePerGas,
    maxPriorityFeePerGas: patch.maxPriorityFeePerGas ?? tx.maxPriorityFeePerGas,
  }).unsignedSerialized;
}

function decodeDepositCalldata(data: string) {
  const d = depositIf.decodeFunctionData(
    DEPOSIT_FUNC_NAME,
    data,
  ) as unknown as [string, string, string, string];
  return {
    pubkey: new Uint8Array(getBytes(d[0])),
    withdrawalCredentials: new Uint8Array(getBytes(d[1])),
    signature: new Uint8Array(getBytes(d[2])),
    depositDataRoot: new Uint8Array(getBytes(d[3])),
  };
}

function encodeDepositCalldata(parts: {
  pubkey: Uint8Array;
  withdrawalCredentials: Uint8Array;
  signature: Uint8Array;
  depositDataRoot: Uint8Array;
}): string {
  return depositIf.encodeFunctionData(DEPOSIT_FUNC_NAME, [
    hexlify(parts.pubkey),
    hexlify(parts.withdrawalCredentials),
    hexlify(parts.signature),
    hexlify(parts.depositDataRoot),
  ]);
}

const sampleWithdrawalPubkey = decodeDepositCalldata(
  Transaction.from(depositFixtures.mainnet_32eth_0x01).data,
).pubkey;

const otherDepositPubkey = decodeDepositCalldata(
  Transaction.from(depositFixtures.mainnet_32eth_0x02).data,
).pubkey;

function buildEip7002UnsignedTx(params: {
  chainId: number;
  pubkey: Uint8Array;
  amountGwei: bigint;
  valueWei: bigint;
  to?: string;
  dataSliceLen?: number;
}): string {
  const amountBe = new Uint8Array(8);
  let v = params.amountGwei;
  for (let i = 7; i >= 0; i--) {
    amountBe[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  const full = new Uint8Array(56);
  full.set(params.pubkey, 0);
  full.set(amountBe, 48);
  const data =
    params.dataSliceLen != null
      ? hexlify(full.subarray(0, params.dataSliceLen))
      : hexlify(full);
  return Transaction.from({
    type: 2,
    to: params.to ?? EIP7002_WITHDRAWAL_REQUEST_PREDEPLOY,
    value: params.valueWei,
    data,
    chainId: params.chainId,
    nonce: 0,
    gasLimit: 150_000n,
    maxFeePerGas: 50n * 10n ** 9n,
    maxPriorityFeePerGas: 1n * 10n ** 9n,
  }).unsignedSerialized;
}

describe('EthereumBeaconValidator', () => {
  const validator = new EthereumBeaconValidator(ETH_MAINNET);

  describe('Deposits', () => {
    function validateDeposit(
      unsignedHex: string,
      userAddress: string,
      ctx = mainnetContext(),
    ) {
      return validator.validate(
        unsignedHex,
        TransactionType.DEPOSIT,
        userAddress,
        undefined,
        ctx,
      );
    }

    it('accepts valid 32 ETH deposit with 0x01 credentials', () => {
      const r = validateDeposit(depositFixtures.mainnet_32eth_0x01, staker);
      expect(r.isValid).toBe(true);
    });

    it('accepts valid 32 ETH deposit with 0x02 (Pectra) credentials', () => {
      const r = validateDeposit(depositFixtures.mainnet_32eth_0x02, staker);
      expect(r.isValid).toBe(true);
    });

    it('accepts valid 64 ETH new compounding deposit with 0x02 credentials', () => {
      const r = validateDeposit(depositFixtures.mainnet_64eth_0x02, staker);
      expect(r.isValid).toBe(true);
    });

    it('accepts valid 8 ETH 0x02 top-up', () => {
      const r = validateDeposit(
        depositFixtures.mainnet_8eth_topup_0x02,
        staker,
      );
      expect(r.isValid).toBe(true);
    });

    it('rejects when withdrawal credentials target a different address than userAddress', () => {
      const r = validateDeposit(depositFixtures.mainnet_32eth_0x01, attacker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(
        /Withdrawal credentials do not target the staker/,
      );
    });

    it('rejects when tx.to is not the official deposit contract', () => {
      const hacked = cloneTx(depositFixtures.mainnet_32eth_0x01, {
        to: attacker,
      });
      const r = validateDeposit(hacked, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/not the official beacon deposit contract/);
    });

    it('rejects when transaction chainId does not match mainnet validator network (e.g. 560048 Hoodi)', () => {
      const wrongChain = cloneTx(depositFixtures.mainnet_32eth_0x01, {
        chainId: 560048n,
      });
      const r = validateDeposit(wrongChain, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/chainId does not match network configuration/);
    });

    it('rejects when msg.value is inflated vs calldata (deposit_data_root / amount mismatch)', () => {
      const tx = Transaction.from(depositFixtures.mainnet_32eth_0x01);
      const inflated = cloneTx(depositFixtures.mainnet_32eth_0x01, {
        value: tx.value * 10n,
      });
      const r = validateDeposit(inflated, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/deposit_data_root does not match SSZ/);
    });

    it('rejects when deposit_data_root has a flipped byte (SSZ recompute mismatch)', () => {
      const hex = depositFixtures.mainnet_32eth_0x02;
      const tx = Transaction.from(hex);
      const d = decodeDepositCalldata(tx.data);
      const badRoot = new Uint8Array(d.depositDataRoot);
      badRoot[0] ^= 0xff;
      const data = encodeDepositCalldata({ ...d, depositDataRoot: badRoot });
      const tampered = cloneTx(hex, { data });
      const r = validateDeposit(tampered, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/deposit_data_root does not match SSZ/);
    });

    it('rejects when signature is invalid but deposit_data_root matches corrupted tuple (BLS verify fails)', () => {
      const hex = depositFixtures.mainnet_32eth_0x02;
      const tx = Transaction.from(hex);
      const d = decodeDepositCalldata(tx.data);
      const gwei = Number(tx.value / GWEI);
      const badSig = new Uint8Array(d.signature);
      badSig[badSig.length - 1] ^= 0x01; // tampered signature!
      const coherentRoot = hashDepositDataTreeRoot({
        pubkey: d.pubkey,
        withdrawalCredentials: d.withdrawalCredentials,
        amount: gwei,
        signature: badSig,
      });
      const data = encodeDepositCalldata({
        ...d,
        signature: badSig,
        depositDataRoot: coherentRoot,
      });
      const tampered = cloneTx(hex, { data });
      const r = validateDeposit(tampered, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(
        /BLS (signature did not verify|verification error)/,
      );
    });

    it('rejects 0x02 deposit when value is not a whole number of ETH', () => {
      const hex = depositFixtures.mainnet_8eth_topup_0x02;
      const tx = Transaction.from(hex);
      const nonWholeEth = cloneTx(hex, { value: tx.value + GWEI });
      const r = validateDeposit(nonWholeEth, staker);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/whole number of ETH/);
    });

    it('rejects unsupported transaction type (e.g. STAKE)', () => {
      const r = validator.validate(
        depositFixtures.mainnet_32eth_0x01,
        TransactionType.STAKE,
        staker,
        undefined,
        mainnetContext(),
      );
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(
        /Only DEPOSIT, WITHDRAW, FORCE_EXIT are supported/,
      );
    });

    it('rejects when Warden context chainId does not match this validator network', () => {
      const r = validator.validate(
        depositFixtures.mainnet_32eth_0x01,
        TransactionType.DEPOSIT,
        staker,
        undefined,
        { chainId: 560048 },
      );
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(
        /Request chainId does not match this validator network/,
      );
    });
  });

  describe('Partial Withdrawals (EIP-7002)', () => {
    const sixtyEightEthGwei = 68n * 10n ** 9n;
    const withdrawalFeeWei = 1_000_000_000_000n;

    function validateWithdraw(
      hex: string,
      args?: { validatorPublicKey?: string; amountWei?: string },
    ) {
      return validator.validate(
        hex,
        TransactionType.WITHDRAW,
        staker,
        args,
        mainnetContext(),
      );
    }

    it('accepts a valid EIP-7002 partial withdrawal request tx', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      expect(validateWithdraw(hex).isValid).toBe(true);
    });

    it('accepts when args match pubkey and amountWei (gwei field)', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validateWithdraw(hex, {
        validatorPublicKey: hexlify(sampleWithdrawalPubkey),
        amountWei: (sixtyEightEthGwei * 10n ** 9n).toString(),
      });
      expect(r.isValid).toBe(true);
    });

    it('rejects calldata pubkey that is not a valid BLS12-381 G1 point', () => {
      const invalidPk = new Uint8Array(
        Array.from({ length: 48 }, (_, i) => (i === 0 ? 0xa1 : i % 255) + 1),
      );
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: invalidPk,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validateWithdraw(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/BLS12-381 G1/);
    });

    it('rejects wrong predeploy "to"', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
        to: '0x0000000000000000000000000000000000000001',
      });
      const r = validateWithdraw(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/EIP-7002 withdrawal request predeploy/);
    });

    it('rejects transaction chainId mismatch', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: 999999,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validator.validate(
        hex,
        TransactionType.WITHDRAW,
        staker,
        undefined,
        mainnetContext(),
      );
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/chainId does not match network configuration/);
    });

    it('rejects calldata not exactly 56 bytes', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
        dataSliceLen: 40,
      });
      const r = validateWithdraw(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/exactly 56 bytes/);
    });

    it('rejects value below minimum fee', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: 0n,
      });
      const r = validateWithdraw(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/withdrawal request fee/);
    });

    it('rejects amount 0 (EIP-7002 full-exit sentinel; partial withdrawal only)', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: 0n,
        valueWei: withdrawalFeeWei,
      });
      const r = validateWithdraw(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/full validator exit|partial withdrawal/);
    });

    it('rejects args.validatorPublicKey mismatch', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validateWithdraw(hex, {
        validatorPublicKey: hexlify(otherDepositPubkey),
      });
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/validatorPublicKey/);
    });

    it('rejects args.amountWei mismatch', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validateWithdraw(hex, { amountWei: '1' });
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/amountWei/);
    });

    it('rejects EIP-7002 tx when transaction type is DEPOSIT (wrong validator path)', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validator.validate(
        hex,
        TransactionType.DEPOSIT,
        staker,
        undefined,
        mainnetContext(),
      );
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/official beacon deposit contract/);
    });
  });

  describe('Full exit (EIP-7002)', () => {
    const sixtyEightEthGwei = 68n * 10n ** 9n;
    const withdrawalFeeWei = 1_000_000_000_000n;

    function validateForceExit(
      hex: string,
      args?: { validatorPublicKey?: string; amountWei?: string },
    ) {
      return validator.validate(
        hex,
        TransactionType.FORCE_EXIT,
        staker,
        args,
        mainnetContext(),
      );
    }

    it('accepts amount 0 via TransactionType.FORCE_EXIT', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: 0n,
        valueWei: withdrawalFeeWei,
      });
      const r = validateForceExit(hex);
      expect(r.isValid).toBe(true);
    });

    it('rejects non-zero amount via TransactionType.FORCE_EXIT', () => {
      const hex = buildEip7002UnsignedTx({
        chainId: ETH_MAINNET.chainId,
        pubkey: sampleWithdrawalPubkey,
        amountGwei: sixtyEightEthGwei,
        valueWei: withdrawalFeeWei,
      });
      const r = validateForceExit(hex);
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/amount = 0|Force-exit/);
    });
  });
});
