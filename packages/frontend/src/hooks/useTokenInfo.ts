import { useReadContract } from 'wagmi';
import { type Hex, formatEther } from 'viem';
import { PORTAL_ABI, getPortalAddress, TOKEN_STATUS_LABELS } from '@/lib/flap-portal';

export interface TokenInfo {
  status: string;
  statusCode: number;
  price: string;
  priceRaw: bigint;
  priceNum: number;
  reserve: string;
  reserveRaw: bigint;
  reserveNum: number;
  supply: string;
  supplyRaw: bigint;
  supplyNum: number;         // supply in token units (not wei)
  progress: number;          // 0-100 percentage toward DEX
  progressReserve: string;   // e.g. "0.1 / 16 BNB"
  taxRate: number;           // basis points from chain
  taxRatePercent: number;    // e.g. 1 for 1%
  pool: Hex;
  marketCap: number;         // in BNB
  // Bonding curve params
  r: bigint;
  rNum: number;
  h: bigint;
  hNum: number;
  k: bigint;
  kNum: number;
  dexSupplyThresh: bigint;
  dexSupplyThreshNum: number;
}

export function useTokenInfo(tokenAddress: Hex | undefined, chainId: number) {
  const portalAddress = (() => {
    try {
      return getPortalAddress(chainId);
    } catch {
      return undefined;
    }
  })();

  const { data, isLoading, error, refetch } = useReadContract({
    address: portalAddress,
    abi: PORTAL_ABI,
    functionName: 'getTokenV7',
    args: tokenAddress ? [tokenAddress] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress && !!portalAddress,
      refetchInterval: 15_000,
    },
  });

  const tokenInfo: TokenInfo | null = (() => {
    if (!data) return null;
    const d = data as any;

    const priceRaw: bigint = d.price;
    const priceNum = Number(formatEther(priceRaw));
    const reserveRaw: bigint = d.reserve;
    const reserveNum = Number(formatEther(reserveRaw));
    const supplyRaw: bigint = d.circulatingSupply;
    const supplyNum = Number(formatEther(supplyRaw));
    const progressRaw: bigint = d.progress;
    const progress = Number((progressRaw * 10000n) / BigInt(1e18)) / 100;
    const taxRate: number = Number(d.taxRate);

    // Bonding curve params — stored as raw numbers (not wei-scaled in the curve)
    const rRaw: bigint = d.r;
    const rNum = Number(formatEther(rRaw));
    const hRaw: bigint = d.h;
    const hNum = Number(formatEther(hRaw));
    const kRaw: bigint = d.k;
    const kNum = Number(formatEther(kRaw));
    const dexSupplyThresh: bigint = d.dexSupplyThresh;
    const dexSupplyThreshNum = Number(formatEther(dexSupplyThresh)); // wei-scaled, convert to tokens

    // Market cap = price * 1 billion tokens
    const marketCap = priceNum * 1_000_000_000;

    // dexSupplyThresh on BSC is typically 16 BNB reserve target
    // Progress reserve display
    const maxReserveBnb = chainId === 97 ? 16 : 16; // BSC testnet & mainnet
    const progressReserve = `${reserveNum.toFixed(2)} / ${maxReserveBnb} BNB`;

    return {
      statusCode: d.status,
      status: TOKEN_STATUS_LABELS[d.status] || 'Unknown',
      priceRaw,
      price: formatEther(priceRaw),
      priceNum,
      reserveRaw,
      reserve: formatEther(reserveRaw),
      reserveNum,
      supplyRaw,
      supply: formatTokenSupply(supplyRaw),
      supplyNum,
      progress,
      progressReserve,
      taxRate,
      taxRatePercent: taxRate / 100,
      pool: d.pool,
      marketCap,
      r: rRaw,
      rNum,
      h: hRaw,
      hNum,
      k: kRaw,
      kNum,
      dexSupplyThresh,
      dexSupplyThreshNum,
    };
  })();

  return { tokenInfo, isLoading, error, refetch };
}

function formatTokenSupply(supply: bigint): string {
  const num = Number(formatEther(supply));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}
