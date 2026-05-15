import { encodePacked, keccak256, getContractAddress, toBytes, toHex, type Hex } from 'viem';

// Portal contract addresses
export const PORTAL_ADDRESSES = {
  56: '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0' as Hex,   // BNB Mainnet
  97: '0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9' as Hex,   // BNB Testnet
} as const;

// Default quote tokens (WBNB)
export const QUOTE_TOKENS = {
  56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as Hex,   // WBNB Mainnet
  97: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd' as Hex,   // WBNB Testnet
} as const;

// IPFS gateway for Flap metadata
export const FLAP_IPFS_GATEWAY = 'https://flap.mypinata.cloud/ipfs';

// Standard token implementation addresses (for CREATE2 salt computation)
export const STD_TOKEN_IMPL = {
  56: '0x8b4329947e34b6d56d71a3385cac122bade7d78d' as Hex,  // BNB Mainnet
  97: '0x87D5f292ba33011997641C7a7Bd2b17799aaA814' as Hex,  // BNB Testnet
} as const;

// Portal ABI — newTokenV2 + newTokenV5 + getTokenV7 + quoteExactInput + swapExactInput
export const PORTAL_ABI = [
  // --- Token Creation (newTokenV2 — used by flap.sh frontend) ---
  {
    name: 'newTokenV2',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'meta', type: 'string' },
          { name: 'dexThresh', type: 'uint8' },
          { name: 'salt', type: 'bytes32' },
          { name: 'taxRate', type: 'uint16' },
          { name: 'migratorType', type: 'uint8' },
          { name: 'quoteToken', type: 'address' },
          { name: 'quoteAmt', type: 'uint256' },
          { name: 'beneficiary', type: 'address' },
          { name: 'permitData', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  // --- Token Creation (newTokenV5 — full tax V2 support) ---
  {
    name: 'newTokenV5',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'meta', type: 'string' },
          { name: 'dexThresh', type: 'uint8' },
          { name: 'salt', type: 'bytes32' },
          { name: 'taxRate', type: 'uint16' },
          { name: 'migratorType', type: 'uint8' },
          { name: 'quoteToken', type: 'address' },
          { name: 'quoteAmt', type: 'uint256' },
          { name: 'beneficiary', type: 'address' },
          { name: 'permitData', type: 'bytes' },
          { name: 'extensionID', type: 'bytes32' },
          { name: 'extensionData', type: 'bytes' },
          { name: 'dexId', type: 'uint8' },
          { name: 'lpFeeProfile', type: 'uint8' },
          { name: 'taxDuration', type: 'uint64' },
          { name: 'antiFarmerDuration', type: 'uint64' },
          { name: 'mktBps', type: 'uint16' },
          { name: 'deflationBps', type: 'uint16' },
          { name: 'dividendBps', type: 'uint16' },
          { name: 'lpBps', type: 'uint16' },
          { name: 'minimumShareBalance', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  // --- Token Inspection ---
  {
    name: 'getTokenV7',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [
      {
        name: 'state',
        type: 'tuple',
        internalType: 'struct IPortalTypes.TokenStateV7',
        components: [
          { name: 'status', type: 'uint8', internalType: 'enum IPortalTypes.TokenStatus' },
          { name: 'reserve', type: 'uint256', internalType: 'uint256' },
          { name: 'circulatingSupply', type: 'uint256', internalType: 'uint256' },
          { name: 'price', type: 'uint256', internalType: 'uint256' },
          { name: 'tokenVersion', type: 'uint8', internalType: 'enum IPortalTypes.TokenVersion' },
          { name: 'r', type: 'uint256', internalType: 'uint256' },
          { name: 'h', type: 'uint256', internalType: 'uint256' },
          { name: 'k', type: 'uint256', internalType: 'uint256' },
          { name: 'dexSupplyThresh', type: 'uint256', internalType: 'uint256' },
          { name: 'quoteTokenAddress', type: 'address', internalType: 'address' },
          { name: 'nativeToQuoteSwapEnabled', type: 'bool', internalType: 'bool' },
          { name: 'extensionID', type: 'bytes32', internalType: 'bytes32' },
          { name: 'taxRate', type: 'uint256', internalType: 'uint256' },
          { name: 'pool', type: 'address', internalType: 'address' },
          { name: 'progress', type: 'uint256', internalType: 'uint256' },
          { name: 'lpFeeProfile', type: 'uint8', internalType: 'enum IPortalTypes.V3LPFeeProfile' },
          { name: 'dexId', type: 'uint8', internalType: 'enum IPortalTypes.DEXId' },
        ],
      },
    ],
  },
  // --- Trading ---
  {
    name: 'quoteExactInput',
    type: 'function',
    stateMutability: 'nonpayable',  // use eth_call
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'inputToken', type: 'address' },
          { name: 'outputToken', type: 'address' },
          { name: 'inputAmount', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'outputAmount', type: 'uint256' }],
  },
  {
    name: 'swapExactInput',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'inputToken', type: 'address' },
          { name: 'outputToken', type: 'address' },
          { name: 'inputAmount', type: 'uint256' },
          { name: 'minOutputAmount', type: 'uint256' },
          { name: 'permitData', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'outputAmount', type: 'uint256' }],
  },
  // --- Events ---
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'timestamp', type: 'uint256', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'meta', type: 'string', indexed: false },
    ],
  },
  // Trade events — names match official Flap docs
  {
    name: 'TokenBought',
    type: 'event',
    inputs: [
      { name: 'ts', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'eth', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'postPrice', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'TokenSold',
    type: 'event',
    inputs: [
      { name: 'ts', type: 'uint256', indexed: false },
      { name: 'token', type: 'address', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'eth', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'postPrice', type: 'uint256', indexed: false },
    ],
  },
  // Supply change event — emitted on every trade
  {
    name: 'FlapTokenCirculatingSupplyChanged',
    type: 'event',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'newSupply', type: 'uint256', indexed: false },
    ],
  },
] as const;

/** Token state from getTokenV7 (matches official ABI) */
export interface TokenStateV7 {
  status: number;
  reserve: bigint;
  circulatingSupply: bigint;
  price: bigint;
  tokenVersion: number;
  r: bigint;
  h: bigint;
  k: bigint;
  dexSupplyThresh: bigint;
  quoteTokenAddress: Hex;
  nativeToQuoteSwapEnabled: boolean;
  extensionID: Hex;
  taxRate: bigint;
  pool: Hex;
  progress: bigint;
  lpFeeProfile: number;
  dexId: number;
}

export const TOKEN_STATUS_LABELS: Record<number, string> = {
  0: 'Bonding Curve',
  1: 'Bonding Curve',
  2: 'Migrating',
  3: 'Migrating',
  4: 'On DEX',
};

/**
 * Parse token metadata from Flap IPFS
 */
export async function parseTokenMeta(cid: string): Promise<{
  creator?: string;
  description?: string;
  image?: string;
  buy?: string;
  sell?: string;
  telegram?: string;
  twitter?: string;
  website?: string;
}> {
  const res = await fetch(`${FLAP_IPFS_GATEWAY}/${cid}`);
  if (!res.ok) throw new Error('Failed to fetch token metadata');
  const data = await res.json();
  // Resolve image CID to full URL
  if (data.image && !data.image.startsWith('http')) {
    data.image = `${FLAP_IPFS_GATEWAY}/${data.image}`;
  }
  return data;
}

export interface NewTokenV5Params {
  name: string;
  symbol: string;
  meta: string;              // IPFS CID
  dexThresh: number;         // DexThreshType: 0 = default
  salt: Hex;                 // CREATE2 salt
  taxRate: number;           // 0 for standard token, >0 for tax token (bps)
  migratorType: number;      // 0 = default, use V2_MIGRATOR for tax tokens
  quoteToken: Hex;           // address(0) for native gas token
  quoteAmt: bigint;          // initial liquidity in wei
  beneficiary: Hex;          // tax beneficiary address
  permitData: Hex;           // permit data (0x for none)
  extensionID: Hex;          // extension ID (bytes32 zero for none)
  extensionData: Hex;        // extension data (0x for none)
  dexId: number;             // DEXId: 0 = PancakeSwap
  lpFeeProfile: number;      // V3LPFeeProfile: 0 = default
  taxDuration: bigint;       // seconds tax is active (uint64)
  antiFarmerDuration: bigint; // anti-bot duration in seconds (uint64)
  mktBps: number;            // marketing tax share (basis points)
  deflationBps: number;      // burn tax share
  dividendBps: number;       // dividend tax share
  lpBps: number;             // LP tax share
  minimumShareBalance: bigint; // minimum balance for dividend share
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Hex;
const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

/**
 * Build default NewTokenV5Params with fixed 1% tax (all to treasury via Tax Splitter)
 * NOTE: This helper is kept for reference but the actual launch uses useLaunchToken hook directly.
 */
export function buildDefaultParams(
  name: string,
  symbol: string,
  meta: string,
  salt: Hex,
  _chainId: 56 | 97 = 56,
): NewTokenV5Params {
  return {
    name,
    symbol,
    meta,
    dexThresh: 0,
    salt,
    taxRate: 100,  // 1% = 100 bps（固定协议税）
    migratorType: 0,
    quoteToken: ZERO_ADDR,       // address(0) = native gas token
    quoteAmt: 0n,
    beneficiary: ZERO_ADDR,
    permitData: '0x' as Hex,
    extensionID: ZERO_BYTES32,
    extensionData: '0x' as Hex,
    dexId: 0,
    lpFeeProfile: 0,
    taxDuration: 0n,
    antiFarmerDuration: 0n,
    mktBps: 10000,
    deflationBps: 0,
    dividendBps: 0,
    lpBps: 0,
    minimumShareBalance: 0n,
  };
}

/**
 * Find a CREATE2 salt that produces a token address ending in the target suffix.
 * Standard tokens: 8888, Tax tokens: 7777
 * Uses EIP-1167 minimal proxy bytecode with the token implementation address.
 */
export async function findVanitySalt(
  portalAddress: Hex,
  tokenImpl: Hex,
  targetSuffix = '8888',
  maxIterations = 2_000_000,
): Promise<Hex> {
  const bytecode = ('0x3d602d80600a3d3981f3363d3d373d3d3d363d73'
    + tokenImpl.slice(2).toLowerCase()
    + '5af43d82803e903d91602b57fd5bf3') as Hex;

  // Start with a random seed
  let salt = keccak256(encodePacked(['uint256'], [BigInt(Date.now())]));

  for (let i = 0; i < maxIterations; i++) {
    const addr = getContractAddress({
      from: portalAddress,
      salt: toBytes(salt),
      bytecode,
      opcode: 'CREATE2',
    });
    if (addr.toLowerCase().endsWith(targetSuffix)) {
      return salt;
    }
    salt = keccak256(salt);
    // Yield to main thread every 10k iterations
    if (i % 10000 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  throw new Error(`Could not find vanity salt ending in ${targetSuffix} after ${maxIterations} iterations`);
}

/**
 * Upload token metadata to Flap IPFS and return CID
 */
export async function uploadMetadata(
  name: string,
  symbol: string,
  description: string,
  imageFile?: File,
  website?: string,
  twitter?: string,
): Promise<string> {
  const meta: Record<string, string> = { name, symbol, description };
  if (website) meta.website = website;
  if (twitter) meta.twitter = twitter;

  const operations = JSON.stringify({
    query: 'mutation($file: Upload!, $meta: MetaInput!) { upload(file: $file, meta: $meta) { cid } }',
    variables: {
      file: null,
      meta,
    },
  });
  const map = JSON.stringify({ '0': ['variables.file'] });

  const formData = new FormData();
  formData.append('operations', operations);
  formData.append('map', map);
  // Use image file if provided, otherwise send a minimal placeholder
  if (imageFile) {
    formData.append('0', imageFile);
  } else {
    formData.append('0', new Blob([''], { type: 'image/png' }), 'placeholder.png');
  }

  const res = await fetch('https://funcs.flap.sh/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Metadata upload failed: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(data.errors[0].message);
  }
  // Flap API 返回格式可能是 { data: { create: "cid" } } 或 { data: { upload: { cid: "cid" } } }
  const cid = data.data?.create || data.data?.upload?.cid;
  if (!cid) {
    console.error('[flap-portal] uploadMetadata: unexpected response', data);
    throw new Error('Metadata upload succeeded but no CID returned');
  }
  return cid;
}

/**
 * Get the Portal contract address for a given chain
 */
export function getPortalAddress(chainId: number): Hex {
  const addr = PORTAL_ADDRESSES[chainId as keyof typeof PORTAL_ADDRESSES];
  if (!addr) throw new Error(`Unsupported chain: ${chainId}`);
  return addr;
}
