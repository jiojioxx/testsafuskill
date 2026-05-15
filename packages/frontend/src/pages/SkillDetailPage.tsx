import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Star, CheckCircle, AlertTriangle, XCircle, Eye, ExternalLink, Copy, Check, Rocket, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type Hex } from 'viem';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useTokenInfo } from '@/hooks/useTokenInfo';
import { useToast } from '@/components/Toast';
import Footer from '@/components/Footer';

/* ── types ── */
interface ScanThreat {
  detector: string;
  severity: string;
  title: string;
  description: string;
  evidence?: string;
  remediation?: string;
}

interface ScanResult {
  status: string;
  riskLevel?: string;
  riskScore?: number;
  safeToUse?: boolean;
  scanSummary?: string;
  scanDetails?: {
    threats?: ScanThreat[];
    permissions?: Record<string, boolean>;
    verdict?: string;
    scan_id?: string;
  };
}

interface Skill {
  id: string;
  name: string;
  description?: string;
  fileSize: number;
  downloadCount: number;
  createdAt: string;
  updatedAt?: string;
  version?: string;
  user: { id: string; username: string; avatarUrl?: string };
  category?: string;
  sourceRepo?: string;
  sourcePath?: string;
  stars?: number;
  language?: string;
  topics?: string;
  repoUrl?: string;
  authorName?: string;
  authorAvatar?: string;
  lastCommitAt?: string;
  score?: number;
  qualityScore?: number;
  platforms?: string;
  scanResult?: ScanResult;
  tokenLaunches?: { id: string; name: string; symbol: string; status: string; tokenAddress?: string; chainId?: number }[];
}

/* ── helpers ── */
function cleanDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatStars(n?: number): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function sizeCategory(bytes: number): string {
  if (bytes < 1024) return 'Micro';
  if (bytes < 100 * 1024) return 'Small';
  if (bytes < 1024 * 1024) return 'Medium';
  return 'Large';
}

const sizeLabelKeys: Record<string, string> = {
  Micro: 'detail.sizeMicro',
  Small: 'detail.sizeSmall',
  Medium: 'detail.sizeMedium',
  Large: 'detail.sizeLarge',
};

function scoreTier(score: number): { letter: string; color: string; borderColor: string; bgColor: string } {
  if (score >= 80) return { letter: 'S', color: 'text-emerald-400', borderColor: 'border-emerald-400', bgColor: 'bg-emerald-400/10' };
  if (score >= 65) return { letter: 'A', color: 'text-blue-400', borderColor: 'border-blue-400', bgColor: 'bg-blue-400/10' };
  if (score >= 50) return { letter: 'B', color: 'text-amber-400', borderColor: 'border-amber-400', bgColor: 'bg-amber-400/10' };
  if (score >= 35) return { letter: 'C', color: 'text-orange-400', borderColor: 'border-orange-400', bgColor: 'bg-orange-400/10' };
  return { letter: 'D', color: 'text-gray-400', borderColor: 'border-gray-400', bgColor: 'bg-gray-400/10' };
}

const riskColors: Record<string, string> = {
  LOW: 'text-success bg-success/10',
  MEDIUM: 'text-warning bg-warning/10',
  HIGH: 'text-orange-500 bg-orange-500/10',
  CRITICAL: 'text-destructive bg-destructive/10',
};
const riskLabelKeys: Record<string, string> = {
  LOW: 'risk.safe',
  MEDIUM: 'risk.caution',
  HIGH: 'risk.risky',
  CRITICAL: 'risk.dangerous',
};

const sizeColors: Record<string, string> = {
  Micro: 'text-emerald-500 bg-emerald-500/10',
  Small: 'text-blue-500 bg-blue-500/10',
  Medium: 'text-amber-500 bg-amber-500/10',
  Large: 'text-red-500 bg-red-500/10',
};

const categoryColors: Record<string, string> = {
  'MCP Skills': 'text-indigo-400 bg-indigo-400/10',
  'BNBChain Skills': 'text-[#F0B90B] bg-[#F0B90B]/10',
  'DeFi Skills': 'text-blue-400 bg-blue-400/10',
  'Security Skills': 'text-emerald-400 bg-emerald-400/10',
  'Community Skills': 'text-purple-400 bg-purple-400/10',
  'Data Skills': 'text-cyan-400 bg-cyan-400/10',
  'DevOps Skills': 'text-orange-400 bg-orange-400/10',
};

const scanItemStatus: Record<string, { icon: typeof CheckCircle; color: string; labelKey: string }> = {
  pass: { icon: CheckCircle, color: 'text-success', labelKey: 'detail.scanClean' },
  warn: { icon: AlertTriangle, color: 'text-warning', labelKey: 'detail.scanWarning' },
  fail: { icon: XCircle, color: 'text-destructive', labelKey: 'detail.scanAlert' },
  info: { icon: Eye, color: 'text-info', labelKey: 'detail.scanReadOnly' },
};

/* ── component ── */
export default function SkillDetailPage() {
  const { t } = useTranslation('marketplace');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [installTab, setInstallTab] = useState<'claude' | 'npx' | 'git'>('claude');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/skills/${id}`)
      .then(({ data }) => setSkill(data))
      .finally(() => setLoading(false));
  }, [id]);

  // On-chain token data for linked token
  const linkedToken = skill?.tokenLaunches?.[0];
  const linkedTokenAddress = linkedToken?.tokenAddress as Hex | undefined;
  const { tokenInfo: linkedTokenInfo } = useTokenInfo(linkedTokenAddress, linkedToken?.chainId || 56);

  // Poll for scan results
  useEffect(() => {
    if (!skill?.scanResult || skill.scanResult.status === 'COMPLETED' || skill.scanResult.status === 'FAILED') return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/scan/${skill.id}`);
        if (data && (data.status === 'COMPLETED' || data.status === 'FAILED')) {
          setSkill((prev) => prev ? { ...prev, scanResult: data } : prev);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [skill?.id, skill?.scanResult?.status]);

  const handleDownload = async () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/skills/${id}/download`, { headers });
    const blob = await res.blob();
    const contentDisposition = res.headers.get('Content-Disposition') || '';
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : 'download';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    // Check if skill has launched tokens
    if (skill?.tokenLaunches && skill.tokenLaunches.length > 0) {
      showToast(t('detail.cannotDeleteWithToken'), 'error');
      return;
    }
    
    if (!confirm(t('detail.confirmDelete'))) return;
    await api.delete(`/skills/${id}`);
    window.location.href = '/marketplace';
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">{t('loading')}</div>;
  if (!skill) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">{t('detail.notFound')}</div>;

  const scan = skill.scanResult;
  const threats = scan?.scanDetails?.threats || [];
  const score = skill.score || 0;
  const tier = scoreTier(score);
  const sizeKey = sizeCategory(skill.fileSize);
  const skillSlug = skill.name.toLowerCase().replace(/\s+/g, '-');
  const repoFullName = skill.sourceRepo || `${skill.user.username}/${skillSlug}`;
  const githubUrl = skill.repoUrl || `https://github.com/${repoFullName}`;
  
  // Check if GitHub source exists
  const hasSource = skill.sourceRepo && skill.sourcePath;

  let topics: string[] = [];
  try { topics = JSON.parse(skill.topics || '[]'); } catch {}

  let platforms: string[] = [];
  try { platforms = JSON.parse(skill.platforms || '[]'); } catch {}

  const installCommands: Record<string, string> = {
    claude: `claude mcp add ${skillSlug} -- npx -y @anthropic-ai/mcp-remote@latest ${githubUrl}`,
    npx: `npx -y @anthropic-ai/mcp-remote@latest ${githubUrl}`,
    git: `git clone ${githubUrl}.git`,
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(installCommands[installTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Security check logic
  const getCheckStatus = (checkName: string) => {
    if (!scan || scan.status !== 'COMPLETED') return 'pass';
    const threatTypeMap: Record<string, string[]> = {
      'Malicious Code': ['malicious_command', 'prompt_injection', 'social_engineering'],
      'Data Leakage': ['data_exfiltration', 'credential_leak'],
      'Network Requests': ['url_analyzer'],
      'Shellout Access': ['malicious_command', 'permission_abuse'],
      'File System': [],
    };
    const relevantDetectors = threatTypeMap[checkName] || [];
    const hasThreat = threats.some((t) => relevantDetectors.includes(t.detector));
    if (hasThreat) {
      const severities = threats.filter((t) => relevantDetectors.includes(t.detector)).map((t) => t.severity?.toLowerCase());
      if (severities.includes('critical') || severities.includes('high')) return 'fail';
      return 'warn';
    }
    return 'pass';
  };

  const checkNameKeys: Record<string, string> = {
    'Malicious Code': 'detail.checkMaliciousCode',
    'Data Leakage': 'detail.checkDataLeakage',
    'Network Requests': 'detail.checkNetworkRequests',
    'Shellout Access': 'detail.checkShelloutAccess',
    'File System': 'detail.checkFileSystem',
  };

  const scanChecks = [
    { name: 'Malicious Code', status: getCheckStatus('Malicious Code') },
    { name: 'Data Leakage', status: getCheckStatus('Data Leakage') },
    { name: 'Network Requests', status: getCheckStatus('Network Requests') },
    { name: 'Shellout Access', status: getCheckStatus('Shellout Access') },
    { name: 'File System', status: getCheckStatus('File System') },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 px-4 sm:px-6 md:px-10 py-4 md:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 md:mb-6">
          <Link to="/marketplace" className="hover:text-foreground transition-colors">{t('header.title')}</Link>
          <span>/</span>
          <span className="text-foreground truncate">{skill.name}</span>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 md:p-8 mb-4 md:mb-6">
          <div className="flex flex-col gap-4">
            {/* Author */}
            <div className="flex items-center gap-2.5">
              {skill.authorAvatar ? (
                <img src={skill.authorAvatar} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                  {(skill.authorName || skill.user.username)[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm text-muted-foreground">{skill.authorName || skill.user.username}</span>
              {scan?.riskLevel && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskColors[scan.riskLevel]}`}>
                  {riskLabelKeys[scan.riskLevel] ? t(riskLabelKeys[scan.riskLevel]) : scan.riskLevel}
                </span>
              )}
            </div>

            {/* Title + Score */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{skill.name}</h1>
              {score > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${tier.bgColor} ${tier.color}`}>
                  {tier.letter} {score}
                </span>
              )}
            </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {cleanDescription(skill.description) || 'No description provided.'}
              </p>

              {/* Tags Row 1: Category, Language, Size, License */}
              <div className="flex flex-wrap items-center gap-2">
                {skill.category && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${categoryColors[skill.category] || 'text-gray-400 bg-gray-400/10'}`}>
                    {skill.category.replace(' Skills', '')}
                  </span>
                )}
                {skill.language && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium text-foreground bg-secondary border border-border">
                    {skill.language}
                  </span>
                )}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sizeColors[sizeKey]}`}>
                  {t(sizeLabelKeys[sizeKey])}
                </span>
                {skill.stars != null && skill.stars > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium text-amber-400 bg-amber-400/10 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {formatStars(skill.stars)}
                  </span>
                )}
              </div>

              {/* Tags Row 2: Platform badges + topics */}
              {(platforms.length > 0 || topics.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {platforms.map((p) => (
                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                      {p}
                    </span>
                  ))}
                  {topics.slice(0, 5).map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* View on GitHub button */}
              {hasSource && (
                <div className="pt-2">
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 h-11 px-6 rounded-xl bg-[#0d1117] text-white text-sm font-medium hover:bg-[#161b22] transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    {t('detail.viewOnGithub')}
                  </a>
                </div>
              )}

              {/* Install Command */}
              {hasSource && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    {(['claude', 'npx', 'git'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setInstallTab(tab)}
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                          installTab === tab
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                      >
                        {tab === 'claude' ? t('detail.installClaude') : tab === 'npx' ? t('detail.installNpx') : t('detail.installGit')}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex items-center bg-[#0d1117] rounded-xl px-3 md:px-4 py-3 border border-border overflow-hidden">
                    <code className="text-xs md:text-sm text-emerald-400 font-mono truncate flex-1 pr-8">
                      {installCommands[installTab]}
                    </code>
                    <button
                      onClick={copyCommand}
                      className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Bottom Section: Stats + Security side by side */}
        {/* Token Banner */}
        {linkedToken && linkedTokenInfo && (
          <Link
            to={`/launchpad/${linkedToken.id}`}
            className="flex items-center justify-between p-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors mb-2"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">${linkedToken.symbol}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{linkedTokenInfo.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t('detail.skillTokenOn')} {linkedToken.chainId === 97 ? 'BSC Testnet' : 'BNB Chain'}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-sm font-bold text-foreground">{linkedTokenInfo.priceNum < 0.0001
                  ? (() => { const s = linkedTokenInfo.priceNum.toFixed(18).replace(/0+$/, ''); const m = s.match(/^0\.(0+)(\d{1,4})/); if (m) { const sub = '₀₁₂₃₄₅₆₇₈₉'; return `0.0${String(m[1].length).split('').map(d => sub[+d]).join('')}${m[2]}`; } return linkedTokenInfo.priceNum.toFixed(10); })()
                  : linkedTokenInfo.priceNum.toFixed(6)} BNB</p>
                <p className="text-[10px] text-muted-foreground">MCap: {linkedTokenInfo.marketCap.toFixed(4)} BNB</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(linkedTokenInfo.progress, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{linkedTokenInfo.progress.toFixed(1)}%</span>
                </div>
              </div>
              <span className="text-primary text-sm font-medium">{t('detail.trade')}</span>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('detail.stats')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: t('detail.stars'), value: formatStars(skill.stars), color: 'text-amber-400' },
                { label: t('detail.downloads'), value: skill.downloadCount.toLocaleString(), color: 'text-primary' },
                { label: t('detail.score'), value: score || '--', color: 'text-info' },
                { label: t('detail.security'), value: scan?.riskScore != null ? `${100 - scan.riskScore}/100` : '--', color: 'text-success' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1.5 py-3 rounded-lg bg-secondary">
                  <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Report */}
          <div className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/goplus-single.svg" alt="GoPlus" className="h-5" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('detail.securityByGoplus')}</h3>
              </div>
              {scan?.status === 'SCANNING' || scan?.status === 'PENDING' ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold text-warning bg-warning/10">{t('detail.scanning')}</span>
              ) : scan?.riskLevel ? (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${riskColors[scan.riskLevel]}`}>
                  {riskLabelKeys[scan.riskLevel] ? t(riskLabelKeys[scan.riskLevel]) : scan.riskLevel}
                </span>
              ) : null}
            </div>
            {scan?.status === 'SCANNING' || scan?.status === 'PENDING' ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">{t('detail.scanningProgress')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {scanChecks.map((check) => {
                  const info = scanItemStatus[check.status];
                  const Icon = info.icon;
                  return (
                    <div key={check.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${info.color}`} />
                        <span className="text-sm text-foreground">{t(checkNameKeys[check.name])}</span>
                      </div>
                      <span className={`text-xs font-medium ${info.color}`}>{t(info.labelKey)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {scan?.scanSummary && (
              <p className="text-xs text-muted-foreground border-t border-border pt-3">{scan.scanSummary}</p>
            )}
            {scan?.scanDetails?.scan_id && (
              <a
                href={`https://agentguard.gopluslabs.io/report/${scan.scanDetails.scan_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#00D4AA] hover:text-[#00E4BA] transition-colors border-t border-border pt-3"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('detail.viewFullReport')}
              </a>
            )}
          </div>

          {/* Developer / Source */}
          <div className="flex flex-col gap-4 p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('detail.source')}</h3>
            <div className="flex items-center gap-3">
              {skill.authorAvatar ? (
                <img src={skill.authorAvatar} alt="" className="w-10 h-10 rounded-full border border-border" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-sm text-muted-foreground">
                  {(skill.authorName || skill.user.username)[0].toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{skill.authorName || skill.user.username}</span>
                <span className="text-xs text-muted-foreground">{skill.sourceRepo || t('detail.skillDeveloper')}</span>
              </div>
            </div>
            {hasSource && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {githubUrl.replace('https://', '')}
              </a>
            )}
            {skill.lastCommitAt && (
              <span className="text-xs text-muted-foreground">
                {t('detail.lastCommit')} {new Date(skill.lastCommitAt).toLocaleDateString()}
              </span>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-border">
              <button
                onClick={handleDownload}
                className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Download className="w-4 h-4" />
                {t('detail.download')}
              </button>
              {skill.tokenLaunches && skill.tokenLaunches.length > 0 ? (
                <Link
                  to={`/launchpad/${skill.tokenLaunches[0].id}`}
                  className="w-full h-10 rounded-xl border border-primary/30 text-primary font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
                >
                  <Rocket className="w-4 h-4" />
                  {t('detail.viewToken')} (${skill.tokenLaunches[0].symbol})
                </Link>
              ) : (
                <Link
                  to={`/launchpad/create?skillId=${skill.id}`}
                  className="w-full h-10 rounded-xl border border-primary/30 text-primary font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
                >
                  <Rocket className="w-4 h-4" />
                  {t('detail.launchToken')}
                </Link>
              )}
              {user?.id === skill.user.id && (
                <button
                  onClick={handleDelete}
                  className="w-full h-10 rounded-xl border border-destructive/30 text-destructive font-medium text-sm flex items-center justify-center hover:bg-destructive/10 transition-colors"
                >
                  {t('detail.delete')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Threats detail (if any) */}
        {threats.length > 0 && scan?.status === 'COMPLETED' && (
          <div className="mt-6 p-6 rounded-2xl border border-border bg-card">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">{t('detail.threatDetails')} ({threats.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {threats.map((t, i) => (
                <div key={i} className="flex flex-col gap-1 p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      t.severity?.toLowerCase() === 'critical' ? 'text-destructive bg-destructive/10' :
                      t.severity?.toLowerCase() === 'high' ? 'text-orange-500 bg-orange-500/10' :
                      t.severity?.toLowerCase() === 'medium' ? 'text-warning bg-warning/10' :
                      'text-muted-foreground bg-secondary'
                    }`}>{t.severity}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
