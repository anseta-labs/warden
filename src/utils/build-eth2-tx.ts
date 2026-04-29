/**
 * Builds valid ETH2 staking transactions and wraps it in the
 * developer API response shape.
 *
 * Usage:
 *   import { buildEth2DepositApiResponse } from "./build-eth2-tx.ts";
 *
 *   const response = await buildEth2DepositApiResponse({
 *     withdrawalAddress: "0xYourWallet...",
 *     network:           "mainnet",          // or "hoodi" (Hoodi = chain 560048, same deposit contract as mainnet)
 *     amountEth:         32n,                // 32 ETH for new validator
 *                                            // 1-31 ETH for 0x02 top-up
 *   });
 *
 *   // response is shaped exactly like a real dev API response -
 *   // pipe it straight into the validator:
 *   const tx     = fromApiResponse(response);
 *   const result = validateStakingTx(tx, { network: "mainnet" });
 *
 */

import { AbiCoder, Transaction } from 'ethers';
import { bls12_381 as bls } from '@noble/curves/bls12-381.js';
import { ContainerType, ByteVectorType, UintNumberType } from '@chainsafe/ssz';

import {
  GENESIS_FORK_VERSION_MAINNET,
  GENESIS_FORK_VERSION_HOODI,
} from '../validators/evm/eth2-staking/constants';

interface ApiTxObject {
  type: number | null;
  to: string | null;
  data: string | null;
  value: string | null; // decimal wei string, e.g. "32000000000000000000"
  nonce: number | null;
  gasLimit: string | null;
  gasPrice: string | null;
  maxPriorityFeePerGas: string | null;
  maxFeePerGas: string | null;
  chainId: string | null;
  sig: string | null;
  accessList: unknown | null;
}

interface ApiTransaction {
  type: string; // "deposit", "approve", "delegate", etc.
  transactionType: string; // "evm"
  encodingFormat: string; // "hex"
  tx: ApiTxObject;
  encodedTx: string; // 0x-prefixed RLP of the unsigned tx
  description: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    transactions: ApiTransaction[];
  };
}

//  Re-use network config (aligned with stakefi-warden deposit networks)
type Network = 'mainnet' | 'hoodi';

const NETWORKS: Record<
  Network,
  { depositContract: string; forkVersion: Uint8Array; chainId: string }
> = {
  mainnet: {
    depositContract: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
    forkVersion: GENESIS_FORK_VERSION_MAINNET,
    chainId: '1',
  },
  hoodi: {
    depositContract: '0x00000000219ab540356cBB839Cbe05303d7705Fa',
    forkVersion: GENESIS_FORK_VERSION_HOODI,
    chainId: '560048',
  },
};

const DEPOSIT_SELECTOR = '22895118';
const ETH = 1_000_000_000_000_000_000n;
const GWEI = 1_000_000_000n;

/** EIP-1559 envelope for `encodedTx` (matches structured `tx` fee fields). */
const DEPOSIT_TX_GAS_LIMIT = 200_000n;
const DEPOSIT_TX_MAX_FEE_PER_GAS = 50n * 10n ** 9n;
const DEPOSIT_TX_MAX_PRIORITY_FEE_PER_GAS = 1n * 10n ** 9n;

const blsEth = bls.longSignatures;
const ETH_BLS_DST = Buffer.from('BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_');

//  Credential type

/**
 * 0x01 = standard (pre-Pectra) - always requires exactly 32 ETH
 * 0x02 = post-Pectra auto-compound - supports top-ups (1-31 ETH) as well
 */
type CredentialType = 0x01 | 0x02;

//  Builder input

export interface BuildDepositParams {
  /** Ethereum address that will receive funds when the validator exits. */
  withdrawalAddress: string;

  /** Network to build for. Determines deposit contract + fork version. */
  network: Network;

  /**
   * Amount in ETH as a bigint.
   * - 32n          -> new validator (works with both 0x01 and 0x02 credentials)
   * - 1n-31n       -> top-up to existing validator (0x02 credentials only)
   * - Defaults to 32n.
   */
  amountEth?: bigint;

  /**
   * Credential type prefix.
   * - 0x01  standard (default) - must pair with amountEth = 32n
   * - 0x02  post-Pectra - supports top-ups
   * Defaults to 0x01 if amountEth is 32n, 0x02 if amountEth < 32n.
   */
  credentialType?: CredentialType;

  /**
   * Provide an existing BLS private key (32 bytes) if you want deterministic
   * output or are working with a real validator keypair.
   * If omitted a random key is generated - useful for testing.
   */
  validatorPrivateKey?: Uint8Array;
}

//  SSZ types (via @chainsafe/ssz - same library used by Lodestar)

const DepositDataType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintNumberType(8),
  signature: new ByteVectorType(96),
});

const DepositMessageType = new ContainerType({
  pubkey: new ByteVectorType(48),
  withdrawalCredentials: new ByteVectorType(32),
  amount: new UintNumberType(8),
});

const ForkDataType = new ContainerType({
  currentVersion: new ByteVectorType(4),
  genesisValidatorsRoot: new ByteVectorType(32),
});

const SigningDataType = new ContainerType({
  objectRoot: new ByteVectorType(32),
  domain: new ByteVectorType(32),
});

function computeDepositDataRoot(
  pubkey: Uint8Array,
  wc: Uint8Array,
  amountGwei: bigint,
  sig: Uint8Array,
): Uint8Array {
  return DepositDataType.hashTreeRoot({
    pubkey,
    withdrawalCredentials: wc,
    amount: Number(amountGwei),
    signature: sig,
  });
}

function computeSigningRoot(
  pubkey: Uint8Array,
  wc: Uint8Array,
  amountGwei: bigint,
  forkVersion: Uint8Array,
): Uint8Array {
  const DOMAIN_DEPOSIT = new Uint8Array([0x03, 0x00, 0x00, 0x00]);
  const msgRoot = DepositMessageType.hashTreeRoot({
    pubkey,
    withdrawalCredentials: wc,
    amount: Number(amountGwei),
  });
  const forkDataRoot = ForkDataType.hashTreeRoot({
    currentVersion: forkVersion,
    genesisValidatorsRoot: new Uint8Array(32),
  });
  const domain = new Uint8Array(32);
  domain.set(DOMAIN_DEPOSIT);
  domain.set(forkDataRoot.slice(0, 28), 4);
  return SigningDataType.hashTreeRoot({ objectRoot: msgRoot, domain });
}

//  Main builder

/**
 * Build a valid ETH2 deposit transaction and return it wrapped in the
 * developer API response shape.
 *
 * The returned object is structurally identical to what the dev API will
 * return once ETH2 support is implemented
 */
export async function buildEth2DepositApiResponse(
  params: BuildDepositParams,
): Promise<ApiResponse> {
  const { withdrawalAddress, network, amountEth = 32n } = params;

  const cfg = NETWORKS[network];

  // Infer credential type from amount if not provided:
  //   < 32 ETH -> must be 0x02 (top-up)
  //   = 32 ETH -> default to 0x01 (standard), unless caller wants 0x02
  const credentialType: CredentialType =
    params.credentialType ?? (amountEth < 32n ? 0x02 : 0x01);

  //  1. BLS keypair
  const privKey = params.validatorPrivateKey ?? bls.utils.randomSecretKey();
  const pubkeyPt = blsEth.getPublicKey(privKey);
  const pubkey = pubkeyPt.toBytes(true); // 48-byte compressed G1 point

  //  2. Withdrawal credentials
  // Format: [prefix (1)] [zero padding (11)] [eth address (20)]
  const addr = withdrawalAddress.replace(/^0x/, '');
  if (addr.length !== 40)
    throw new Error(`Invalid Ethereum address: ${withdrawalAddress}`);
  const wc = new Uint8Array(32);
  wc[0] = credentialType;
  wc.set(Buffer.from(addr, 'hex'), 12);

  //  3. Sign the deposit message
  const amountGwei = (amountEth * ETH) / GWEI;
  const signingRoot = computeSigningRoot(
    pubkey,
    wc,
    amountGwei,
    cfg.forkVersion,
  );
  const msgPoint = bls.G2.hashToCurve(signingRoot, { DST: ETH_BLS_DST });
  const sigPt = blsEth.sign(msgPoint, privKey);
  const signature = sigPt.toBytes(true); // 96-byte compressed G2 point

  //  4. Compute deposit_data_root
  const depositDataRoot = computeDepositDataRoot(
    pubkey,
    wc,
    amountGwei,
    signature,
  );

  //  5. ABI-encode the deposit() calldata
  const coder = AbiCoder.defaultAbiCoder();
  const encoded = coder.encode(
    ['bytes', 'bytes', 'bytes', 'bytes32'],
    [
      '0x' + Buffer.from(pubkey).toString('hex'),
      '0x' + Buffer.from(wc).toString('hex'),
      '0x' + Buffer.from(signature).toString('hex'),
      '0x' + Buffer.from(depositDataRoot).toString('hex'),
    ],
  );
  const calldata = '0x' + DEPOSIT_SELECTOR + encoded.slice(2);

  //  6. Wrap in API response shape
  const valueWei = (amountEth * ETH).toString(); // decimal wei string
  const chainIdNum = Number(cfg.chainId);
  const nonce = 0;

  const encodedTx = Transaction.from({
    type: 2,
    to: cfg.depositContract,
    value: BigInt(valueWei),
    data: calldata,
    chainId: chainIdNum,
    nonce,
    gasLimit: DEPOSIT_TX_GAS_LIMIT,
    maxFeePerGas: DEPOSIT_TX_MAX_FEE_PER_GAS,
    maxPriorityFeePerGas: DEPOSIT_TX_MAX_PRIORITY_FEE_PER_GAS,
  }).unsignedSerialized;

  const response: ApiResponse = {
    success: true,
    data: {
      transactions: [
        {
          type: amountEth >= 32n ? 'deposit' : 'top-up',
          transactionType: 'evm',
          encodingFormat: 'hex',
          tx: {
            type: 2,
            to: cfg.depositContract,
            data: calldata,
            value: valueWei,
            nonce,
            gasLimit: DEPOSIT_TX_GAS_LIMIT.toString(),
            gasPrice: null,
            maxPriorityFeePerGas:
              DEPOSIT_TX_MAX_PRIORITY_FEE_PER_GAS.toString(),
            maxFeePerGas: DEPOSIT_TX_MAX_FEE_PER_GAS.toString(),
            chainId: cfg.chainId,
            sig: null,
            accessList: null,
          },
          encodedTx,
          description: `${amountEth >= 32n ? 'Deposit' : 'Top-up'} ${amountEth} ETH for ETH2 validator 0x${Buffer.from(pubkey).toString('hex').slice(0, 16)}...`,
        },
      ],
    },
  };

  return response;
}
