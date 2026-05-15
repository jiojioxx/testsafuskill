import { useReadContract } from 'wagmi';
import { type Hex, formatEther } from 'viem';
import { Helper3_ABI, HELPER3_ADDRESS } from '@/lib/fourmeme-contracts';

export interface FourMemeTokenInfo {
  lastPrice: bigint;
  priceNum: number;
  offers: bigint;
  maxOffers: bigint;
  funds: bigint;
  maxFunds: bigint;
  progress: number;
  progressReserve: string;
  liquidityAdded: boolean;
  tradingFeeRate: bigint;
  marketCap: number;
  supply: string;
}

function formatTokenSupply(supply: bigint): string {
  const num = Number(formatEther(supply));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
}

export function mapFourMemeTokenInfo(data: any): FourMemeTokenInfo | null {
  if (!data) return null;
  const d = data as any;

  const lastPrice: bigint = Array.isArray(d) ? (d[3] ?? 0n) : (d.lastPrice ?? 0n);
  const tradingFeeRate: bigint = Array.isArray(d) ? (d[4] ?? 0n) : (d.tradingFeeRate ?? 0n);
  const offers: bigint = Array.isArray(d) ? (d[7] ?? 0n) : (d.offers ?? 0n);
  const maxOffers: bigint = Array.isArray(d) ? (d[8] ?? 0n) : (d.maxOffers ?? 0n);
  const funds: bigint = Array.isArray(d) ? (d[9] ?? 0n) : (d.funds ?? 0n);
  const maxFunds: bigint = Array.isArray(d) ? (d[10] ?? 0n) : (d.maxFunds ?? 0n);
  const liquidityAdded: boolean = Array.isArray(d) ? (d[11] ?? false) : (d.liquidityAdded ?? false);
  const priceNum = Number(formatEther(lastPrice));

  const progress = maxFunds > 0n
    ? Number(funds * 10000n / maxFunds) / 100
    : 0;

  const fundsNum = Number(formatEther(funds));
  const maxFundsNum = Number(formatEther(maxFunds));
  const progressReserve = `${fundsNum.toFixed(2)} / ${maxFundsNum.toFixed(0)} BNB`;

  const marketCap = priceNum * 1_000_000_000;

  return {
    lastPrice,
    priceNum,
    offers,
    maxOffers,
    funds,
    maxFunds,
    progress,
    progressReserve,
    liquidityAdded,
    tradingFeeRate,
    marketCap,
    supply: formatTokenSupply(offers),
  };
}

export function useFourMemeTokenInfo(tokenAddress: Hex | undefined, chainId: number) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: HELPER3_ADDRESS,
    abi: Helper3_ABI,
    functionName: 'getTokenInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress,
      refetchInterval: 15_000,
    },
  });

  const tokenInfo = mapFourMemeTokenInfo(data);

  return { tokenInfo, isLoading, error, refetch };
}
