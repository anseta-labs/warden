# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - Unreleased

Hardens transaction validation so tampered unsigned transactions are rejected
instead of passing as valid.

### Security

- ETH deposits: reject 0x00 (BLS) withdrawal credentials, which cannot be bound
  to the user's address.
- EIP-7002: cap the request fee (`tx.value`) at 0.001 ETH by default. The
  withdrawal request predeploy does not refund overpayment.
- EIP-7002: require the validator pubkey and amount bindings instead of skipping
  them when args are omitted or malformed.
- Solana stake: reject stake accounts initialized with a lockup or a third-party
  custodian.
- Solana partial unstake: cap the new stake account's rent funding at 0.01 SOL
  and require a standard 200-byte stake account.
- EVM: cap gas fee fields by default (500k gas limit, 500 gwei max fee per gas,
  50 gwei priority fee).
- EVM: accept only EIP-1559 (type 2) transactions with no access list.

### Added

- Optional args to raise the default caps: `maxFeeWei` (EIP-7002 request fee),
  `maxGasLimit`, `maxFeePerGasWei`, `maxPriorityFeePerGasWei`.

### Changed

- **Breaking:** `WITHDRAW` and `FORCE_EXIT` require `args.validatorPublicKey`,
  plus `args.amountWei` for partial withdrawals.
- **Breaking:** EVM transactions must be type 2 with no access list, and gas
  fields above the default caps are rejected unless raised via args.
- **Breaking:** deposits with 0x00 withdrawal credentials are rejected.

### Removed

- Solana `WITHDRAW` is no longer listed as a supported transaction type. It was
  never validated and every request was rejected.

### Acknowledgements

Thanks to Hilmi Adi Yulian for responsibly disclosing most of the issues
addressed in this release.

## [0.1.0]

- Initial public source release.
