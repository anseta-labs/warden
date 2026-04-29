# @bcwresearch/stakefi-warden

TypeScript library for **StakeFi integrators**: validate **unsigned** transactions (e.g. EVM hex) **before** signing, using rules keyed by `chainId` and `TransactionType`.

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
warden.getSupportedTransactionTypes(chains[0]); // e.g. ['DEPOSIT','EXIT']
warden.isSupported(1, TransactionType.DEPOSIT); // true if registered

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
  console.error(result.reason, result.details);
}
```

For a full ETH2 deposit example (building or decoding txs), see **`examples/01_basic_eth2_deposit.ts`** (run with `pnpm exec ts-node examples/01_basic_eth2_deposit.ts` from the repo root).

## Scripts

| Script                            | Purpose                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm run build`                  | Compile to `dist/`                                                                                           |
| `pnpm test`                       | Jest (verbose per-test output is enabled in `jest.config.mjs`)                                               |
| `pnpm run generate-eth2-fixtures` | Regenerate **`src/validators/evm/__fixtures__/eth2-deposit-unsigned-hex.json`** used by beacon deposit tests |

## Test fixtures

`EthereumBeaconValidator` tests use **frozen unsigned tx hex** in `__fixtures__/`. That avoids pulling **`@noble/curves`** (ESM BLS used only in `build-eth2-tx`) into Jest, which is easier than ESM-only test runner setup. After changing deposit building logic, run **`pnpm run generate-eth2-fixtures`** and commit the updated JSON.
