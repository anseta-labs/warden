import { Warden } from './warden';
import { validatorRegistry } from './validators';
import { BaseValidator } from './validators/base.validator';
import {
  ActionArguments,
  ValidationContext,
  TransactionType,
  ValidationResult,
} from './types';

class StubValidator extends BaseValidator {
  getSupportedTransactionTypes(): TransactionType[] {
    return [TransactionType.STAKE];
  }

  validate(
    _unsignedTransaction: string,
    transactionType: TransactionType,
    _userAddress: string,
    _args?: ActionArguments,
    _context?: ValidationContext,
  ): ValidationResult {
    if (transactionType === TransactionType.STAKE) {
      return this.safe();
    }
    return this.blocked('Unsupported type for stub');
  }
}

describe('Warden', () => {
  const originalRegistry = new Map(validatorRegistry);

  afterEach(() => {
    validatorRegistry.clear();
    for (const [k, v] of originalRegistry) {
      validatorRegistry.set(k, v);
    }
  });

  it('rejects unknown action IDs', () => {
    const warden = new Warden();
    const result = warden.validate({
      actionId: 'unknown-action',
      unsignedTransaction: '0x',
      userAddress: '0xabc',
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Unknown action');
  });

  it('rejects missing transaction or user address', () => {
    validatorRegistry.set('test-action', new StubValidator());
    const warden = new Warden();
    expect(
      warden.validate({
        actionId: 'test-action',
        unsignedTransaction: '',
        userAddress: '0xabc',
      }).isValid,
    ).toBe(false);
    expect(
      warden.validate({
        actionId: 'test-action',
        unsignedTransaction: '0x1',
        userAddress: '',
      }).isValid,
    ).toBe(false);
  });

  it('accepts when exactly one transaction type matches', () => {
    validatorRegistry.set('test-action', new StubValidator());
    const warden = new Warden();
    const result = warden.validate({
      actionId: 'test-action',
      unsignedTransaction: '0x00',
      userAddress: '0xuser',
    });
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe(TransactionType.STAKE);
  });

  it('exposes supported action IDs', () => {
    validatorRegistry.clear();
    validatorRegistry.set('a', new StubValidator());
    validatorRegistry.set('b', new StubValidator());
    const warden = new Warden();
    expect(warden.getSupportedActionIds().sort()).toEqual(['a', 'b']);
    expect(warden.isSupported('a')).toBe(true);
    expect(warden.isSupported('missing')).toBe(false);
  });
});
