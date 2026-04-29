import { Warden } from './warden';
import { makeValidatorRegistryKey, validatorRegistry } from './validators';
import { BaseValidator } from './validators/base.validator';
import { ActionArguments, ValidationContext, TransactionType } from './types';

class StubValidator extends BaseValidator {
  getSupportedTransactionTypes(): TransactionType[] {
    return [TransactionType.STAKE, TransactionType.DEPOSIT];
  }

  validate(
    _unsignedTransaction: string,
    transactionType: TransactionType,
    _userAddress: string,
    _args?: ActionArguments,
    _context?: ValidationContext,
  ) {
    if (
      transactionType === TransactionType.STAKE ||
      transactionType === TransactionType.DEPOSIT
    ) {
      return this.safe();
    }
    return this.blocked('Unsupported type for stub');
  }
}

const base = () => ({
  unsignedTransaction: '0x00',
  userAddress: '0xuser',
  chainId: 1,
  transactionType: TransactionType.DEPOSIT,
});

describe('Warden', () => {
  const originalRegistry = new Map(validatorRegistry);

  afterEach(() => {
    validatorRegistry.clear();
    for (const [k, v] of originalRegistry) {
      validatorRegistry.set(k, v);
    }
  });

  it('rejects unknown chain and transaction type pair', () => {
    const warden = new Warden();
    const result = warden.validate({
      ...base(),
      unsignedTransaction: '0x',
      transactionType: TransactionType.DEPOSIT,
      chainId: 99_999,
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/No validator/);
  });

  it('rejects invalid chainId', () => {
    const warden = new Warden();
    expect(
      warden.validate({
        ...base(),
        chainId: 1.5,
        transactionType: TransactionType.DEPOSIT,
      } as never).isValid,
    ).toBe(false);
  });

  it('rejects missing transaction, user address, or type', () => {
    validatorRegistry.set(
      makeValidatorRegistryKey(1, TransactionType.DEPOSIT),
      new StubValidator(),
    );
    const warden = new Warden();
    expect(
      warden.validate({
        ...base(),
        unsignedTransaction: '',
        transactionType: TransactionType.DEPOSIT,
      }).isValid,
    ).toBe(false);
    expect(
      warden.validate({
        ...base(),
        userAddress: '',
        transactionType: TransactionType.DEPOSIT,
      }).isValid,
    ).toBe(false);
  });

  it('validates with the single requested transaction type', () => {
    validatorRegistry.set(
      makeValidatorRegistryKey(1, TransactionType.STAKE),
      new StubValidator(),
    );
    const warden = new Warden();
    const result = warden.validate({
      ...base(),
      unsignedTransaction: '0x00',
      userAddress: '0xuser',
      chainId: 1,
      transactionType: TransactionType.STAKE,
    });
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe(TransactionType.STAKE);
  });

  it('exposes supported chains, types per chain, and flat pairs', () => {
    validatorRegistry.clear();
    validatorRegistry.set(
      makeValidatorRegistryKey(1, TransactionType.STAKE),
      new StubValidator(),
    );
    validatorRegistry.set(
      makeValidatorRegistryKey(11, TransactionType.CLAIM_REWARDS),
      new StubValidator(),
    );
    validatorRegistry.set(
      makeValidatorRegistryKey(11, TransactionType.WITHDRAW),
      new StubValidator(),
    );
    const warden = new Warden();

    expect(warden.getSupportedChains()).toEqual([1, 11]);

    expect(warden.getSupportedTransactionTypes(1)).toEqual([
      TransactionType.STAKE,
    ]);
    expect(warden.getSupportedTransactionTypes(11).sort()).toEqual([
      TransactionType.CLAIM_REWARDS,
      TransactionType.WITHDRAW,
    ]);
    expect(warden.getSupportedTransactionTypes(999)).toEqual([]);
    expect(warden.getSupportedTransactionTypes(1.5 as never)).toEqual([]);

    const pairs = warden.getSupportedChainTypePairs();
    expect(pairs).toEqual([
      { chainId: 1, transactionType: TransactionType.STAKE },
      { chainId: 11, transactionType: TransactionType.CLAIM_REWARDS },
      { chainId: 11, transactionType: TransactionType.WITHDRAW },
    ]);

    expect(warden.isSupported(1, TransactionType.STAKE)).toBe(true);
    expect(warden.isSupported(11, TransactionType.DEPOSIT)).toBe(false);
  });
});
