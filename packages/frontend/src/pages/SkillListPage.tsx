import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Upload, Star, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import Footer from '@/components/Footer';
import { useAuthStore } from '@/store/auth.store';

interface Skill {
  id: string;
  name: string;
  description?: string;
  downloadCount: number;
  createdAt: string;
  updatedAt?: string;
  category?: string;
  stars?: number;
  language?: string;
  authorName?: string;
  authorAvatar?: string;
  sourceRepo?: string;
  lastCommitAt?: string;
  user: { username: string; avatarUrl?: string };
  scanResult?: { status: string; riskLevel?: string; safeToUse?: boolean };
  tokenLaunches?: { id: string; symbol: string; tokenAddress?: string; chainId?: number }[];
}

const riskColors: Record<string, string> = {
  LOW: 'text-success bg-success/10 border-success/20',
  MEDIUM: 'text-warning bg-warning/10 border-warning/20',
  HIGH: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  CRITICAL: 'text-destructive bg-destructive/10 border-destructive/20',
};

const riskLabelKeys: Record<string, string> = {
  LOW: 'risk.safe',
  MEDIUM: 'risk.caution',
  HIGH: 'risk.risky',
  CRITICAL: 'risk.dangerous',
};

const categoryKeys = [
  { key: 'bnbchain', apiValue: 'BNBChain Skills', featured: true },
  { key: 'all', apiValue: 'All Skills' },
  { key: 'clawhub', apiValue: 'Openclaw Skills' },
  { key: 'devtools', apiValue: 'Developer Tools' },
  { key: 'blockchain', apiValue: 'Blockchain' },
  { key: 'security', apiValue: 'Security' },
  { key: 'data', apiValue: 'Data & Analytics' },
  { key: 'devops', apiValue: 'DevOps' },
  { key: 'productivity', apiValue: 'Productivity' },
  { key: 'other', apiValue: 'Other' },
];

type SortOption = 'stars' | 'recent' | 'score' | 'downloads';

const sortLabelKeys: Record<SortOption, string> = {
  stars: 'sort.stars',
  recent: 'sort.recent',
  score: 'sort.score',
  downloads: 'sort.downloads',
};

/** Strip HTML tags, markdown comments, and leading markdown formatting */
function cleanDescription(desc?: string): string {
  if (!desc) return '';
  return desc
    .replace(/<!--[\s\S]*?-->/g, '')           // HTML comments
    .replace(/<[^>]+>/g, '')                     // HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, '')             // Markdown images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')       // Markdown links → text only
    .replace(/^#{1,6}\s+/gm, '')                 // Heading prefixes
    .replace(/\*\*(.+?)\*\*/g, '$1')             // Bold
    .replace(/\*(.+?)\*/g, '$1')                 // Italic
    .replace(/`([^`]+)`/g, '$1')                 // Inline code
    .replace(/\n{2,}/g, ' ')                     // Multiple newlines
    .replace(/\n/g, ' ')                         // Single newlines
    .replace(/\s{2,}/g, ' ')                     // Multiple spaces
    .trim();
}

/** Relative time (e.g., "3d ago", "2mo ago") */
function timeAgo(dateStr?: string, t?: any): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('time.mAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('time.dAgo', { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return t('time.moAgo', { count: months });
  const years = Math.floor(months / 12);
  return t('time.yAgo', { count: years });
}

/** Format star count (e.g., 26694 → "26.7k") */
function formatStars(n?: number): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function SortDropdown({ sortBy, onChange }: { sortBy: SortOption; onChange: (v: SortOption) => void }) {
  const { t } = useTranslation('marketplace');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-4 rounded-full bg-secondary border border-border text-sm text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
      >
        {t(sortLabelKeys[sortBy])}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl bg-card border border-border shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {Object.entries(sortLabelKeys).map(([value, labelKey]) => (
            <button
              key={value}
              onClick={() => { onChange(value as SortOption); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3.5 py-2 text-sm transition-colors ${
                sortBy === value
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              {t(labelKey)}
              {sortBy === value && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SkillListPage() {
  const { t } = useTranslation('marketplace');
  const { user } = useAuthStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [total, setTotal] = useState(0);
  const [totalSkills, setTotalSkills] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // 实际发送到API的搜索词
  const [activeCategory, setActiveCategory] = useState('BNBChain Skills'); // stores apiValue for API calls
  const [sortBy, setSortBy] = useState<SortOption>('downloads');

  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    api.get('/skills/stats').then(({ data }) => setTotalSkills(data.total || 0));
  }, []);

  useEffect(() => {
    setLoading(true);

    // Use unified skills endpoint with search parameter
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (activeCategory !== 'All Skills') params.set('category', activeCategory);
    if (sortBy) params.set('sortBy', sortBy);
    if (searchQuery) params.set('search', searchQuery);
    
    api.get(`/skills?${params}`)
      .then(({ data }) => {
        setSkills(data.skills || []);
        setTotal(data.total || 0);
      })
      .finally(() => setLoading(false));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, activeCategory, sortBy, searchQuery]);

  // Handle search - only use backend results, no client-side filtering
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(search.trim());
      setPage(1);
    }
  };
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col gap-4 md:gap-6 px-4 sm:px-6 md:px-10 py-4 md:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col gap-1 md:gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-[28px] font-bold text-foreground">{t('header.title')}</h1>
              {totalSkills > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  {totalSkills.toLocaleString()} {t('header.totalSkills')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t('header.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-secondary border border-border flex-1 sm:flex-none sm:w-48 md:w-60">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('header.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
            </div>
            <SortDropdown sortBy={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} />
            {user && (
              <Link
                to="/upload"
                className="flex items-center gap-2 h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Upload className="w-4 h-4" />
                {t('header.uploadSkill')}
              </Link>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mb-2">
          {categoryKeys.map((cat) => {
            const isFeatured = !!cat.featured;
            const isActive = activeCategory === cat.apiValue;
            return (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.apiValue); setPage(1); }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? isFeatured
                      ? 'bg-[#F0B90B] text-black'
                      : 'bg-primary text-primary-foreground'
                    : isFeatured
                      ? 'text-[#F0B90B] bg-[#F0B90B]/10 border border-[#F0B90B]/30 hover:bg-[#F0B90B]/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                {isFeatured && '⭐ '}{t(`categories.${cat.key}`)}
              </button>
            );
          })}
        </div>

        {/* Skill Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">{t('loading')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {skills.map((skill, index) => (
              <Link
                key={skill.id}
                to={`/skills/${skill.id}`}
                className="relative flex flex-col gap-3.5 p-5 rounded-xl bg-card border border-border hover:shadow-md hover:border-primary/20 transition-all group"
              >
                {/* Rank badge */}
                <div className="absolute -top-2.5 -left-2.5 w-7 h-7 rounded-full bg-muted-foreground/80 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                  {index + 1}
                </div>

                {/* Author avatar + name + security badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {skill.authorAvatar ? (
                      <img
                        src={skill.authorAvatar}
                        alt={skill.authorName || ''}
                        className="w-9 h-9 rounded-full border border-border object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                        {(skill.authorName || skill.user.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {skill.authorName || skill.user.username}
                    </span>
                  </div>
                  {skill.scanResult?.riskLevel && (
                    <div className="flex items-center gap-1.5">
                      <img src="/goplus-single.svg" alt="GoPlus" className="w-3.5 h-3.5" />
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${riskColors[skill.scanResult.riskLevel] || ''}`}>
                        {riskLabelKeys[skill.scanResult.riskLevel] ? t(riskLabelKeys[skill.scanResult.riskLevel]) : skill.scanResult.riskLevel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Skill name + token badge */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug truncate">
                    {skill.name}
                  </h3>
                  {skill.tokenLaunches && skill.tokenLaunches.length > 0 && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      ${skill.tokenLaunches[0].symbol}
                    </span>
                  )}
                </div>

                {/* Description */}
                {skill.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {cleanDescription(skill.description)}
                  </p>
                )}

                {/* Bottom: stars + time */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-semibold text-foreground">{formatStars(skill.stars)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(skill.lastCommitAt || skill.updatedAt || skill.createdAt, t)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-end items-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground font-medium hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('pagination.prev')}
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (page <= 4) {
                p = i + 1;
              } else if (page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = page - 3 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground font-medium hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('pagination.next')}
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
