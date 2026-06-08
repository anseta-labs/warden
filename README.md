# @bcwresearch/stakefi-warden

TypeScript library for **stakeFi integrators**: validate **unsigned** transactions (e.g. EVM hex) **before** signing, using rules keyed by `chainId` and `TransactionType`.

## Supported Chains

- Ethereum
- Solana

## Requirements

- Node **20+**
- **pnpm**

## Setup

```bash
pnpm install
pnpm run build
pnpm test
```

## Usage

```ts
import {
  Warden,
  TransactionType,
  type ValidationRequest,
} from '@bcwresearch/stakefi-warden';

const warden = new Warden();

const chains = warden.getSupportedChains(); // e.g. [1, 560048]
warden.getSupportedTransactionTypes(chains[0]); // e.g. ['DEPOSIT', 'FORCE_EXIT', 'WITHDRAW']
warden.isSupported(chains[0], TransactionType.DEPOSIT); // true if registered
warden.isSupported(1, TransactionType.WITHDRAW); // EIP-7002 partial withdrawal
warden.isSupported(1, TransactionType.FORCE_EXIT); // EIP-7002 full-exit (0 gwei in calldata)

// Unsigned EIP-1559 (or legacy) tx hex from your API — do not sign before validating
const request: ValidationRequest = {
  unsignedTransaction: '0x02f8...', // RLP-serialized unsigned tx, 0x-prefixed
  userAddress: '0x...',
  chainId: chains[0],
  transactionType: TransactionType.DEPOSIT,
  // args: optional integrator hints; context: optional; Warden merges chainId into context for validators
};

const result = warden.validate(request);
if (result.isValid) {
  // Safe to present to the wallet for signing
  console.log(result.detectedType); // same as request.transactionType when valid
} else {
  // Request validation failed, do not proceed with signing!
  console.error(result.reason, result.details);
}
```

## Examples

Runnable scripts under **`examples/`** (from the repo root, use `pnpm exec ts-node examples/<file>.ts`):

| File                                  | What it covers                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `01_basic_eth2_deposit.ts`            | **`DEPOSIT`**: valid beacon deposit vs withdrawal-credentials mismatch                                    |
| `02_eip7002_partial_and_full_exit.ts` | **`WITHDRAW`** and **`FORCE_EXIT`**: EIP-7002 predeploy, partial amount vs full-exit (0 gwei in calldata) |

```bash
pnpm exec ts-node examples/01_basic_eth2_deposit.ts
pnpm exec ts-node examples/02_eip7002_partial_and_full_exit.ts
```

## Scripts

| Script                            | Purpose                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm run build`                  | Compile to `dist/`                                                                                           |
| `pnpm test`                       | Jest (verbose per-test output is enabled in `jest.config.mjs`)                                               |
| `pnpm run generate-eth2-fixtures` | Regenerate **`src/validators/evm/__fixtures__/eth2-deposit-unsigned-hex.json`** used by beacon deposit tests |

## Test fixtures

`EthereumBeaconValidator` tests use **frozen unsigned tx hex** in `__fixtures__/`. That avoids pulling **`@noble/curves`** (ESM BLS used only in `build-eth2-tx`) into Jest, which is easier than ESM-only test runner setup. After changing deposit building logic, run **`pnpm run generate-eth2-fixtures`** and commit the updated JSON.
