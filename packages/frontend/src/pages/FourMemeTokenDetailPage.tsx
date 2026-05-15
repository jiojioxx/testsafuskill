import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, ArrowLeft, TrendingUp, Copy, Check, Loader2 } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { type Hex, parseEther, formatEther } from 'viem';
import { useAccount, useChainId, useSwitchChain, useWriteContract, usePublicClient, useReadContract, useBalance, useSendTransaction } from 'wagmi';
import Footer from '@/components/Footer';
import TokenCommentSection from '@/components/token/TokenCommentSection';
import TokenSkillCard from '@/components/token/TokenSkillCard';
import TokenAuthorClaim from '@/components/token/TokenAuthorClaim';
import PriceChart, { type ParsedTrade } from '@/components/PriceChart';
import { useFourMemeTokenInfo } from '@/hooks/useFourMemeTokenInfo';
import {
  TokenManager2_ABI, Helper3_ABI,
  TOKEN_MANAGER_2, HELPER3_ADDRESS, TREASURY_ADDRESS,
} from '@/lib/fourmeme-contracts';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

function formatPrice(num: number): string {
  if (num === 0) return '0';
  if (num < 0.0001) {
    const s = num.toFixed(18).replace(/0+$/, '');
    const match = s.match(/^0\.(0+)(\d{1,4})/);
    if (match) {
      const subscripts = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
      const sub = String(match[1].length).split('').map(d => subscripts[+d]).join('');
      return `0.0${sub}${match[2]}`;
    }
    return num.toFixed(12);
  }
  if (num < 0.01) return num.toFixed(8);
  return num.toFixed(6);
}

function formatUsd(bnb: number, bnbPrice = 600): string {
  const usd = bnb * bnbPrice;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(4)}`;
}

function timeAgo(date: string, t: (key: string, opts?: any) => string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return t('detail.time.justNow');
  if (s < 3600) return t('detail.time.mAgo', { count: Math.floor(s / 60) });
  if (s < 86400) return t('detail.time.hAgo', { count: Math.floor(s / 3600) });
  return t('detail.time.dAgo', { count: Math.floor(s / 86400) });
}

interface TokenLaunch {
  id: string; name: string; symbol: string; description?: string; imageUrl?: string;
  tokenAddress?: string; txHash?: string; chainId: number; status: string;
  taxRate: number; mktBps: number; deflationBps: number; dividendBps: number; lpBps: number;
  createdAt: string; website?: string; twitter?: string; launchPlatform?: string;
  user: { id: string; username: string; avatarUrl?: string };
  skill?: {
    id: string; name: string; description?: string; authorName?: string; repoUrl?: string;
    sourceRepo?: string; userId?: string; downloadCount?: number; language?: string;
    stars?: number; platforms?: string; category?: string;
    authorClaim?: { id: string; status: string; githubUsername: string; beneficiaryAddress?: string; verifiedAt?: string; user: { id: string; username: string; avatarUrl?: string } } | null;
  };
}

interface Props {
  launch: TokenLaunch;
  onLaunchUpdate: (launch: any) => void;
}

export default function FourMemeTokenDetailPage({ launch, onLaunchUpdate }: Props) {
  const { t } = useTranslation('launchpad');
  const { id } = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [approving, setApproving] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [recentTrades, setRecentTrades] = useState<ParsedTrade[]>([]);
  const [pancakePairAddress, setPancakePairAddress] = useState<string | null>(null);

  const handleTradesLoaded = useCallback((trades: ParsedTrade[]) => {
    setRecentTrades([...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20));
  }, []);

  const { address: walletAddress, isConnected } = useAccount();
  const { user: currentUser } = useAuthStore();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const tokenAddress = launch?.tokenAddress as Hex | undefined;
  const tokenChainId = 56;
  const publicClient = usePublicClient({ chainId: tokenChainId });
  const bscscanBase = 'https://bscscan.com';
  const isCorrectChain = chainId === tokenChainId;
  const authorClaim = launch?.skill?.authorClaim;

  const { tokenInfo } = useFourMemeTokenInfo(tokenAddress, tokenChainId);

  const { data: tokenBalanceRaw, refetch: refetchTokenBalance } = useReadContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: tokenChainId,
    query: { enabled: !!tokenAddress && !!walletAddress, refetchInterval: 15_000 },
  });
  const tokenBalance = tokenBalanceRaw ? Number(formatEther(tokenBalanceRaw as bigint)) : 0;
  const { data: bnbBalanceData, refetch: refetchBnbBalance } = useBalance({
    address: walletAddress as Hex | undefined, chainId: tokenChainId,
    query: { enabled: !!walletAddress, refetchInterval: 15_000 },
  });
  const bnbBalance = bnbBalanceData ? Number(bnbBalanceData.formatted) : 0;

  const { data: totalSupplyRaw } = useReadContract({
    address: tokenAddress, abi: ERC20_ABI, functionName: 'totalSupply',
    chainId: tokenChainId, query: { enabled: !!tokenAddress, refetchInterval: 60_000 },
  });
  const totalSupplyFormatted = totalSupplyRaw
    ? (() => {
        const num = Number(formatEther(totalSupplyRaw as bigint));
        if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
        if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
        return num.toFixed(0);
      })()
    : null;

  const { data: buyPreview } = useReadContract({
    address: HELPER3_ADDRESS, abi: Helper3_ABI, functionName: 'tryBuy',
    args: tokenAddress && tradeTab === 'buy' && amount && Number(amount) > 0
      ? (() => {
          const totalInput = parseEther(amount);
          const taxFee = totalInput / 100n;
          const buyAmount = totalInput - taxFee;
          return [tokenAddress, 0n, buyAmount] as const;
        })() : undefined,
    chainId: tokenChainId,
    query: { enabled: !!tokenAddress && tradeTab === 'buy' && !!amount && Number(amount) > 0 },
  });

  const { data: sellPreview } = useReadContract({
    address: HELPER3_ADDRESS, abi: Helper3_ABI, functionName: 'trySell',
    args: tokenAddress && tradeTab === 'sell' && amount && Number(amount) > 0
      ? [tokenAddress, parseEther(amount)] : undefined,
    chainId: tokenChainId,
    query: { enabled: !!tokenAddress && tradeTab === 'sell' && !!amount && Number(amount) > 0 },
  });

  const previewOutput = useMemo(() => {
    if (!amount || Number(amount) <= 0) return null;
    if (tradeTab === 'buy' && buyPreview) {
      const d = buyPreview as any;
      const raw = Array.isArray(d) ? (d[2] ?? 0n) : (d.estimatedAmount ?? 0n);
      const est = Number(formatEther(raw));
      return { label: `\u2248 ${est >= 1000 ? `${(est / 1000).toFixed(1)}K` : est.toFixed(2)} $${launch?.symbol}` };
    }
    if (tradeTab === 'sell' && sellPreview) {
      const d = sellPreview as any;
      const raw = Array.isArray(d) ? (d[2] ?? 0n) : (d.funds ?? 0n);
      const est = Number(formatEther(raw));
      return { label: `\u2248 ${est.toFixed(6)} BNB` };
    }
    return null;
  }, [amount, tradeTab, buyPreview, sellPreview, launch?.symbol]);

  const handleCopyAddress = () => {
    if (tokenAddress) { navigator.clipboard.writeText(tokenAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  useEffect(() => {
    if (!tokenAddress || !tokenInfo?.liquidityAdded || !publicClient) return;
    publicClient.readContract({
      address: HELPER3_ADDRESS, abi: Helper3_ABI, functionName: 'getPancakePair',
      args: [tokenAddress],
    }).then((pair) => {
      if (pair && pair !== '0x0000000000000000000000000000000000000000') setPancakePairAddress(pair as string);
    }).catch(() => {});
  }, [tokenAddress, tokenInfo?.liquidityAdded, publicClient]);

  const handleRefetchLaunch = async () => {
    if (!id) return;
    const { data } = await api.get(`/tokens/${id}`);
    onLaunchUpdate(data);
  };

  const handleTrade = async () => {
    if (!tokenAddress || !amount || !isConnected) return;
    if (!isCorrectChain) { switchChain({ chainId: tokenChainId }); return; }
    console.info('[FourMemeTokenDetailPage] trade:start', {
      tokenAddress,
      side: tradeTab,
      amount,
      walletAddress,
    });
    setTrading(true); setTradeError('');
    try {
      if (tradeTab === 'buy') {
        const totalInput = parseEther(amount);
        const taxFee = totalInput / 100n;
        const buyAmount = totalInput - taxFee;
        setPayingFee(true);
        await sendTransactionAsync({
          to: TREASURY_ADDRESS,
          value: taxFee,
        });
        setPayingFee(false);
        const txHash = await writeContractAsync({
          address: TOKEN_MANAGER_2, abi: TokenManager2_ABI, functionName: 'buyTokenAMAP',
          args: [tokenAddress, buyAmount, 0n], value: buyAmount, gas: 500000n,
        });
        console.info('[FourMemeTokenDetailPage] trade:buy-submitted', { tokenAddress, amount, txHash });
      } else {
        setApproving(true);
        const inputAmount = parseEther(amount);
        const allowance = await publicClient!.readContract({
          address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance',
          args: [walletAddress as Hex, TOKEN_MANAGER_2],
        });
        console.info('[FourMemeTokenDetailPage] trade:sell-allowance', {
          tokenAddress,
          amount,
          allowance: (allowance as bigint).toString(),
        });
        if ((allowance as bigint) < inputAmount) {
          console.info('[FourMemeTokenDetailPage] trade:sell-approve-start', { tokenAddress, amount });
          await writeContractAsync({
            address: tokenAddress, abi: ERC20_ABI, functionName: 'approve',
            args: [TOKEN_MANAGER_2, inputAmount],
          });
        }
        setApproving(false);
        const txHash = await writeContractAsync({
          address: TOKEN_MANAGER_2, abi: TokenManager2_ABI, functionName: 'sellToken',
          args: [0n, tokenAddress, inputAmount, 0n, 100n, TREASURY_ADDRESS], gas: 500000n,
        });
        console.info('[FourMemeTokenDetailPage] trade:sell-submitted', { tokenAddress, amount, txHash });
      }
      console.info('[FourMemeTokenDetailPage] trade:done', { tokenAddress, side: tradeTab, amount });
      setAmount(''); refetchTokenBalance(); refetchBnbBalance();
    } catch (err: any) {
      console.error('[FourMemeTokenDetailPage] trade:error', {
        tokenAddress,
        side: tradeTab,
        amount,
        message: err?.shortMessage || err?.message,
        raw: err,
      });
      setTradeError(err?.shortMessage || err?.message || t('detail.tradeFailed'));
    } finally { setTrading(false); setApproving(false); setPayingFee(false); }
  };

  const isGraduated = tokenInfo?.liquidityAdded === true;

  if (!launch) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col gap-4 md:gap-6 px-4 sm:px-6 md:px-10 py-4 md:py-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Link to="/launchpad" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
            <div className="flex items-center gap-3">
              {launch.imageUrl ? <img src={launch.imageUrl} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">{launch.symbol[0]}</div>}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{launch.name} (${launch.symbol})</h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{t('detail.createdBy')} {launch.user.username}</span>
                  <span>{timeAgo(launch.createdAt, t)}</span>
                </div>
              </div>
            </div>
          </div>
          {tokenAddress && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="text-muted-foreground/60">{t('detail.ca')}</span>
              <button onClick={handleCopyAddress} className="flex items-center gap-1 font-mono hover:text-foreground transition-colors">
                {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)}
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
              <a href={`${bscscanBase}/token/${tokenAddress}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">{t('detail.bscScan')} <ExternalLink className="w-3 h-3" /></a>
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 font-medium">1% {t('detail.tax')}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">four.meme</span>
              <span className="text-muted-foreground/60">{t('detail.bnbChain')}</span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {tokenInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('detail.price')}</span>
              <p className="text-sm font-semibold text-foreground mt-1">{formatPrice(tokenInfo.priceNum)} BNB</p>
              <p className="text-[10px] text-muted-foreground">{formatUsd(tokenInfo.priceNum)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('detail.marketCap')}</span>
              <p className="text-sm font-semibold text-foreground mt-1">{tokenInfo.marketCap.toFixed(4)} BNB</p>
              <p className="text-[10px] text-muted-foreground">{formatUsd(tokenInfo.marketCap)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('detail.progress')}</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(tokenInfo.progress, 100)}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground">{tokenInfo.progress.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{tokenInfo.progressReserve}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('detail.supply')}</span>
              <p className="text-sm font-semibold text-foreground mt-1">{totalSupplyFormatted ?? '1B'}</p>
              <p className="text-[10px] text-muted-foreground">{t('detail.circulating', { supply: tokenInfo.supply })}</p>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Left */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Price Chart */}
            {id && <PriceChart tokenLaunchId={id} height={360} onTradesLoaded={handleTradesLoaded} />}

            {/* Graduation banner */}
            {isGraduated && tokenAddress && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/30 bg-green-500/10">
                <span className="text-xs text-green-400 font-medium flex-1">{t('detail.listedOnDex')}</span>
                <a href={`https://pancakeswap.finance/swap?outputCurrency=${tokenAddress}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition-colors">
                  Trade on PancakeSwap
                </a>
                {pancakePairAddress && (
                  <a href={`https://pancakeswap.finance/info/pairs/${pancakePairAddress}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition-colors">
                    View Pool
                  </a>
                )}
                <a href={`https://dexscreener.com/bsc/${tokenAddress}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition-colors">
                  DexScreener
                </a>
              </div>
            )}

            {/* Description + links */}
            {(launch.description || launch.website || launch.twitter) && (
              <div className="p-4 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-semibold text-foreground mb-2">{t('detail.about')}</h3>
                {launch.description && <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{launch.description}</p>}
                {(launch.website || launch.twitter) && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {launch.website && <a href={launch.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" /> {launch.website.replace(/^https?:\/\//, '')}</a>}
                    {launch.twitter && <a href={launch.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" /> {launch.twitter.replace(/^https?:\/\//, '')}</a>}
                  </div>
                )}
              </div>
            )}

            <TokenCommentSection tokenLaunchId={id!} isConnected={isConnected} currentUser={currentUser} />
            {launch.skill && <TokenSkillCard skill={launch.skill} authorClaim={authorClaim} />}
          </div>

          {/* Right: Trade Panel */}
          <div className="w-full lg:w-[340px] flex flex-col gap-4">
            {!isGraduated ? (
              <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-4">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button onClick={() => { setTradeTab('buy'); setAmount(''); }} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tradeTab === 'buy' ? 'bg-green-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>{t('detail.buy')}</button>
                  <button onClick={() => { setTradeTab('sell'); setAmount(''); }} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tradeTab === 'sell' ? 'bg-destructive text-white' : 'text-muted-foreground hover:text-foreground'}`}>{t('detail.sell')}</button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('detail.amount')}</span>
                    {walletAddress && <span className="text-xs text-muted-foreground">{tradeTab === 'buy' ? `${t('detail.balance')}: ${bnbBalance.toFixed(4)} BNB` : `${t('detail.balance')}: ${tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} $${launch.symbol}`}</span>}
                  </div>
                  <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-11 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <div className="flex gap-2">
                    {tradeTab === 'buy' ? (
                      <>
                        <button onClick={() => setAmount('')} className="flex-1 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">{t('detail.reset')}</button>
                        {['0.1', '0.5', '1'].map((v) => <button key={v} onClick={() => setAmount(v)} className="flex-1 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">{v} BNB</button>)}
                      </>
                    ) : (
                      <>
                        <button onClick={() => setAmount('')} className="flex-1 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">{t('detail.reset')}</button>
                        {['25%', '50%', '100%'].map((v) => <button key={v} onClick={() => { const pct = parseInt(v) / 100; if (v === '100%' && tokenBalanceRaw) setAmount(formatEther(tokenBalanceRaw as bigint)); else setAmount((tokenBalance * pct).toFixed(6)); }} className="flex-1 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">{v}</button>)}
                      </>
                    )}
                  </div>
                </div>
                {previewOutput && <p className="text-xs text-muted-foreground">{t('detail.youWillReceive', { amount: previewOutput.label })}</p>}
                {tradeTab === 'sell' && <p className="text-[10px] text-muted-foreground">{t('detail.fourmeme.sellNote')}</p>}
                {tradeError && <p className="text-xs text-destructive">{tradeError}</p>}
                {!isConnected ? (
                  <ConnectButton.Custom>{({ openConnectModal }) => (<button onClick={openConnectModal} className="h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity w-full">{t('detail.connectWallet')}</button>)}</ConnectButton.Custom>
                ) : !isCorrectChain ? (
                  <button onClick={() => switchChain({ chainId: tokenChainId })} className="h-11 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:opacity-90 transition-opacity">{t('detail.switchChain', { chain: t('detail.bnbChain') })}</button>
                ) : (
                  <button onClick={handleTrade} disabled={trading || payingFee || !amount || Number(amount) <= 0}
                    className={`h-11 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${tradeTab === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-destructive hover:opacity-90'}`}>
                    {trading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                    {payingFee ? t('detail.fourmeme.payingFee') : approving ? t('detail.fourmeme.approving') : trading ? t('detail.processing') : tradeTab === 'buy' ? t('detail.buy') : t('detail.sell')}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-card text-center">
                <p className="text-sm text-muted-foreground mb-3">{t('detail.fourmeme.graduated')}</p>
                <a href={`https://pancakeswap.finance/swap?outputCurrency=${tokenAddress}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                  Trade on PancakeSwap <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Recent Trades */}
            {recentTrades.length > 0 && (
              <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('detail.recentTrades')}</h3>
                <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
                  {recentTrades.map((trade, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-medium ${trade.isBuy ? 'text-green-500' : 'text-red-500'}`}>{trade.isBuy ? t('detail.buyLabel') : t('detail.sellLabel')}</span>
                        <span className="text-muted-foreground">{timeAgo(new Date(trade.timestamp).toISOString(), t)}</span>
                      </div>
                      <span className="text-foreground font-mono">{formatPrice(trade.bnbAmount)} BNB</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token Info */}
            {tokenInfo && (
              <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-2 flex-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('detail.tokenInfo')}</h3>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.supply')}</span><span className="text-foreground font-medium">{totalSupplyFormatted ?? '1B'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.reserve')}</span><span className="text-foreground font-medium">{Number(formatEther(tokenInfo.funds)).toFixed(4)} BNB</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.taxRate')}</span><span className="text-foreground font-medium">1%</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.fourmeme.platform')}</span><span className="text-foreground font-medium">four.meme</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.createdBy')}</span><span className="text-foreground font-medium">{launch.user.username}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">{t('detail.network')}</span><span className="text-foreground font-medium">{t('detail.bnbChain')}</span></div>
              </div>
            )}

            {/* Author Claim */}
            {launch.skill && (
              <TokenAuthorClaim skill={launch.skill} authorClaim={authorClaim} tokenAddress={tokenAddress}
                tokenLaunchId={id!} bscscanBase={bscscanBase} taxRate={launch.taxRate} mktBps={launch.mktBps}
                onClaimSuccess={handleRefetchLaunch} />
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
