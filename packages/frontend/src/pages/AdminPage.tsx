import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, ArrowUp, ArrowDown, Star, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import Footer from '@/components/Footer';

interface FeaturedItem {
  id: string;
  skillId: string;
  sortOrder: number;
  skill: { id: string; name: string; authorName?: string; authorAvatar?: string; sourceRepo?: string; downloadCount?: number; stars?: number; category?: string };
}

interface SkillSearchResult {
  id: string;
  name: string;
  authorName?: string;
  category?: string;
  stars?: number;
  downloadCount?: number;
}

export default function AdminPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SkillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch featured list
  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    api.get('/admin/featured')
      .then(({ data }) => setFeatured(data))
      .catch((err) => {
        if (err?.response?.status === 403) navigate('/');
        else setError(t('admin.loadFailed'));
      })
      .finally(() => setLoading(false));
  }, [token, navigate]);

  // Search skills
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/skills?search=${encodeURIComponent(searchQuery.trim())}&limit=10`);
      setSearchResults(data.skills || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Add to featured
  const handleAdd = async (skillId: string) => {
    try {
      const maxOrder = featured.length > 0 ? Math.max(...featured.map((f) => f.sortOrder)) + 1 : 0;
      const { data } = await api.post('/admin/featured', { skillId, sortOrder: maxOrder });
      // Refresh
      const { data: updated } = await api.get('/admin/featured');
      setFeatured(updated);
      setSearchResults((prev) => prev.filter((s) => s.id !== skillId));
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.addFailed'));
    }
  };

  // Remove from featured
  const handleRemove = async (id: string) => {
    try {
      await api.delete(`/admin/featured/${id}`);
      setFeatured((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.removeFailed'));
    }
  };

  // Move up/down
  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = featured.findIndex((f) => f.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= featured.length) return;

    try {
      const a = featured[idx];
      const b = featured[swapIdx];
      await Promise.all([
        api.put(`/admin/featured/${a.id}`, { sortOrder: b.sortOrder }),
        api.put(`/admin/featured/${b.id}`, { sortOrder: a.sortOrder }),
      ]);
      const { data: updated } = await api.get('/admin/featured');
      setFeatured(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('admin.reorderFailed'));
    }
  };

  const featuredIds = new Set(featured.map((f) => f.skillId));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('admin.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col gap-6 px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-3xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.subtitle')}</p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Search to add */}
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">{t('admin.addSkill')}</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('admin.searchPlaceholder')}
              className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {t('admin.search')}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {searchResults.map((skill) => (
                <div key={skill.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{skill.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{skill.authorName || ''}</span>
                    {skill.stars ? <span className="text-xs text-amber-400 ml-2">★ {skill.stars}</span> : null}
                  </div>
                  {featuredIds.has(skill.id) ? (
                    <span className="text-xs text-muted-foreground">{t('admin.alreadyFeatured')}</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(skill.id)}
                      className="h-7 px-2.5 rounded bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {t('admin.add')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current featured list */}
        <div className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">{t('admin.featuredSkills', { count: featured.length })}</h2>

          {featured.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">{t('admin.noFeatured')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {featured.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border bg-background">
                  <span className="text-xs text-muted-foreground font-mono w-6 text-center">{idx + 1}</span>
                  {item.skill.authorAvatar && (
                    <img src={item.skill.authorAvatar} alt="" className="w-7 h-7 rounded-full" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.skill.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.skill.authorName} {item.skill.sourceRepo ? `· ${item.skill.sourceRepo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(item.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(item.id, 'down')}
                      disabled={idx === featured.length - 1}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
