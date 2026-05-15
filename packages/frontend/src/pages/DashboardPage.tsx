import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Package, Upload, BarChart2, Settings, TrendingUp, ExternalLink, Trash2, RefreshCw, Shield, Download, Search, Rocket, ShieldCheck, Inbox, Check, X, Copy, Link2, DollarSign, Wallet, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';

interface Skill {
  id: string;
  name: string;
  description?: string;
  downloadCount: number;
  stars?: number;
  language?: string;
  category?: string;
  repoUrl?: string;
  sourceRepo?: string;
  createdAt: string;
  updatedAt?: string;
  scanResult?: { status?: string; riskLevel?: string; safeToUse?: boolean };
}

const sidebarItems = [
  { icon: LayoutDashboard, labelKey: 'sidebar.dashboard', path: '/dashboard' },
  { icon: Package, labelKey: 'sidebar.mySkills', path: '/dashboard/skills' },
  { icon: Rocket, labelKey: 'sidebar.myTokens', path: '/dashboard/tokens' },
  { icon: DollarSign, labelKey: 'sidebar.revenue', path: '/dashboard/revenue' },
  // { icon: Inbox, labelKey: 'sidebar.requests', path: '/dashboard/requests' },
  { icon: Upload, labelKey: 'sidebar.uploadSkill', path: '/upload' },
  { icon: BarChart2, labelKey: 'sidebar.analytics', path: '/dashboard/analytics' },
  { icon: Settings, labelKey: 'sidebar.settings', path: '/dashboard/settings' },
];

const riskColors: Record<string, string> = {
  LOW: 'text-success',
  MEDIUM: 'text-warning',
  HIGH: 'text-orange-500',
  CRITICAL: 'text-destructive',
};

const riskBadge: Record<string, { bg: string; text: string }> = {
  LOW: { bg: 'bg-success/10', text: 'text-success' },
  MEDIUM: { bg: 'bg-warning/10', text: 'text-warning' },
  HIGH: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  CRITICAL: { bg: 'bg-destructive/10', text: 'text-destructive' },
};

function StatusBadge({ status }: { status?: string }) {
  const { t } = useTranslation('dashboard');
  if (status === 'COMPLETED') return <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{t('skillsTable.active')}</span>;
  if (status === 'SCANNING' || status === 'PENDING') return <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">{t('skillsTable.scanning')}</span>;
  if (status === 'FAILED') return <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">{t('skillsTable.failed')}</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">{t('skillsTable.pending')}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   Dashboard Home
   ═══════════════════════════════════════════════════════════════ */
function DashboardHome({ skills, loading, user }: { skills: Skill[]; loading: boolean; user: any }) {
  const { t } = useTranslation('dashboard');
  const totalDownloads = skills.reduce((acc, s) => acc + s.downloadCount, 0);
  const safeCount = skills.filter(s => s.scanResult?.safeToUse).length;
  const avgSecurity = skills.length > 0 ? Math.round((safeCount / skills.length) * 100) : 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{t('home.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('home.welcome', { username: user?.username || 'developer' })}</p>
        </div>
        <Link
          to="/upload"
          className="h-9 md:h-10 px-4 md:px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity w-fit"
        >
          <Upload className="w-4 h-4" />
          {t('home.uploadNew')}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('home.totalDownloads')}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{totalDownloads.toLocaleString()}</span>
            {totalDownloads > 0 && (
              <span className="text-xs text-success font-medium flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('home.activeSkills')}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{skills.length}</span>
            <span className="text-xs text-muted-foreground">{t('home.skills')}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('home.securityScore')}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{avgSecurity || '--'}</span>
            <span className="text-xs text-muted-foreground">{avgSecurity ? t('home.safe') : ''}</span>
          </div>
        </div>
      </div>

      {/* Published Skills Table */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t('home.publishedSkills')}</h2>
          <Link to="/dashboard/skills" className="text-sm text-primary hover:underline">{t('home.viewAll')}</Link>
        </div>
        <SkillsTable skills={skills.slice(0, 5)} loading={loading} compact />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Skills Table (shared)
   ═══════════════════════════════════════════════════════════════ */
function SkillsTable({ skills, loading, compact, onDelete }: { skills: Skill[]; loading: boolean; compact?: boolean; onDelete?: (id: string) => void }) {
  const { t } = useTranslation('dashboard');
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <div className={`grid ${onDelete ? 'grid-cols-5' : 'grid-cols-4'} gap-4 px-4 py-3 bg-secondary text-xs text-muted-foreground font-medium min-w-[500px]`}>
        <span>{t('skillsTable.skillName')}</span>
        <span className="text-center">{t('skillsTable.downloads')}</span>
        <span className="text-center">{t('skillsTable.riskLevel')}</span>
        <span className="text-center">{t('skillsTable.status')}</span>
        {onDelete && <span className="text-center">{t('skillsTable.actions')}</span>}
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('skillsTable.loading')}</div>
      ) : skills.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('skillsTable.noSkills')}</div>
      ) : (
        skills.map((skill) => (
          <div
            key={skill.id}
            className={`grid ${onDelete ? 'grid-cols-5' : 'grid-cols-4'} gap-4 px-4 py-3 border-t border-border text-sm min-w-[500px]`}
          >
            <Link to={`/skills/${skill.id}`} className="text-foreground font-medium truncate hover:text-primary transition-colors">
              {skill.name}
            </Link>
            <span className="text-center text-muted-foreground">{skill.downloadCount.toLocaleString()}</span>
            <span className={`text-center font-medium ${riskColors[skill.scanResult?.riskLevel || 'LOW']}`}>
              {skill.scanResult?.riskLevel || '--'}
            </span>
            <span className="text-center">
              <StatusBadge status={skill.scanResult?.status} />
            </span>
            {onDelete && (
              <span className="text-center">
                <button
                  onClick={() => onDelete(skill.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete skill"
                >
                  <Trash2 className="w-4 h-4 inline" />
                </button>
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   My Skills Page
   ═══════════════════════════════════════════════════════════════ */
function MySkillsPage({ skills, loading, setSkills }: { skills: Skill[]; loading: boolean; setSkills: (s: Skill[]) => void }) {
  const { t } = useTranslation('dashboard');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast } = useToast();

  const filtered = search
    ? skills.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : skills;

  const handleDelete = async (id: string) => {
    if (!confirm(t('mySkills.deleteConfirm'))) return;
    setDeleting(id);
    try {
      await api.delete(`/skills/${id}`);
      setSkills(skills.filter(s => s.id !== id));
    } catch (err: any) {
      showToast(err.response?.data?.message || t('mySkills.deleteFailed'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{t('mySkills.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('mySkills.count', { count: skills.length })}</p>
        </div>
        <Link
          to="/upload"
          className="h-9 md:h-10 px-4 md:px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity w-fit"
        >
          <Upload className="w-4 h-4" />
          {t('mySkills.uploadNew')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('mySkills.searchPlaceholder')}
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Skills Grid Cards */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('skillsTable.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">{search ? t('mySkills.noMatch') : t('mySkills.noSkills')}</p>
          {!search && (
            <Link to="/upload" className="text-sm text-primary hover:underline">{t('mySkills.uploadFirst')}</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((skill) => {
            const risk = skill.scanResult?.riskLevel;
            const badge = risk ? riskBadge[risk] : null;
            return (
              <div key={skill.id} className="flex flex-col gap-3 p-5 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <Link to={`/skills/${skill.id}`} className="text-base font-semibold text-foreground hover:text-primary transition-colors truncate flex-1">
                    {skill.name}
                  </Link>
                  <StatusBadge status={skill.scanResult?.status} />
                </div>
                {skill.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {skill.downloadCount}</span>
                  {skill.stars !== undefined && <span>★ {skill.stars}</span>}
                  {skill.language && <span>{skill.language}</span>}
                  {skill.category && <span className="px-1.5 py-0.5 rounded bg-secondary text-xs">{skill.category}</span>}
                  {badge && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {risk}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Link to={`/skills/${skill.id}`} className="text-xs text-primary hover:underline">{t('mySkills.viewDetails')}</Link>
                  {skill.repoUrl && (
                    <a href={skill.repoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {t('mySkills.github')} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(skill.id)}
                    disabled={deleting === skill.id}
                    className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {deleting === skill.id ? t('mySkills.deleting') : t('mySkills.delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Analytics Page
   ═══════════════════════════════════════════════════════════════ */
function AnalyticsPage({ skills }: { skills: Skill[] }) {
  const { t } = useTranslation('dashboard');
  const [platformStats, setPlatformStats] = useState<any>(null);

  useEffect(() => {
    api.get('/stats').then(({ data }) => setPlatformStats(data)).catch(() => {});
  }, []);

  const totalDownloads = skills.reduce((acc, s) => acc + s.downloadCount, 0);
  const totalStars = skills.reduce((acc, s) => acc + (s.stars || 0), 0);
  const safeCount = skills.filter(s => s.scanResult?.safeToUse).length;
  const scannedCount = skills.filter(s => s.scanResult?.status === 'COMPLETED').length;

  // Category breakdown
  const catMap: Record<string, number> = {};
  skills.forEach(s => {
    const cat = s.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + 1;
  });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // Language breakdown
  const langMap: Record<string, number> = {};
  skills.forEach(s => {
    const lang = s.language || 'Unknown';
    langMap[lang] = (langMap[lang] || 0) + 1;
  });
  const langEntries = Object.entries(langMap).sort((a, b) => b[1] - a[1]);

  // Top skills by downloads
  const topByDownloads = [...skills].sort((a, b) => b.downloadCount - a.downloadCount).slice(0, 5);

  // Risk distribution
  const riskMap: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0, 'Not Scanned': 0 };
  skills.forEach(s => {
    const level = s.scanResult?.riskLevel || 'Not Scanned';
    riskMap[level] = (riskMap[level] || 0) + 1;
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">{t('analytics.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
      </div>

      {/* Your Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('analytics.yourSkills')}</span>
          <span className="text-2xl font-bold text-foreground">{skills.length}</span>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('analytics.totalDownloads')}</span>
          <span className="text-2xl font-bold text-foreground">{totalDownloads.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('analytics.totalStars')}</span>
          <span className="text-2xl font-bold text-foreground">{totalStars.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
          <span className="text-xs text-muted-foreground">{t('analytics.safeRate')}</span>
          <span className="text-2xl font-bold text-foreground">
            {scannedCount > 0 ? `${Math.round((safeCount / scannedCount) * 100)}%` : '--'}
          </span>
        </div>
      </div>

      {/* Platform Stats */}
      {platformStats && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t('analytics.platformOverview')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
              <span className="text-xs text-muted-foreground">{t('analytics.totalSkills')}</span>
              <span className="text-2xl font-bold text-primary">{platformStats.total?.toLocaleString() || 0}</span>
            </div>
            <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
              <span className="text-xs text-muted-foreground">{t('analytics.scannedSkills')}</span>
              <span className="text-2xl font-bold text-foreground">{platformStats.scanned?.toLocaleString() || 0}</span>
            </div>
            <div className="flex flex-col gap-2 p-5 rounded-lg bg-card border border-border">
              <span className="text-xs text-muted-foreground">{t('analytics.safePercentage')}</span>
              <span className="text-2xl font-bold text-success">{platformStats.safePercentage || 0}%</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Top Skills by Downloads */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t('analytics.topSkills')}</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            {topByDownloads.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t('analytics.noData')}</div>
            ) : topByDownloads.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <span className="w-6 text-center text-xs font-bold text-muted-foreground">#{i + 1}</span>
                <Link to={`/skills/${s.id}`} className="flex-1 text-sm font-medium text-foreground hover:text-primary truncate">{s.name}</Link>
                <span className="text-sm text-muted-foreground">{s.downloadCount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Risk Distribution */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t('analytics.riskDistribution')}</h2>
          <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
            {Object.entries(riskMap).map(([level, count]) => {
              const total = skills.length || 1;
              const pct = Math.round((count / total) * 100);
              const color = level === 'LOW' ? 'bg-success' : level === 'MEDIUM' ? 'bg-warning' : level === 'HIGH' ? 'bg-orange-500' : level === 'CRITICAL' ? 'bg-destructive' : 'bg-secondary';
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-muted-foreground">{level}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-xs text-muted-foreground text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   My Tokens Page
   ═══════════════════════════════════════════════════════════════ */
interface TokenLaunch {
  id: string;
  name: string;
  symbol: string;
  status: string;
  tokenAddress?: string;
  chainId: number;
  taxRate: number;
  createdAt: string;
  skill?: { id: string; name: string };
}

const tokenStatusColors: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  DEPLOYING: 'bg-yellow-500/10 text-yellow-500',
  ACTIVE: 'bg-green-500/10 text-green-500',
  FAILED: 'bg-destructive/10 text-destructive',
};

function MyTokensPage() {
  const { t } = useTranslation('dashboard');
  const [tokens, setTokens] = useState<TokenLaunch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tokens/my')
      .then(({ data }) => setTokens(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{t('myTokens.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('myTokens.count', { count: tokens.length })}</p>
        </div>
        <Link
          to="/launchpad/create"
          className="flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Rocket className="w-4 h-4" />
          {t('myTokens.launchToken')}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('skillsTable.loading')}</div>
      ) : tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-lg border border-border bg-card">
          <Rocket className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('myTokens.noTokens')}</p>
          <Link to="/launchpad/create" className="text-sm text-primary hover:underline">{t('myTokens.launchFirst')}</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tokens.map((tk) => (
            <Link
              key={tk.id}
              to={`/launchpad/${tk.id}`}
              className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {tk.symbol[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">${tk.symbol}</span>
                  <span className="text-xs text-muted-foreground">{tk.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tokenStatusColors[tk.status] || tokenStatusColors.DRAFT}`}>
                    {tk.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  {tk.skill && <span>{t('myTokens.skill')} {tk.skill.name}</span>}
                  <span>{tk.chainId === 97 ? t('myTokens.testnet') : t('myTokens.bsc')}</span>
                  {tk.taxRate > 0 && <span>{tk.taxRate / 100}% {t('myTokens.tax')}</span>}
                  <span>{new Date(tk.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              {tk.tokenAddress && (
                <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                  {tk.tokenAddress.slice(0, 6)}...{tk.tokenAddress.slice(-4)}
                </span>
              )}
              <ExternalLink className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Launch Requests Page
   ═══════════════════════════════════════════════════════════════ */
interface LaunchRequest {
  id: string;
  status: string;
  message?: string;
  createdAt: string;
  skill: { id: string; name: string };
  requester: { id: string; username: string; avatarUrl?: string; walletAddress?: string };
}

function LaunchRequestsPage() {
  const { t } = useTranslation('dashboard');
  const [pending, setPending] = useState<LaunchRequest[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'review' | 'my'>('review');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyRequestLink = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/requests/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    Promise.all([
      api.get('/launch-requests/pending').then(({ data }) => setPending(data)).catch(() => {}),
      api.get('/launch-requests/my').then(({ data }) => setMyRequests(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    if (!confirm(t('requestDetail.approveConfirm'))) return;
    try {
      await api.put(`/launch-requests/${id}/approve`);
      setPending((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || t('requestDetail.approveFailed'));
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm(t('requestDetail.rejectConfirm'))) return;
    try {
      await api.put(`/launch-requests/${id}/reject`);
      setPending((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      alert(err?.response?.data?.message || t('requestDetail.rejectFailed'));
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/10 text-yellow-500',
    APPROVED: 'bg-green-500/10 text-green-500',
    REJECTED: 'bg-destructive/10 text-destructive',
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">{t('requests.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('requests.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('review')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'review' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          {t('requests.incoming')} {pending.length > 0 && `(${pending.length})`}
        </button>
        <button
          onClick={() => setTab('my')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'my' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          {t('requests.myProposals')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{t('requests.loading')}</div>
      ) : tab === 'review' ? (
        pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-border bg-card">
            <Inbox className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('requests.noPending')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((req) => (
              <div key={req.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                  {req.requester.avatarUrl ? (
                    <img src={req.requester.avatarUrl} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    req.requester.username[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">
                      {req.requester.walletAddress ? `${req.requester.walletAddress.slice(0, 6)}...${req.requester.walletAddress.slice(-4)}` : req.requester.username}
                    </span>
                    {' '}{t('requests.proposesIncentive')}{' '}
                    <Link to={`/skills/${req.skill.id}`} className="text-primary hover:underline font-medium">{req.skill.name}</Link>
                  </p>
                  {req.message && <p className="text-xs text-muted-foreground mt-1">"{req.message}"</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(req.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="h-8 px-3 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> {t('requests.approve')}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="h-8 px-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> {t('requests.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        myRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-border bg-card">
            <p className="text-sm text-muted-foreground">{t('requests.noSentProposals')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((req: any) => (
              <div key={req.id} className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{req.skill?.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[req.status] || ''}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(req.createdAt).toLocaleString()}</p>
                  </div>
                  {req.status === 'APPROVED' && (
                    <Link
                      to={`/launchpad/create?skillId=${req.skill?.id || req.skillId}`}
                      className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center gap-1"
                    >
                      <Rocket className="w-3.5 h-3.5" /> {t('requests.activate')}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 border border-border/50">
                  <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate flex-1 font-mono">
                    {window.location.origin}/requests/{req.id}
                  </span>
                  <button
                    onClick={() => copyRequestLink(req.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {copiedId === req.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === req.id ? t('requests.linkCopied') : t('requests.copyLink')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Settings Page
   ═══════════════════════════════════════════════════════════════ */
function SettingsPage({ user }: { user: any }) {
  const { t } = useTranslation('dashboard');
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col gap-4 p-6 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.profile')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{t('settings.username')}</label>
            <div className="h-10 px-4 flex items-center rounded-lg bg-secondary border border-border text-sm text-foreground">
              {user?.username || '--'}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{t('settings.walletAddress')}</label>
            <div className="h-10 px-4 flex items-center rounded-lg bg-secondary border border-border text-sm text-foreground font-mono">
              {user?.walletAddress || user?.username || '--'}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{t('settings.email')}</label>
            <div className="h-10 px-4 flex items-center rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
              {user?.email || t('settings.notSet')}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{t('settings.memberSince')}</label>
            <div className="h-10 px-4 flex items-center rounded-lg bg-secondary border border-border text-sm text-muted-foreground">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="flex flex-col gap-4 p-6 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.security')}</h2>
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm text-foreground">{t('settings.walletConnection')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.walletDesc')}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">{t('settings.connected')}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm text-foreground">{t('settings.autoScanning')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.autoScanDesc')}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">{t('settings.enabled')}</span>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="flex flex-col gap-4 p-6 rounded-lg bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground">{t('settings.preferences')}</h2>
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div>
            <p className="text-sm text-foreground">{t('settings.defaultCategory')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.defaultCategoryDesc')}</p>
          </div>
          <span className="text-sm text-muted-foreground">{t('settings.autoDetect')}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm text-foreground">{t('settings.notifications')}</p>
            <p className="text-xs text-muted-foreground">{t('settings.notificationsDesc')}</p>
          </div>
          <span className="text-sm text-muted-foreground">{t('settings.notAvailable')}</span>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Dashboard Layout
   ═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   Revenue Page
   ═══════════════════════════════════════════════════════════════ */
function RevenuePage() {
  const { t } = useTranslation('dashboard');
  const { user, fetchUser } = useAuthStore();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'claim' | 'discover'>(() => searchParams.get('tab') === 'discover' ? 'discover' : 'claim');
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [claimHistory, setClaimHistory] = useState<Record<string, any[]>>({});

  const [disputes, setDisputes] = useState<any[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);
  const [disputeSkillName, setDisputeSkillName] = useState(() => searchParams.get('skillName') || '');
  const [disputeTokenAddress, setDisputeTokenAddress] = useState(() => searchParams.get('tokenAddress') || '');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFiles, setDisputeFiles] = useState<File[]>([]);
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [resubmitFromId, setResubmitFromId] = useState<string | null>(null);
  const [bindingGithub, setBindingGithub] = useState(false);

  useEffect(() => {
    if (tab === 'claim') {
      setLoadingRevenue(true);
      api.get('/revenue/my').then(({ data }) => setRevenueData(data)).catch(() => setRevenueData([])).finally(() => setLoadingRevenue(false));
    } else {
      setLoadingDisputes(true);
      api.get('/author-disputes/my').then(({ data }) => setDisputes(data)).catch(() => setDisputes([])).finally(() => setLoadingDisputes(false));
    }
  }, [tab]);

  const handleClaim = async (authorClaimId: string) => {
    setClaiming(authorClaimId);
    try {
      await api.post('/revenue/claim', { authorClaimId });
      showToast(t('revenue.claimSuccess'), 'success');
      const { data } = await api.get('/revenue/my');
      setRevenueData(data);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('revenue.claimFailed'), 'error');
    } finally {
      setClaiming(null);
    }
  };

  const loadHistory = async (authorClaimId: string) => {
    if (expandedClaim === authorClaimId) { setExpandedClaim(null); return; }
    setExpandedClaim(authorClaimId);
    if (!claimHistory[authorClaimId]) {
      try {
        const { data } = await api.get(`/revenue/claims/${authorClaimId}`);
        setClaimHistory((prev) => ({ ...prev, [authorClaimId]: data }));
      } catch { /* ignore */ }
    }
  };

  const handleBindGithub = async () => {
    setBindingGithub(true);
    try {
      const { data } = await api.get('/auth/github/bind-url');
      const popup = window.open(data.url, 'github-bind', 'width=600,height=700');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setBindingGithub(false);
          fetchUser();
        }
      }, 500);
    } catch {
      setBindingGithub(false);
    }
  };

  const handleDisputeSubmit = async () => {
    if (!disputeSkillName.trim() || !disputeReason.trim()) return;
    setSubmittingDispute(true);
    try {
      const formData = new FormData();
      formData.append('skillName', disputeSkillName.trim());
      if (disputeTokenAddress.trim()) formData.append('tokenAddress', disputeTokenAddress.trim());
      formData.append('reason', disputeReason);
      if (resubmitFromId) formData.append('resubmitFromId', resubmitFromId);
      disputeFiles.forEach((f) => formData.append('proofImages', f));
      await api.post('/author-disputes', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(t('dispute.submitSuccess'), 'success');
      setDisputeSkillName(''); setDisputeTokenAddress(''); setDisputeReason(''); setDisputeFiles([]); setResubmitFromId(null);
      const { data } = await api.get('/author-disputes/my');
      setDisputes(data);
    } catch (err: any) {
      showToast(err?.response?.data?.message || t('dispute.submitFailed'), 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleResubmit = (d: any) => {
    setDisputeSkillName(d.skillName || '');
    setDisputeTokenAddress(d.tokenAddress || '');
    setDisputeReason(d.reason || '');
    setResubmitFromId(d.id);
    setDisputeFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDisputeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - disputeFiles.length);
    setDisputeFiles((prev) => [...prev, ...files].slice(0, 3));
  };

  const disputeStatusColor: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-warning/10', text: 'text-warning' },
    APPROVED: { bg: 'bg-success/10', text: 'text-success' },
    REJECTED: { bg: 'bg-destructive/10', text: 'text-destructive' },
  };

  return (
    <>
      <h1 className="text-xl md:text-2xl font-bold text-foreground">{t('revenue.title')}</h1>
      <div className="flex gap-2 mt-4 border-b border-border">
        {(['claim', 'discover'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {k === 'claim' ? t('revenue.tabClaim') : t('revenue.tabDiscover')}
          </button>
        ))}
      </div>

      {tab === 'claim' && (
        loadingRevenue ? (
          <div className="mt-4 flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{t('skillsTable.loading')}</p>
          </div>
        ) : (
        <div className="mt-4 flex flex-col gap-4">
          {(() => {
            const totalPending = revenueData.reduce((s, it) => s + (parseFloat(it.pendingAmount) || 0), 0);
            const totalClaimedAll = revenueData.reduce((s, it) => s + (parseFloat(it.totalClaimed) || 0), 0);
            const fmtBnb = (v: number) => {
              if (v <= 0) return '0';
              // todo 测试需求
              if (v < 0.001) return '<0.001';
              const s = Math.floor(v * 1000) / 1000;
              return s % 1 === 0 ? String(s) : s.toFixed(3).replace(/\.?0+$/, '');
            };
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t('revenue.summaryPending')}</span>
                  <span className="text-2xl font-bold text-foreground">
                    {fmtBnb(totalPending)} <span className="text-sm font-normal text-muted-foreground">BNB</span>
                  </span>
                  <span></span>
                  {/* {totalPending > 0 && totalPending < 0.1 && (
                    <span className="text-[10px] text-muted-foreground/70">{t('revenue.summaryInsufficient')}</span>)} */}
                </div>
                <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{t('revenue.summaryClaimed')}</span>
                  <span className="text-2xl font-bold text-primary">
                    {fmtBnb(totalClaimedAll)} <span className="text-sm font-normal text-muted-foreground">BNB</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">{t('revenue.summaryHistorical')}</span>
                </div>
              </div>
            );
          })()}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
            <span>{t('revenue.infoBar')}</span>
            <button onClick={() => setTab('discover')} className="text-primary font-medium hover:underline whitespace-nowrap">{t('revenue.infoBarLink')}</button>
          </div>
          {revenueData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('revenue.noVerifiedSkills')}</p>
          ) : (
            revenueData.map((item) => (
              <div key={item.authorClaimId} className="p-4 rounded-lg border border-border bg-card flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.token?.imageUrl && <img src={item.token.imageUrl} alt="" className="w-8 h-8 rounded-full" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.skillName}</p>
                      {item.token ? (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">${item.token.symbol}</p>
                          {item.token.launchPlatform === 'FOURMEME' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 font-medium">four.meme</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 font-medium">flap.sh</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t('revenue.noToken')}</p>
                      )}
                    </div>
                  </div>
                </div>

                {item.token && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Wallet className="w-3 h-3" />
                      <span>{t('revenue.revenueWallet')}:</span>
                      {user?.walletAddress ? (
                        <span className="font-mono text-foreground">{user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}</span>
                      ) : (
                        <span className="text-warning">{t('revenue.walletNotBound')}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">{t('revenue.totalRevenue')}</span>
                        <span className="text-sm font-medium text-foreground">{item.totalDevRevenue} BNB</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">{t('revenue.claimed')}</span>
                        <span className="text-sm font-medium text-green-500">{item.totalClaimed} BNB</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase">{t('revenue.pending')}</span>
                        <span className="text-sm font-medium text-primary">{item.pendingAmount} BNB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleClaim(item.authorClaimId)}
                        disabled={!item.canClaimToday || claiming === item.authorClaimId}
                        className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {claiming === item.authorClaimId ? '...' : !item.canClaimToday ? (parseFloat(item.pendingAmount) <= 0 ? t('revenue.noRevenue') : parseFloat(item.pendingAmount) < 0.1 ? t('revenue.minClaim') : t('revenue.claimedToday')) : t('revenue.claimBtn')}
                      </button>
                      <button onClick={() => loadHistory(item.authorClaimId)} className="text-xs text-primary hover:underline">
                        {t('revenue.history')}
                      </button>
                    </div>

                    {expandedClaim === item.authorClaimId && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-border">
                        {(claimHistory[item.authorClaimId] || []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t('revenue.noHistory')}</p>
                        ) : (
                          (claimHistory[item.authorClaimId] || []).map((rc: any) => {
                            const isOverdue = rc.status !== 'PAID' && (Date.now() - new Date(rc.createdAt).getTime()) > 24 * 60 * 60 * 1000;
                            return (
                              <div key={rc.id} className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground font-medium">{rc.claimedAmount} BNB</span>
                                    <span className="text-muted-foreground">({rc.tradeCount} {t('revenue.trades')})</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rc.status === 'PAID' ? 'bg-success/10 text-success' : isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                                      {rc.status === 'PAID' ? t('revenue.statusPaid') : isOverdue ? t('revenue.statusOverdue') : t('revenue.statusPending')}
                                    </span>
                                    <span className="text-muted-foreground">{new Date(rc.createdAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                                {isOverdue && (
                                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs">
                                    <span className="text-muted-foreground">{t('revenue.overdueDesc')}</span>
                                    <a href="https://x.com/SafuSkill" target="_blank" rel="noreferrer" className="text-primary font-medium hover:underline whitespace-nowrap">{t('revenue.contactSupport')} →</a>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
          <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card mt-2">
            <h3 className="text-sm font-semibold text-foreground">{t('revenue.rulesTitle')}</h3>
            {([
              ['ruleArrivalTitle', 'ruleArrivalDesc'],
              ['ruleGasTitle', 'ruleGasDesc'],
              ['ruleIrreversibleTitle', 'ruleIrreversibleDesc'],
              ['ruleAccumulateTitle', 'ruleAccumulateDesc'],
              ['ruleDisputeTitle', 'ruleDisputeDesc'],
              ['ruleTaxTitle', 'ruleTaxDesc'],
            ] as const).map(([titleKey, descKey]) => (
              <div key={titleKey} className="flex gap-2 text-xs">
                <span className="text-foreground font-medium whitespace-nowrap">{t(`revenue.${titleKey}`)}</span>
                <span className="text-muted-foreground">{t(`revenue.${descKey}`)}</span>
              </div>
            ))}
          </div>
        </div>
        )
      )}

      {tab === 'discover' && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">GitHub</span>
              </div>
              {user?.githubLogin ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-success/10 text-success font-medium">{user.githubLogin}</span>
              ) : (
                <button onClick={handleBindGithub} disabled={bindingGithub} className="h-8 px-3 rounded-lg bg-[#24292f] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50">
                  <Github className="w-3.5 h-3.5" />
                  {bindingGithub ? '...' : t('dispute.bindGithub')}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{t('dispute.revenueWallet')}</span>
              </div>
              {user?.walletAddress ? (
                <span className="text-xs font-mono text-foreground">{user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}</span>
              ) : (
                <span className="text-xs text-warning">{t('dispute.walletNotBound')}</span>
              )}
            </div>
          </div>

          {user?.githubLogin && user?.walletAddress ? (
          <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground">{t('dispute.title')}</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('dispute.skillName')} <span className="text-destructive">*</span></label>
              <input type="text" value={disputeSkillName} onChange={(e) => setDisputeSkillName(e.target.value)} placeholder={t('dispute.skillNamePlaceholder')} className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('dispute.tokenAddress')} <span className="text-destructive">*</span></label>
              <input type="text" value={disputeTokenAddress} onChange={(e) => setDisputeTokenAddress(e.target.value)} placeholder={t('dispute.tokenAddressPlaceholder')} className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('dispute.reason')} <span className="text-destructive">*</span></label>
              <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder={t('dispute.reasonPlaceholder')} rows={3} className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t('dispute.proofImages')}</label>
              <div className="flex gap-2 flex-wrap">
                {disputeFiles.map((f, i) => (
                  <div key={i} className="relative w-20 h-20 rounded border border-border overflow-hidden">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setDisputeFiles((prev) => prev.filter((_, j) => j !== i))} className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center">✕</button>
                  </div>
                ))}
                {disputeFiles.length < 3 && (
                  <label className="w-20 h-20 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:border-primary/50 transition-colors">
                    <input type="file" accept="image/*" onChange={handleDisputeFileChange} className="hidden" />
                    {t('dispute.uploadImages')}
                  </label>
                )}
              </div>
            </div>
            <button onClick={handleDisputeSubmit} disabled={!disputeSkillName.trim() || !disputeTokenAddress.trim() || !disputeReason.trim() || submittingDispute} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed w-fit">
              {submittingDispute ? t('dispute.submitting') : t('dispute.submit')}
            </button>
          </div>
          ) : (
            <div className="p-4 rounded-lg border border-border bg-card text-center">
              <p className="text-sm text-muted-foreground">{t('dispute.bindRequiredDesc')}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t('dispute.myDisputes')}</h3>
            {loadingDisputes ? (
              <p className="text-sm text-muted-foreground">{t('skillsTable.loading')}</p>
            ) : disputes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dispute.noDisputes')}</p>
            ) : (
              disputes.map((d: any) => {
                const sc = disputeStatusColor[d.status] || disputeStatusColor.PENDING;
                return (
                  <div key={d.id} className="p-3 rounded-lg border border-border bg-card flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{d.skillName}</p>
                        {d.tokenAddress && <p className="text-[10px] text-muted-foreground font-mono">{d.tokenAddress}</p>}
                        <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">{d.reason}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.text}`}>
                          {t(`dispute.status${d.status.charAt(0) + d.status.slice(1).toLowerCase()}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {d.reviewNote && <p className="text-xs text-muted-foreground">{t('dispute.reviewNote')}: {d.reviewNote}</p>}
                    {d.status === 'REJECTED' && (
                      <button onClick={() => handleResubmit(d)} className="text-xs text-primary hover:underline w-fit">{t('dispute.resubmit')}</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuthStore();
  const location = useLocation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/skills/my')
      .then(({ data }) => {
        setSkills(Array.isArray(data) ? data : []);
      })
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const currentPath = location.pathname;

  const renderContent = () => {
    if (currentPath === '/dashboard/skills') {
      return <MySkillsPage skills={skills} loading={loading} setSkills={setSkills} />;
    }
    if (currentPath === '/dashboard/tokens') {
      return <MyTokensPage />;
    }
    if (currentPath === '/dashboard/requests') {
      return <LaunchRequestsPage />;
    }
    if (currentPath === '/dashboard/revenue') {
      return <RevenuePage />;
    }
    if (currentPath === '/dashboard/analytics') {
      return <AnalyticsPage skills={skills} />;
    }
    if (currentPath === '/dashboard/settings') {
      return <SettingsPage user={user} />;
    }
    return <DashboardHome skills={skills} loading={loading} user={user} />;
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0B0E11] border-b border-border overflow-x-auto">
        {sidebarItems.map((item) => {
          const isActive = item.path === '/upload'
            ? currentPath === '/upload'
            : item.path === '/dashboard'
              ? currentPath === '/dashboard'
              : currentPath.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[260px] flex-col bg-[#0B0E11] border-r border-border">
        <Link to="/" className="h-16 flex items-center gap-2 px-5 border-b border-border hover:opacity-80 transition-opacity">
          <img src="/goplus-gold.svg" alt="GoPlus" className="h-4" />
          <span className="text-lg font-bold text-foreground">SafuSkill</span>
        </Link>
        <nav className="flex flex-col gap-0.5 p-2.5 flex-1">
          {sidebarItems.map((item) => {
            const isActive = item.path === '/upload'
              ? currentPath === '/upload'
              : item.path === '/dashboard'
                ? currentPath === '/dashboard'
                : currentPath.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 md:gap-5 p-4 md:p-6 bg-[#0B0E11] overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}
