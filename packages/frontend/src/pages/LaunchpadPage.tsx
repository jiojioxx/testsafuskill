import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Rocket, Plus, TrendingUp, Download, SlidersHorizontal, Search, X, BarChart3, Layers } from 'lucide-react';
import { type Hex, formatEther } from 'viem';
import { useReadContracts } from 'wagmi';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { PORTAL_ABI, getPortalAddress } from '@/lib/flap-portal';
import { HELPER3_ADDRESS, Helper3_ABI } from '@/lib/fourmeme-contracts';
import { mapFourMemeTokenInfo } from '@/hooks/useFourMemeTokenInfo';

interface TokenLaunch {
  id: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  tokenAddress?: string;
  txHash?: string;
  chainId: number;
  status: string;
  taxRate: number;
  createdAt: string;
  launchPlatform?: string;
  user: { id: string; username: string; avatarUrl?: string };
  skill?: { id: string; name: string; downloadCount?: number };
}

type OnChainData = { price: bigint; progress: number; marketCap?: number };
type PlatformFilter = 'ALL' | 'FOURMEME' | 'FLAP';
type ProgressTag = 'P1' | 'P2' | 'P3';
type ViewMode = 'kanban' | 'leaderboard';

interface ColFilter {
  keyword: string;
  minLiquidity: number;
  minDownloads: number;
  tags: ProgressTag[];
  open: boolean;
}

const stepKeys = ['submitSkill', 'createToken', 'deployOnChain', 'tradeEarn'];

// ── Demo tokens (shown when API returns empty) ──────────────────────────────
const DEMO_LAUNCHES: TokenLaunch[] = [
  { id: 'demo-15', name: 'NeuralShield', symbol: 'NSH', description: 'AI 驱动的神经网络安全防护技能', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-14T15:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u15', username: 'neuraldev' }, skill: { id: 's15', name: 'Neural Guard', downloadCount: 318 } },
  { id: 'demo-14', name: 'QuantBot', symbol: 'QBOT', description: '量化交易策略代币 · 全自动对冲', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-14T12:00:00Z', launchPlatform: 'FLAP', user: { id: 'u14', username: 'quantlabs' }, skill: { id: 's14', name: 'Quant Strategist', downloadCount: 892 } },
  { id: 'demo-13', name: 'OracleAI', symbol: 'ORCL', description: '多源价格预言机聚合 · 抗操纵设计', chainId: 56, status: 'ACTIVE', taxRate: 200, createdAt: '2026-05-14T08:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u13', username: 'oraclefi' }, skill: { id: 's13', name: 'Oracle Aggregator', downloadCount: 1103 } },
  { id: 'demo-12', name: 'GasWatcher', symbol: 'GASW', description: '实时 Gas 费监控 · 最优提交时机预测', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-13T20:00:00Z', launchPlatform: 'FLAP', user: { id: 'u12', username: 'gaswatcher' }, skill: { id: 's12', name: 'Gas Optimizer', downloadCount: 567 } },
  { id: 'demo-11', name: 'SentinelX', symbol: 'SNTL', description: '链上异常行为实时监控与预警系统', chainId: 56, status: 'ACTIVE', taxRate: 300, createdAt: '2026-05-13T14:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u11', username: 'sentinelx' }, skill: { id: 's11', name: 'Anomaly Detector', downloadCount: 743 } },
  { id: 'demo-10', name: 'BridgeGuard', symbol: 'BRDG', description: '跨链资产桥接风险评估与安全验证', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-13T08:00:00Z', launchPlatform: 'FLAP', user: { id: 'u10', username: 'bridgeguard' }, skill: { id: 's10', name: 'Bridge Auditor', downloadCount: 421 } },
  { id: 'demo-9', name: 'YieldHunter', symbol: 'YHNT', description: 'DeFi 收益聚合器 · 自动复利最优路径', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-12T18:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u9', username: 'yieldhunter' }, skill: { id: 's9', name: 'Yield Optimizer', downloadCount: 1856 } },
  { id: 'demo-8', name: 'SnipeBlock', symbol: 'SNPB', description: '防狙击机器人 · 公平发射保障协议', chainId: 56, status: 'ACTIVE', taxRate: 200, createdAt: '2026-05-12T10:00:00Z', launchPlatform: 'FLAP', user: { id: 'u8', username: 'snipeblock' }, skill: { id: 's8', name: 'Anti-Snipe Shield', downloadCount: 2034 } },
  { id: 'demo-5', name: 'DeepScan', symbol: 'DEEP', description: '深度链上数据分析，挖掘聪明钱流向', chainId: 56, status: 'ACTIVE', taxRate: 300, createdAt: '2026-05-11T22:00:00Z', launchPlatform: 'FLAP', user: { id: 'u5', username: 'deepchain' }, skill: { id: 's5', name: 'SmartMoney Tracker', downloadCount: 1567 } },
  { id: 'demo-4', name: 'FlashBot', symbol: 'FLASH', description: '高频套利机器人 · 闪电执行 · 零滑点', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-11T16:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u4', username: 'flashlabs' }, skill: { id: 's4', name: 'MEV Flash Arb', downloadCount: 2891 } },
  { id: 'demo-3', name: 'Radar Signal', symbol: 'RADAR', description: '聚合多链早期信号，提前发现潜力项目', chainId: 56, status: 'ACTIVE', taxRate: 200, createdAt: '2026-05-11T10:00:00Z', launchPlatform: 'FLAP', user: { id: 'u3', username: 'radarfi' }, skill: { id: 's3', name: 'Alpha Radar', downloadCount: 432 } },
  { id: 'demo-2', name: 'Audit Shield', symbol: 'AUDIT', description: '实时智能合约漏洞检测，守护你的资产安全', chainId: 56, status: 'ACTIVE', taxRate: 100, createdAt: '2026-05-10T20:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u2', username: 'auditlabs' }, skill: { id: 's2', name: 'Contract Auditor', downloadCount: 876 } },
  { id: 'demo-1', name: 'SafeGuard AI', symbol: 'SAFE', description: '基于 AI 的链上合约安全扫描技能代币', chainId: 56, status: 'ACTIVE', taxRate: 500, createdAt: '2026-05-10T10:00:00Z', launchPlatform: 'FLAP', user: { id: 'u1', username: 'safudev' }, skill: { id: 's1', name: 'Rug Detector Pro', downloadCount: 1204 } },
  { id: 'demo-6', name: 'VaultMaster', symbol: 'VAULT', description: '多签金库管理 · 一站式资产保险箱', chainId: 56, status: 'LISTED', taxRate: 100, createdAt: '2026-05-09T12:00:00Z', launchPlatform: 'FOURMEME', user: { id: 'u6', username: 'vaultprotocol' }, skill: { id: 's6', name: 'Vault Guardian', downloadCount: 3402 } },
  { id: 'demo-7', name: 'ChainGuard', symbol: 'CGT', description: '全链风险监控 · 异常交易实时预警', chainId: 56, status: 'LISTED', taxRate: 100, createdAt: '2026-05-08T10:00:00Z', launchPlatform: 'FLAP', user: { id: 'u7', username: 'chainguard' }, skill: { id: 's7', name: 'Risk Monitor', downloadCount: 2218 } },
];

const DEMO_ONCHAIN: Map<string, OnChainData> = new Map([
  ['demo-15', { price: 5_100_000_000n, progress: 4.2 }],
  ['demo-14', { price: 5_200_000_000n, progress: 11.7 }],
  ['demo-13', { price: 5_300_000_000n, progress: 22.5 }],
  ['demo-12', { price: 5_400_000_000n, progress: 31.0 }],
  ['demo-11', { price: 5_500_000_000n, progress: 38.4 }],
  ['demo-10', { price: 5_600_000_000n, progress: 47.9 }],
  ['demo-9',  { price: 5_700_000_000n, progress: 58.3 }],
  ['demo-8',  { price: 5_800_000_000n, progress: 67.1 }],
  ['demo-5',  { price: 5_900_000_000n, progress: 73.2 }],
  ['demo-4',  { price: 6_000_000_000n, progress: 81.5 }],
  ['demo-3',  { price: 6_100_000_000n, progress: 88.8 }],
  ['demo-2',  { price: 6_200_000_000n, progress: 91.4 }],
  ['demo-1',  { price: 6_300_000_000n, progress: 96.7 }],
  ['demo-6',  { price: 5_000_000_000_000n, progress: 100, marketCap: 4850 }],
  ['demo-7',  { price: 3_500_000_000_000n, progress: 100, marketCap: 3120 }],
]);

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatPrice(price: bigint): string {
  const num = Number(formatEther(price));
  if (num === 0) return '0';
  if (num < 0.0001) {
    const s = num.toFixed(18).replace(/0+$/, '');
    const match = s.match(/^0\.(0+)(\d{1,4})/);
    if (match) {
      const subscripts = '₀₁₂₃₄₅₆₇₈₉';
      const sub = String(match[1].length).split('').map(d => subscripts[+d]).join('');
      return `0.0${sub}${match[2]}`;
    }
    return num.toFixed(12);
  }
  if (num < 0.01) return num.toFixed(8);
  return num.toFixed(6);
}

function formatMcap(bnb: number): string {
  if (bnb >= 1000) return `${(bnb / 1000).toFixed(1)}K BNB`;
  if (bnb >= 100) return `${bnb.toFixed(0)} BNB`;
  return `${bnb.toFixed(1)} BNB`;
}

function getMcap(data: OnChainData | null | undefined): number {
  if (!data) return 0;
  return data.marketCap ?? Number(formatEther(data.price)) * 1_000_000_000;
}

function getProgressTag(progress: number | null): ProgressTag | null {
  if (progress === null) return null;
  if (progress < 33) return 'P1';
  if (progress < 66) return 'P2';
  return 'P3';
}

function PlatformBadge({ platform }: { platform?: string }) {
  return platform === 'FOURMEME'
    ? <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-amber-500/10 text-amber-500 font-medium">four.meme</span>
    : <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 font-medium">flap.sh</span>;
}

// ── Compact card (kanban) ────────────────────────────────────────────────────
function CompactCard({ launch, onChainData, isDemo }: {
  launch: TokenLaunch;
  onChainData?: OnChainData | null;
  isDemo?: boolean;
}) {
  const progress = onChainData?.progress ?? null;
  const mcap = getMcap(onChainData);

  const inner = (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-card/70 hover:border-border hover:shadow-sm transition-all duration-150">

      {/* Row 1: avatar · symbol · name · desc ··· badges */}
      <div className="flex items-center gap-2 min-w-0">
        {launch.imageUrl ? (
          <img src={launch.imageUrl} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
            {launch.symbol[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-bold text-foreground">${launch.symbol}</span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{launch.name}</span>
            {launch.description && (
              <span className="text-[10px] text-muted-foreground/30 truncate">{launch.description}</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: price · mcap */}
      <div className="flex items-center gap-2 min-w-0">
        {onChainData && onChainData.price > 0n ? (
          <div className="flex items-center gap-1 shrink-0">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-emerald-400 font-semibold">{formatPrice(onChainData.price)}</span>
            <span className="text-[9px] text-muted-foreground/40">BNB</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/20 shrink-0">—</span>
        )}
        {mcap > 0 && (
          <span className="text-[10px] text-muted-foreground/50 shrink-0">{formatMcap(mcap)}</span>
        )}
      </div>

      {/* Row 3: progress bar */}
      {progress !== null && (
        <div className="flex items-center gap-1">
          <div className="w-20 h-[2px] bg-border/50 rounded-full overflow-hidden">
            <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="text-[9px] text-muted-foreground/40 tabular-nums">{progress.toFixed(0)}%</span>
        </div>
      )}

      {/* Row 4: skill · downloads ··· tax% + platform */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {launch.skill && (
            <>
              <span className="text-[9px] text-amber-500/70 truncate">{launch.skill.name}</span>
              {launch.skill.downloadCount != null && launch.skill.downloadCount > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/40 shrink-0">
                  <Download className="w-2 h-2" />
                  {launch.skill.downloadCount}
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {launch.taxRate > 0 && (
            <span className="text-[9px] text-orange-400/70 font-medium">{(launch.taxRate / 100).toFixed(0)}%</span>
          )}
          <PlatformBadge platform={launch.launchPlatform} />
        </div>
      </div>

    </div>
  );

  if (isDemo) return inner;
  return <Link to={`/launchpad/${launch.id}`}>{inner}</Link>;
}

// ── Leaderboard row ──────────────────────────────────────────────────────────
function LeaderboardRow({ rank, launch, onChainData, isDemo }: {
  rank: number;
  launch: TokenLaunch;
  onChainData?: OnChainData | null;
  isDemo?: boolean;
}) {
  const progress = onChainData?.progress ?? null;
  const mcap = getMcap(onChainData);
  const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
  const rankBg = rank === 1 ? 'bg-yellow-400/10 text-yellow-400' : rank === 2 ? 'bg-slate-400/10 text-slate-400' : rank === 3 ? 'bg-amber-600/10 text-amber-500' : 'text-muted-foreground/35';

  const inner = (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/25 hover:bg-card/90 hover:shadow-md hover:shadow-black/10 transition-all duration-150">

      {/* Row 1: rank badge + avatar + symbol + name + description */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${rank <= 3 ? rankBg : 'text-muted-foreground/35'}`}>
          {rankLabel}
        </div>
        {launch.imageUrl ? (
          <img src={launch.imageUrl} alt="" className="w-9 h-9 rounded-full shrink-0 object-cover ring-1 ring-border/50" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 ring-1 ring-border/50">
            {launch.symbol[0]}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-foreground tracking-tight">${launch.symbol}</span>
          <div className="flex items-baseline gap-1 min-w-0">
            <span className="text-[11px] text-muted-foreground/70 shrink-0 leading-tight">{launch.name}</span>
            {launch.description && (
              <span className="text-[10px] text-muted-foreground/35 truncate leading-tight">{launch.description}</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: price · mcap */}
      <div className="flex items-center gap-2 min-w-0">
        {onChainData && onChainData.price > 0n ? (
          <div className="flex items-center gap-1 shrink-0">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-[11px] text-green-500 font-semibold">{formatPrice(onChainData.price)}</span>
            <span className="text-[9px] text-muted-foreground/50">BNB</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground/25 shrink-0">—</span>
        )}
        {mcap > 0 && (
          <span className="text-[10px] text-muted-foreground/60 shrink-0">MCap: {formatMcap(mcap)}</span>
        )}
      </div>

      {/* Row 3: progress bar */}
      {progress !== null && (
        <div className="flex items-center gap-1.5">
          <div className="w-24 h-[2px] bg-border/60 rounded-full overflow-hidden">
            <div className="h-full bg-muted-foreground/30 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="text-[9px] text-muted-foreground/50 tabular-nums">{progress.toFixed(1)}%</span>
        </div>
      )}

      {/* Row 3: skill + downloads | tax + platform + listed */}
      <div className="flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {launch.skill?.name && (
            <span className="text-[10px] text-amber-500/80 truncate max-w-[110px]">{launch.skill.name}</span>
          )}
          {launch.skill?.downloadCount != null && launch.skill.downloadCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/50 shrink-0">
              <Download className="w-2.5 h-2.5" />
              {launch.skill.downloadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {launch.taxRate > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-orange-500/8 text-orange-400/80 font-medium border border-orange-500/15">
              {(launch.taxRate / 100).toFixed(0)}%
            </span>
          )}
          <PlatformBadge platform={launch.launchPlatform} />
          {launch.status === 'LISTED' && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-green-500/10 text-green-500/80 font-medium">已发射</span>
          )}
        </div>
      </div>

    </div>
  );

  if (isDemo) return inner;
  return <Link to={`/launchpad/${launch.id}`}>{inner}</Link>;
}

// ── Column filter panel ──────────────────────────────────────────────────────
function ColumnFilterPanel({ filter, onChange }: {
  filter: ColFilter;
  onChange: (f: Partial<ColFilter>) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 p-2.5 mb-2 border border-border/60 rounded-xl bg-background/90">
      {/* Liquidity filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground shrink-0 w-12">流动性≥</span>
        <input
          type="number" min={0}
          value={filter.minLiquidity || ''}
          onChange={e => onChange({ minLiquidity: Number(e.target.value) || 0 })}
          placeholder="0"
          className="w-16 bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground"
        />
        <span className="text-[10px] text-muted-foreground">BNB</span>
        {filter.minLiquidity > 0 && (
          <button onClick={() => onChange({ minLiquidity: 0 })} className="text-muted-foreground hover:text-foreground ml-auto">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Download count filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground shrink-0 w-12">下载≥</span>
        <input
          type="number" min={0}
          value={filter.minDownloads || ''}
          onChange={e => onChange({ minDownloads: Number(e.target.value) || 0 })}
          placeholder="0"
          className="w-16 bg-secondary rounded px-1.5 py-0.5 text-[10px] outline-none text-foreground"
        />
        {filter.minDownloads > 0 && (
          <button onClick={() => onChange({ minDownloads: 0 })} className="text-muted-foreground hover:text-foreground ml-auto">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kanban column ────────────────────────────────────────────────────────────
function KanbanColumn({ title, dotColor, launches, onChainMap, filter, onFilterChange, isDemo }: {
  title: string;
  dotColor: string;
  launches: TokenLaunch[];
  onChainMap: Map<string, OnChainData>;
  filter: ColFilter;
  onFilterChange: (f: Partial<ColFilter>) => void;
  isDemo?: boolean;
}) {
  const filtered = useMemo(() => {
    return launches.filter(l => {
      if (filter.minLiquidity > 0) {
        const data = onChainMap.get(l.id);
        if (getMcap(data) < filter.minLiquidity) return false;
      }
      if (filter.minDownloads > 0) {
        if ((l.skill?.downloadCount ?? 0) < filter.minDownloads) return false;
      }
      if (filter.tags.length > 0) {
        const data = onChainMap.get(l.id);
        const tag = getProgressTag(data?.progress ?? null);
        if (!tag || !filter.tags.includes(tag)) return false;
      }
      return true;
    });
  }, [launches, filter, onChainMap]);

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        <button
          onClick={() => onFilterChange({ open: !filter.open })}
          className={`p-1 rounded-md transition-colors ${filter.open ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
          title="筛选"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {filter.open && <ColumnFilterPanel filter={filter} onChange={onFilterChange} />}

      <div className="relative flex-1 min-h-0">
        <div className="flex flex-col gap-1.5 overflow-y-auto h-full pr-0.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Rocket className="w-6 h-6 text-muted-foreground/20 mb-2" />
              <span className="text-xs text-muted-foreground/40">暂无数据</span>
            </div>
          ) : (
            filtered.map(l => (
              <CompactCard key={l.id} launch={l} onChainData={onChainMap.get(l.id)} isDemo={isDemo || l.id.startsWith('demo-')} />
            ))
          )}
        </div>
        {filtered.length > 0 && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/80 to-transparent rounded-b-md" />
        )}
      </div>
    </div>
  );
}

// ── Leaderboard view ─────────────────────────────────────────────────────────
function LeaderboardView({ launches, onChainMap, platformFilter, isDemo }: {
  launches: TokenLaunch[];
  onChainMap: Map<string, OnChainData>;
  platformFilter: PlatformFilter;
  isDemo?: boolean;
}) {
  const sorted = useMemo(() => {
    return [...launches]
      .filter(l => {
        if (platformFilter === 'FOURMEME') return l.launchPlatform === 'FOURMEME';
        if (platformFilter === 'FLAP') return l.launchPlatform !== 'FOURMEME';
        return true;
      })
      .sort((a, b) => getMcap(onChainMap.get(b.id)) - getMcap(onChainMap.get(a.id)))
      .slice(0, 10);
  }, [launches, onChainMap, platformFilter]);

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground/20 mb-3" />
        <span className="text-sm text-muted-foreground/50">暂无排行数据</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left column: ranks 1-5 */}
      <div className="flex flex-col gap-2">
        {sorted.slice(0, 5).map((l, i) => (
          <LeaderboardRow
            key={l.id}
            rank={i + 1}
            launch={l}
            onChainData={onChainMap.get(l.id)}
            isDemo={isDemo || l.id.startsWith('demo-')}
          />
        ))}
      </div>
      {/* Right column: ranks 6-10 */}
      <div className="flex flex-col gap-2">
        {sorted.slice(5).map((l, i) => (
          <LeaderboardRow
            key={l.id}
            rank={i + 6}
            launch={l}
            onChainData={onChainMap.get(l.id)}
            isDemo={isDemo || l.id.startsWith('demo-')}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function LaunchpadPage() {
  const { t } = useTranslation('launchpad');
  const [launches, setLaunches] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('ALL');
  const [globalSearch, setGlobalSearch] = useState('');
  const [colFilters, setColFilters] = useState<Record<string, ColFilter>>({
    new:    { keyword: '', minLiquidity: 0, minDownloads: 0, tags: [], open: false },
    listed: { keyword: '', minLiquidity: 0, minDownloads: 0, tags: [], open: false },
  });
  const { token } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    api.get('/tokens?limit=60&page=1&sortBy=newest')
      .then(({ data }) => setLaunches(data.tokens || data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── On-chain reads ──────────────────────────────────────────────────────────
  const activeLaunches = launches.filter((l) => l.tokenAddress && l.status === 'ACTIVE');
  const flapLaunches = activeLaunches.filter((l) => l.launchPlatform !== 'FOURMEME');
  const fourMemeLaunches = activeLaunches.filter((l) => l.launchPlatform === 'FOURMEME');

  const flapContracts = flapLaunches.map((l) => {
    try {
      return { address: getPortalAddress(l.chainId), abi: PORTAL_ABI, functionName: 'getTokenV7' as const, args: [l.tokenAddress as Hex], chainId: l.chainId };
    } catch { return null; }
  }).filter(Boolean) as any[];

  const fourMemeContracts = fourMemeLaunches.map((l) => ({
    address: HELPER3_ADDRESS, abi: Helper3_ABI, functionName: 'getTokenInfo' as const,
    args: [l.tokenAddress as Hex], chainId: l.chainId,
  }));

  const { data: flapResults } = useReadContracts({ contracts: flapContracts, query: { enabled: flapContracts.length > 0, refetchInterval: 30_000 } });
  const { data: fourMemeResults } = useReadContracts({ contracts: fourMemeContracts, query: { enabled: fourMemeContracts.length > 0, refetchInterval: 15_000 } });

  const liveOnChainMap = useMemo(() => {
    const map = new Map<string, OnChainData>();
    if (flapResults) {
      flapLaunches.forEach((l, i) => {
        const r = flapResults[i];
        if (r?.status === 'success' && r.result) {
          const s = r.result as any;
          map.set(l.id, { price: s.price, progress: Number((s.progress * 10000n) / BigInt(1e18)) / 100 });
        }
      });
    }
    if (fourMemeResults) {
      fourMemeLaunches.forEach((l, i) => {
        const r = fourMemeResults[i];
        if (r?.status === 'success' && r.result) {
          const s = mapFourMemeTokenInfo(r.result);
          if (s) map.set(l.id, { price: s.lastPrice, progress: s.progress, marketCap: s.marketCap });
        }
      });
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flapResults, fourMemeResults]);

  // Use demo data when API returned nothing
  const isDemo = !loading && launches.length === 0;
  const effectiveLaunches = isDemo ? DEMO_LAUNCHES : launches;
  const onChainMap = isDemo ? DEMO_ONCHAIN : liveOnChainMap;

  // ── Column classification ──────────────────────────────────────────────────
  const platformFiltered = useMemo(() => effectiveLaunches.filter(l => {
    if (platformFilter === 'FOURMEME') return l.launchPlatform === 'FOURMEME';
    if (platformFilter === 'FLAP') return l.launchPlatform !== 'FOURMEME';
    return true;
  }), [effectiveLaunches, platformFilter]);

  const searchFiltered = useMemo(() => {
    const kw = globalSearch.trim().toLowerCase();
    if (!kw) return platformFiltered;
    return platformFiltered.filter(l =>
      l.symbol.toLowerCase().includes(kw) ||
      (l.tokenAddress && l.tokenAddress.toLowerCase().includes(kw))
    );
  }, [platformFiltered, globalSearch]);

  const newLaunches = useMemo(() =>
    searchFiltered
      .filter(l => l.status !== 'LISTED')
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 20),
  [searchFiltered]);

  const listedLaunches = useMemo(() =>
    searchFiltered.filter(l => l.status === 'LISTED'),
  [searchFiltered]);

  const updateColFilter = (col: string) => (f: Partial<ColFilter>) =>
    setColFilters(prev => ({ ...prev, [col]: { ...prev[col], ...f } }));

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col gap-4 px-4 sm:px-6 md:px-8 py-4 md:py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('page.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('page.subtitle')}</p>
          </div>
          {token && (
            <Link
              to="/launchpad/create"
              className="flex items-center justify-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity w-full sm:w-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('page.launchToken')}
            </Link>
          )}
        </div>

        {/* Toolbar: platform filter + view toggle */}
        <div className="flex items-center justify-between gap-3">
          {/* Platform filter */}
          <div className="flex items-center gap-1.5">
            {(['ALL', 'FOURMEME', 'FLAP'] as PlatformFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  platformFilter === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {p === 'ALL' ? '全部' : p === 'FOURMEME' ? 'four.meme' : 'flap.sh'}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0 rounded-lg border border-border bg-secondary p-0.5 shrink-0">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              扫链
            </button>
            <button
              onClick={() => setViewMode('leaderboard')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'leaderboard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              排行榜
            </button>
          </div>
        </div>

        {/* Global search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background/80">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            placeholder="搜索代币 Ticker 或合约地址 CA..."
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/50 min-w-0"
          />
          {globalSearch && (
            <button onClick={() => setGlobalSearch('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Main content */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            {t('page.loadingLaunches')}
          </div>
        ) : viewMode === 'leaderboard' ? (
          <LeaderboardView
            launches={effectiveLaunches}
            onChainMap={onChainMap}
            platformFilter={platformFilter}
            isDemo={isDemo}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0" style={{ height: 'calc(100vh - 320px)' }}>
            <KanbanColumn
              title="新创建" dotColor="bg-blue-400"
              launches={newLaunches} onChainMap={onChainMap}
              filter={colFilters.new} onFilterChange={updateColFilter('new')}
              isDemo={isDemo}
            />
            <KanbanColumn
              title="已发射" dotColor="bg-green-400"
              launches={listedLaunches} onChainMap={onChainMap}
              filter={colFilters.listed} onFilterChange={updateColFilter('listed')}
              isDemo={isDemo}
            />
          </div>
        )}

        {/* How it works */}
        <div className="flex flex-col items-center gap-4 py-6 border-t border-border/50 mt-4">
          <h2 className="text-base font-bold text-foreground">{t('page.howItWorks')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {stepKeys.map((key, i) => (
              <div key={key} className="flex flex-col items-center gap-1.5 text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{i + 1}</div>
                <h3 className="text-xs font-semibold text-foreground">{t(`steps.${key}`)}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{t(`steps.${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Powered by */}
        <div className="flex items-center justify-center gap-3 py-4 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium">{t('page.poweredBy')}</span>
          <span className="text-xs text-muted-foreground/60 font-medium">Flap Protocol</span>
          <span className="text-muted-foreground/20">·</span>
          <span className="text-xs text-muted-foreground/60 font-medium">four.meme</span>
          <span className="text-muted-foreground/20">·</span>
          <span className="text-xs text-muted-foreground/60 font-medium">BNB Chain</span>
        </div>
      </div>
      <Footer />
    </div>
  );
}
