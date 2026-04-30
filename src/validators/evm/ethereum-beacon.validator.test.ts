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

    it('rejects DEPOSIT for non-DEPOSIT transaction type', () => {
      const r = validator.validate(
        depositFixtures.mainnet_32eth_0x01,
        TransactionType.STAKE,
        staker,
        undefined,
        mainnetContext(),
      );
      expect(r.isValid).toBe(false);
      expect(r.reason).toMatch(/Only DEPOSIT/);
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

  describe('Withdrawals', () => {
    // TODO: Add later
  });

  describe('Force Exits', () => {
    // TODO: Add later
  });
});
