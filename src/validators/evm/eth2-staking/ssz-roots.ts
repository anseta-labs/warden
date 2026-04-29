import { ByteVectorType, ContainerType, UintNumberType } from '@chainsafe/ssz';
import { ZERO_HASH } from './constants';

const BLS_PUBKEY = new ByteVectorType(48);
const BLS_SIG = new ByteVectorType(96);
const BYTES32 = new ByteVectorType(32);
const U64 = new UintNumberType(8);

const ForkData = new ContainerType(
  { currentVersion: new ByteVectorType(4), genesisValidatorsRoot: BYTES32 },
  { typeName: 'ForkData' },
);

const DepositMessage = new ContainerType(
  {
    pubkey: BLS_PUBKEY,
    withdrawalCredentials: BYTES32,
    amount: U64,
  },
  { typeName: 'DepositMessage' },
);

const DepositData = new ContainerType(
  {
    pubkey: BLS_PUBKEY,
    withdrawalCredentials: BYTES32,
    amount: U64,
    signature: BLS_SIG,
  },
  { typeName: 'DepositData' },
);

const SigningData = new ContainerType(
  { objectRoot: BYTES32, domain: BYTES32 },
  { typeName: 'SigningData' },
);

/**
 * @see https://github.com/ethereum/consensus-specs/blob/b3e83f6691c61e5b35136000146015653b22ed38/specs/phase0/beacon-chain.md#compute_signing_root. Deposits use `genesis_validators_root = zero`.
 * First 4 bytes = domain type (e.g. DOMAIN_DEPOSIT); next 28 = fork data root[0:28].
 */
export function computeDomain(
  domainType: Uint8Array,
  forkVersion: Uint8Array,
): Uint8Array {
  const forkDataRoot = ForkData.hashTreeRoot({
    currentVersion: forkVersion,
    genesisValidatorsRoot: ZERO_HASH,
  });
  const domain = new Uint8Array(32);
  domain.set(domainType, 0);
  domain.set(forkDataRoot.subarray(0, 28), 4);
  return domain;
}

/**
 * @see https://github.com/ethereum/consensus-specs/blob/b3e83f6691c61e5b35136000146015653b22ed38/specs/phase0/beacon-chain.md#compute_signing_root
 */
export function computeDepositSigningRoot(
  message: {
    pubkey: Uint8Array;
    withdrawalCredentials: Uint8Array;
    amount: number;
  },
  domain: Uint8Array,
): Uint8Array {
  const objectRoot = DepositMessage.hashTreeRoot({
    pubkey: message.pubkey,
    withdrawalCredentials: message.withdrawalCredentials,
    amount: message.amount,
  });
  return SigningData.hashTreeRoot({ objectRoot, domain });
}

export function hashDepositDataTreeRoot(data: {
  pubkey: Uint8Array;
  withdrawalCredentials: Uint8Array;
  amount: number;
  signature: Uint8Array;
}): Uint8Array {
  return DepositData.hashTreeRoot(data);
}
