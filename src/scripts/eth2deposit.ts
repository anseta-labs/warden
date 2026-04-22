/**

 * Tx validator for Ethereum staking deposit transactions
 * Other tx types to be added later
 * 
 * This is the crux of how to validate an eth2 deposit tx
 *
 * Handles both pre and post pectra deposit types:
 *   0x01 credentials = standard execution-address withdrawal, = 32 ETH
 *   0x02 credentials = post pectra auto compound, 32 ETH (new) OR >=1 ETH (top-up)
 *
 * Validation levels/stages:
 *   1  Transaction shape     ---> to address, value, function selector
 *   2  ABI decode            ---> can the calldata be unpacked?
 *   3  Semantic field checks ---> lengths, prefixes, amount rules
 *   4  Cryptographic checks  ---> SSZ deposit_data_root + BLS signature
 */

import { createHash } from 'crypto';
import { AbiCoder } from 'ethers';
import { bls12_381 as bls } from '@noble/curves/bls12-381.js';

const blsEth = bls.longSignatures;

// Ethereum's BLS DST (Domain Separation Tag) for deposit signing
const ETH_BLS_DST = Buffer.from('BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_');

/** Hash a 32-byte signing root to a G2 curve point using Ethereum's DST. */
function hashToG2(signingRoot: Uint8Array) {
  return bls.G2.hashToCurve(signingRoot, { DST: ETH_BLS_DST });
}

function toHex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

export interface StakingTx {
  to: string;
  value: bigint; // wei
  input: string; // hex calldata, 0x-prefixed or bare
}

export interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

export type Network = 'mainnet' | 'hoodi' | 'holesky';

interface NetworkConfig {
  depositContract: string;
  forkVersion: Uint8Array;
}

const NETWORKS: Record<Network, NetworkConfig> = {
  mainnet: {
    depositContract: '0x00000000219ab540356cbb839cbe05303d7705fa',
    forkVersion: new Uint8Array([0x00, 0x00, 0x00, 0x00]),
  },
  hoodi: {
    depositContract: '0x4242424242424242424242424242424242424242',
    forkVersion: new Uint8Array([0x01, 0x01, 0x70, 0x00]),
  },
  holesky: {
    depositContract: '0x4242424242424242424242424242424242424242',
    forkVersion: new Uint8Array([0x01, 0x01, 0x70, 0x00]),
  },
};

// keccak256("deposit(bytes,bytes,bytes,bytes32)") first 4 bytes
const DEPOSIT_SELECTOR = '22895118';

const ETH = 1_000_000_000_000_000_000n;
const GWEI = 1_000_000_000n;

const DOMAIN_DEPOSIT = new Uint8Array([0x03, 0x00, 0x00, 0x00]);

const WC_PREFIX_NAMES: Record<number, string> = {
  0x00: 'BLS key (legacy, pre-Shapella)',
  0x01: 'Execution address (standard)',
  0x02: 'Execution address (post-Pectra, auto-compound)',
};

// ── ValidationResult ───────────────────────────────────────────────────────────

export class ValidationResult {
  readonly checks: Check[] = [];

  get passed(): boolean {
    return this.checks.every((c) => c.passed);
  }

  /** Add a check; returns whether it passed, for early-exit chaining. */
  add(name: string, passed: boolean, detail?: string): boolean {
    this.checks.push({ name, passed, detail });
    return passed;
  }

  toString(): string {
    const status = this.passed ? '✓ VALID' : '✗ INVALID';
    const lines = this.checks.map((c) => {
      const icon = c.passed ? '✓' : '✗';
      const detail = c.detail ? `  (${c.detail})` : '';
      return `  ${icon}  ${c.name}${detail}`;
    });
    return [status, '', ...lines].join('\n');
  }
}

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex.replace(/^0x/, ''), 'hex'));
}

// SSZ (Simple Serialize)
// Ethereum's Beacon Chain uses SSZ for all hashing. The deposit contract
// recomputes these exact roots on-chain to verify your calldata.

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function merkleize(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const mid = chunks.length / 2;
  return sha256(
    concat(merkleize(chunks.slice(0, mid)), merkleize(chunks.slice(mid))),
  );
}

function padToPow2(chunks: Uint8Array[]): Uint8Array[] {
  const n = nextPow2(Math.max(chunks.length, 1));
  const zero = new Uint8Array(32);
  return [...chunks, ...Array.from({ length: n - chunks.length }, () => zero)];
}

/**
 * SSZ hash_tree_root for a fixed-length byte vector.
 * Used for pubkey (48 bytes) and signature (96 bytes).
 * Splits into 32-byte chunks, pads to power-of-2, merkleizes.
 */
function htrBytesVector(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += 32) {
    const chunk = new Uint8Array(32);
    chunk.set(data.slice(i, i + 32));
    chunks.push(chunk);
  }
  return merkleize(padToPow2(chunks));
}

/**
 * SSZ hash_tree_root for a uint64.
 * Encoded as little-endian 8 bytes, zero-padded to 32.
 */
function htrUint64(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Recompute SSZ hash_tree_root(DepositData).
 *
 * DepositData struct:
 *   pubkey:                 BLSPubkey   (48 bytes)
 *   withdrawal_credentials: Bytes32     (32 bytes)
 *   amount:                 Gwei/uint64
 *   signature:              BLSSig      (96 bytes)
 *
 * This is what the deposit contract verifies on-chain. If our computed
 * root matches the supplied one, the calldata hasn't been tampered with
 */
function computeDepositDataRoot(
  pubkey: Uint8Array,
  withdrawalCredentials: Uint8Array,
  amountGwei: bigint,
  signature: Uint8Array,
): Uint8Array {
  return merkleize([
    htrBytesVector(pubkey),
    withdrawalCredentials, // already 32 bytes — used directly as a leaf
    htrUint64(amountGwei),
    htrBytesVector(signature),
  ]);
}

/**
 * Compute the BLS signing root for a deposit.
 *
 * 1. hash_tree_root(DepositMessage{pubkey, withdrawal_credentials, amount})
 * 2. Build the deposit domain from the network's fork version
 * 3. signing_root = hash_tree_root(SigningData{object_root, domain})
 *
 * This 32-byte value is the exact message the validator signs
 */
function computeSigningRoot(
  pubkey: Uint8Array,
  withdrawalCredentials: Uint8Array,
  amountGwei: bigint,
  forkVersion: Uint8Array,
): Uint8Array {
  // DepositMessage has 3 fields — pad to power-of-2 (4) before merkleizing
  const depositMessageRoot = merkleize(
    padToPow2([
      htrBytesVector(pubkey),
      withdrawalCredentials,
      htrUint64(amountGwei),
    ]),
  );

  // ForkData = { current_version (padded to 32), genesis_validators_root (zero) }
  const forkVersionPadded = new Uint8Array(32);
  forkVersionPadded.set(forkVersion);
  const forkDataRoot = merkleize([forkVersionPadded, new Uint8Array(32)]);

  // domain = DOMAIN_DEPOSIT (4 bytes) || forkDataRoot[0:28]
  const domain = new Uint8Array(32);
  domain.set(DOMAIN_DEPOSIT);
  domain.set(forkDataRoot.slice(0, 28), 4);

  // SigningData = { object_root, domain }
  return merkleize([depositMessageRoot, domain]);
}

// Amount validation rules
//
// Post-Pectra rules differ by credential prefix:
//
//   0x00 / 0x01 → always a new-validator deposit, must be exactly 32 ETH
//
//   0x02        → new validator (≥32 ETH) OR top-up to existing (1–31 ETH)
//                 either way must be a whole number of ETH

type DepositKind = 'new-validator' | 'top-up' | 'invalid';

interface AmountCheck {
  valid: boolean;
  kind: DepositKind;
  detail: string;
}

function checkAmount(value: bigint, wcPrefix: number): AmountCheck {
  const isWholeEth = value % ETH === 0n;
  const ethAmt = value / ETH;

  if (wcPrefix === 0x02) {
    if (!isWholeEth) {
      return {
        valid: false,
        kind: 'invalid',
        detail: `${value} wei — 0x02 deposits must be a whole number of ETH`,
      };
    }
    if (ethAmt === 0n) {
      return {
        valid: false,
        kind: 'invalid',
        detail: '0 ETH — below 1 ETH minimum',
      };
    }
    if (ethAmt < 32n) {
      return {
        valid: true,
        kind: 'top-up',
        detail: `${ethAmt} ETH — top-up to an existing 0x02 validator`,
      };
    }
    return {
      valid: true,
      kind: 'new-validator',
      detail: `${ethAmt} ETH — new validator`,
    };
  }

  // 0x00 / 0x01: must be exactly 32 ETH
  if (value === 32n * ETH) {
    return { valid: true, kind: 'new-validator', detail: '32 ETH' };
  }
  return {
    valid: false,
    kind: 'invalid',
    detail: `got ${Number(value) / 1e18} ETH — 0x${wcPrefix.toString(16).padStart(2, '0')} credentials require exactly 32 ETH`,
  };
}

// Main validator

export interface ValidateOptions {
  network?: Network;
  verifyBls?: boolean; // false = skip BLS sig check (faster, but less thorough), defaults to true, see below
}

export function validateStakingTx(
  tx: StakingTx,
  options: ValidateOptions = {},
): ValidationResult {
  const { network = 'mainnet', verifyBls = true } = options;
  const config = NETWORKS[network];
  const result = new ValidationResult();

  //  Stage 1: Transaction shape

  const to = (tx.to ?? '').toLowerCase();
  if (
    !result.add(
      'L1 · to is the deposit contract',
      to === config.depositContract,
      `got ${to || '(missing)'}`,
    )
  )
    return result;

  let calldata: Uint8Array;
  try {
    calldata = hexToBytes(tx.input);
    result.add('L1 · calldata is valid hex', true);
  } catch {
    result.add('L1 · calldata is valid hex', false, 'not parseable as hex');
    return result;
  }

  result.add(
    'L1 · function selector is deposit()',
    Buffer.from(calldata.slice(0, 4)).toString('hex') === DEPOSIT_SELECTOR,
    `got 0x${Buffer.from(calldata.slice(0, 4)).toString('hex')}, expected 0x${DEPOSIT_SELECTOR}`,
  );

  //  Stage 2: ABI decode

  let pubkey: Uint8Array;
  let withdrawalCredentials: Uint8Array;
  let signature: Uint8Array;
  let depositDataRoot: Uint8Array;

  try {
    const coder = AbiCoder.defaultAbiCoder();
    const decoded = coder.decode(
      ['bytes', 'bytes', 'bytes', 'bytes32'],
      calldata.slice(4),
    );

    // ethers v6 returns dynamic bytes and bytes32 as hex strings
    pubkey = hexToBytes(decoded[0] as string);
    withdrawalCredentials = hexToBytes(decoded[1] as string);
    signature = hexToBytes(decoded[2] as string);
    depositDataRoot = hexToBytes(decoded[3] as string);

    result.add('L2 · calldata is ABI-decodable', true);
  } catch (e) {
    result.add('L2 · calldata is ABI-decodable', false, String(e));
    return result;
  }

  //  Stage 3: Semantic field checks

  result.add(
    'L3 · pubkey is 48 bytes',
    pubkey.length === 48,
    `got ${pubkey.length}`,
  );
  result.add(
    'L3 · withdrawal_credentials is 32 bytes',
    withdrawalCredentials.length === 32,
    `got ${withdrawalCredentials.length}`,
  );
  result.add(
    'L3 · signature is 96 bytes',
    signature.length === 96,
    `got ${signature.length}`,
  );

  const wcPrefix = withdrawalCredentials[0];
  result.add(
    'L3 · withdrawal_credentials prefix is valid',
    wcPrefix in WC_PREFIX_NAMES,
    `0x${wcPrefix.toString(16).padStart(2, '0')} = ${WC_PREFIX_NAMES[wcPrefix] ?? 'unknown'}`,
  );

  if (wcPrefix === 0x01 || wcPrefix === 0x02) {
    result.add(
      'L3 · withdrawal_credentials padding is zeroed',
      withdrawalCredentials.slice(1, 12).every((b) => b === 0),
      'bytes 1–11 must be 0x00 for execution-layer credential types',
    );
  }

  result.add('L3 · pubkey is non-zero', !pubkey.every((b) => b === 0));
  result.add('L3 · signature is non-zero', !signature.every((b) => b === 0));

  const amtCheck = checkAmount(tx.value, wcPrefix);
  result.add(
    `L3 · value is valid for 0x${wcPrefix.toString(16).padStart(2, '0')} credential type`,
    amtCheck.valid,
    amtCheck.detail,
  );

  //  Stage 4: Cryptographic checks

  const amountGwei = tx.value / GWEI;

  // 4a: Recompute deposit_data_root using SSZ and compare to the supplied one.
  //     The deposit contract runs this exact check on-chain
  const computedRoot = computeDepositDataRoot(
    pubkey,
    withdrawalCredentials,
    amountGwei,
    signature,
  );
  const rootsMatch = computedRoot.every((b, i) => b === depositDataRoot[i]);
  result.add(
    'L4 · deposit_data_root matches recomputed SSZ root',
    rootsMatch,
    rootsMatch
      ? `0x${Buffer.from(computedRoot).toString('hex').slice(0, 16)}...`
      : `computed 0x${Buffer.from(computedRoot).toString('hex').slice(0, 16)}..., ` +
          `supplied 0x${Buffer.from(depositDataRoot).toString('hex').slice(0, 16)}...`,
  );

  if (!verifyBls) {
    result.add('L4 · BLS verification', true, 'skipped (verifyBls=false)');
    return result;
  }

  // 4b: Check pubkey is a valid non-infinity BLS12-381 G1 point
  let pubkeyPoint: ReturnType<typeof bls.G1.Point.fromHex>;
  try {
    pubkeyPoint = bls.G1.Point.fromHex(toHex(pubkey));
    pubkeyPoint.assertValidity();
    result.add('L4 · pubkey is a valid G1 point', true);
  } catch (e) {
    result.add('L4 · pubkey is a valid G1 point', false, String(e));
    return result;
  }

  // 4c: Check signature is a valid non-infinity BLS12-381 G2 point
  let sigPoint: ReturnType<typeof bls.G2.Point.fromHex>;
  try {
    sigPoint = bls.G2.Point.fromHex(toHex(signature));
    sigPoint.assertValidity();
    result.add('L4 · signature is a valid G2 point', true);
  } catch (e) {
    result.add('L4 · signature is a valid G2 point', false, String(e));
    return result;
  }

  // 4d: Verify the BLS signature over the deposit message.
  //     We hash the signing root to a G2 point using Ethereum's DST, then
  //     verify the pairing: e(pubkey, msgPoint) == e(G1, sigPoint).
  try {
    const signingRoot = computeSigningRoot(
      pubkey,
      withdrawalCredentials,
      amountGwei,
      config.forkVersion,
    );
    const msgPoint = hashToG2(signingRoot);
    const valid = blsEth.verify(sigPoint, msgPoint, pubkeyPoint);
    result.add(
      'L4 · BLS signature verifies against deposit message',
      valid,
      valid
        ? ''
        : 'signature does not verify — keys may be mismatched or data was tampered with',
    );
  } catch (e) {
    result.add(
      'L4 · BLS signature verifies against deposit message',
      false,
      String(e),
    );
  }

  return result;
}

// Test suite
async function selfTest() {
  async function buildDepositTx(opts: {
    wcPrefix: number;
    amountEth: bigint;
    network: Network;
  }): Promise<StakingTx> {
    const cfg = NETWORKS[opts.network];
    const privKey = bls.utils.randomSecretKey();
    const pubkeyPt = blsEth.getPublicKey(privKey);
    const pubkey = pubkeyPt.toBytes(true); // compressed 48-byte G1 point

    const wc = new Uint8Array(32);
    wc[0] = opts.wcPrefix;
    wc.set(hexToBytes('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045'), 12); // random withdrawal creds

    const amountGwei = (opts.amountEth * ETH) / GWEI;
    const signingRoot = computeSigningRoot(
      pubkey,
      wc,
      amountGwei,
      cfg.forkVersion,
    );
    const msgPoint = hashToG2(signingRoot);
    const sigPt = blsEth.sign(msgPoint, privKey);
    const signature = sigPt.toBytes(true); // compressed 96-byte G2 point
    const ddr = computeDepositDataRoot(pubkey, wc, amountGwei, signature);

    const coder = AbiCoder.defaultAbiCoder();
    const encoded = coder.encode(
      ['bytes', 'bytes', 'bytes', 'bytes32'],
      [
        '0x' + Buffer.from(pubkey).toString('hex'),
        '0x' + Buffer.from(wc).toString('hex'),
        '0x' + Buffer.from(signature).toString('hex'),
        '0x' + Buffer.from(ddr).toString('hex'),
      ],
    );

    return {
      to: cfg.depositContract,
      value: opts.amountEth * ETH,
      input: '0x' + DEPOSIT_SELECTOR + encoded.slice(2),
    };
  }

  console.log('Test 1: standard 0x01 new validator (32 ETH, mainnet) \n');
  const r1 = validateStakingTx(
    await buildDepositTx({
      wcPrefix: 0x01,
      amountEth: 32n,
      network: 'mainnet',
    }),
    { network: 'mainnet' },
  );
  console.log(r1.toString());

  console.log('\n Test 2: post-Pectra 0x02 top-up (8 ETH, mainnet)\n');
  const r2 = validateStakingTx(
    await buildDepositTx({ wcPrefix: 0x02, amountEth: 8n, network: 'mainnet' }),
    { network: 'mainnet' },
  );
  console.log(r2.toString());

  console.log('\n Test 3: Hoodi testnet, 0x02 new validator (32 ETH)\n');
  const r3 = validateStakingTx(
    await buildDepositTx({ wcPrefix: 0x02, amountEth: 32n, network: 'hoodi' }),
    { network: 'hoodi' },
  );
  console.log(r3.toString());

  console.log('\n Test 4: invalid — 0x01 credentials with 8 ETH\n');
  const tx4 = await buildDepositTx({
    wcPrefix: 0x01,
    amountEth: 8n,
    network: 'mainnet',
  });
  // Force 8 ETH value (buildDepositTx sets it correctly; override the root check to still pass by signing correctly)
  const r4 = validateStakingTx(tx4, { network: 'mainnet' });
  console.log(r4.toString());
}

// ── CLI ────────────────────────────────────────────────────────────────────────

async function main() {
  return selfTest();

  // read from file
  //   const { readFileSync } = await import('fs');
  //   const raw = readFileSync('/temp/deposit.json', 'utf8');

  //   const parsed = JSON.parse(raw);
  //   const network = 'mainnet' as Network;
  //   const tx: StakingTx = {
  //     to: parsed.to,
  //     value: BigInt(parsed.value),
  //     input: parsed.input ?? parsed.data,
  //   };

  //   const result = validateStakingTx(tx, { network });
  //   console.log(result.toString());
  //   console.log(result.passed);
  //   console.log(result.checks);
}

main().catch(console.error);
