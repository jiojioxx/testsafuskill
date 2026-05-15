import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, ImagePlus, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/Toast';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import UploadSkillModal from '@/components/skills/UploadSkillModal';
import InitialBuyModal, { type TokenFormData } from '@/components/skills/InitialBuyModal';
import FourMemeDeployModal from '@/components/skills/FourMemeDeployModal';

interface Skill {
  id: string;
  name: string;
  description?: string;
  authorName?: string;
  sourceRepo?: string;
  symbol?: string;
  authorAvatar?: string;
  tokenLaunches?: { id: string; status: string }[];
}

export default function CreateTokenPage() {
  const { t } = useTranslation('launchpad');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [skillSearch, setSkillSearch] = useState('');
  const [skillSearchLoading, setSkillSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [feeExpanded, setFeeExpanded] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showFourMemeModal, setShowFourMemeModal] = useState(false);
  const [platform, setPlatform] = useState<'FLAP' | 'FOURMEME'>('FLAP');

  const searchRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const skillId = searchParams.get('skillId');
    if (skillId) {
      api.get(`/skills/${skillId}`)
        .then(({ data }) => setSelectedSkill(data))
        .catch(() => {});
    }
  }, [searchParams]);

  useEffect(() => {
    if (!skillSearch) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(() => {
      setSkillSearchLoading(true);
      setShowDropdown(true);
      api.get(`/skills/search?q=${encodeURIComponent(skillSearch)}&page=1&limit=8`)
        .then(({ data }) => setSearchResults(data.skills || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSkillSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [skillSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('create.tokenInfo.imageTooLarge'), 'error');
      e.target.value = '';
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast(t('create.tokenInfo.imageTooLarge'), 'error'); return; }
    if (!file.type.match(/^image\/(png|jpeg|webp|gif)$/)) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const selectSkill = (skill: Skill) => {
    if (skill.tokenLaunches?.some(t => t.status === 'ACTIVE' || t.status === 'DEPLOYING')) {
      showToast(t('create.selectSkill.hasToken'), 'error');
      return;
    }
    setSelectedSkill(skill);
    setSkillSearch('');
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !symbol.trim() || !imageFile || !selectedSkill) return;

    const w = website.trim();
    const tw = twitter.trim();
    if (w && !/^https?:\/\/.{1,150}$/.test(w)) {
      showToast(t('create.tokenInfo.invalidWebsite'), 'error');
      return;
    }
    if (tw && (tw.length > 200 || !(tw.startsWith('https://twitter.com') || tw.startsWith('https://x.com')))) {
      showToast(t('create.tokenInfo.invalidTwitter'), 'error');
      return;
    }

    if (platform === 'FLAP') {
      setShowBuyModal(true);
    } else {
      setShowFourMemeModal(true);
    }
  };

  const formData: TokenFormData = {
    name: name.trim(),
    symbol: symbol.trim().toUpperCase(),
    description: description.trim(),
    imageFile: imageFile || undefined,
    skillId: selectedSkill?.id || '',
    website: website.trim() || undefined,
    twitter: twitter.trim() || undefined,
    skillName: selectedSkill?.name,
  };

  const canSubmit = name.trim() && symbol.trim() && imageFile && selectedSkill;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col gap-6 px-4 sm:px-10 py-6 sm:py-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/launchpad')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold text-foreground">{t('create.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('create.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5 sm:p-6 rounded-lg border border-border bg-card">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            🗒️ {t('create.tokenInfo.heading')}
          </h2>

          {/* Image + Name + Symbol row */}
          <div className="flex gap-4">
            {/* Image upload */}
            <div
              className="w-[140px] h-[140px] shrink-0 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 bg-secondary/30 overflow-hidden"
              onClick={() => imageInputRef.current?.click()}
              onDrop={handleImageDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground text-center px-2">PNG · JPEG · WEBP · GIF <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-muted-foreground">Max Size: 5MB</span>
                </>
              )}
              <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleImageChange} className="hidden" />
            </div>

            {/* Name + Symbol */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('create.tokenInfo.name')} <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('create.tokenInfo.namePlaceholder')}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={50}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">{t('create.tokenInfo.symbol')} <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 15))}
                  placeholder={t('create.tokenInfo.symbolPlaceholder')}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t('create.tokenInfo.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('create.tokenInfo.descPlaceholder')}
              rows={4}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          {/* Select Skill */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              {t('create.selectSkill.heading')}
            </label>
            <p className="text-xs text-muted-foreground -mt-1">{t('create.selectSkill.desc')}</p>

            {selectedSkill ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                {selectedSkill.authorAvatar ? (
                  <img src={selectedSkill.authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                    {selectedSkill.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground block truncate">{selectedSkill.name}</span>
                  {selectedSkill.description && (
                    <span className="text-xs text-muted-foreground block truncate">{selectedSkill.description}</span>
                  )}
                </div>
                {selectedSkill.symbol && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded shrink-0">{selectedSkill.symbol}</span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSkill(null)}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 shrink-0"
                >
                  {t('create.selectSkill.change')}
                </button>
              </div>
            ) : (
              <div ref={searchRef} className="relative">
                <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-background border border-border focus-within:ring-2 focus-within:ring-primary/50">
                  {skillSearchLoading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" /> : <Search className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    onFocus={() => skillSearch && setShowDropdown(true)}
                    placeholder={t('create.selectSkill.searchPlaceholder')}
                    className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
                  />
                  {skillSearch && (
                    <button type="button" onClick={() => { setSkillSearch(''); setShowDropdown(false); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                    {searchResults.length === 0 && !skillSearchLoading && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t('create.selectSkill.noResults', { q: skillSearch })}
                      </p>
                    )}
                    {searchResults.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => selectSkill(skill)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                      >
                        {skill.authorAvatar ? (
                          <img src={skill.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                            {skill.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground block truncate">{skill.name}</span>
                          {skill.description && <span className="text-xs text-muted-foreground block truncate">{skill.description}</span>}
                        </div>
                        {skill.symbol && <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{skill.symbol}</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setShowDropdown(false); setShowUploadModal(true); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 border-t border-border hover:bg-secondary transition-colors text-sm text-primary font-medium"
                    >
                      {t('create.selectSkill.uploadSkill')}
                    </button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {t('create.selectSkill.noSuitableSkill')}{' '}
                  <button type="button" onClick={() => setShowUploadModal(true)} className="text-primary hover:underline">
                    {t('create.selectSkill.uploadSkillLink')} →
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Website */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t('create.tokenInfo.website')}</label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t('create.tokenInfo.websitePlaceholder')}
              className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Twitter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">{t('create.tokenInfo.twitter')}</label>
            <input
              type="text"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder={t('create.tokenInfo.twitterPlaceholder')}
              className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Platform Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">{t('create.platform.heading')}</label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setPlatform('FLAP')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platform === 'FLAP'
                    ? 'bg-primary/10 text-primary border-r border-border'
                    : 'text-muted-foreground hover:text-foreground border-r border-border'
                }`}
              >
                flap
              </button>
              <button
                type="button"
                onClick={() => setPlatform('FOURMEME')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  platform === 'FOURMEME'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                four.meme
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {platform === 'FLAP'
                ? t('create.platform.flapDesc')
                : t('create.platform.fourmemeDesc')}
            </p>
          </div>

          {/* Fee explanation */}
          <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setFeeExpanded(!feeExpanded)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <span className="font-medium text-foreground">{t('create.fee.title')}</span>
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">1%</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {t('create.fee.viewDetail')}
                {feeExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            {!feeExpanded && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">{t('create.fee.summary')}</p>
            )}
            {feeExpanded && (
              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-1">{t('create.fee.desc')}</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: t('create.fee.dev'), pct: '70%', desc: t('create.fee.devDesc') },
                    { label: t('create.fee.pool'), pct: '15%', desc: t('create.fee.poolDesc') },
                    { label: t('create.fee.platform'), pct: '15%', desc: t('create.fee.platformDesc') },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{row.desc}</span>
                        <span className="font-medium text-foreground w-8 text-right">{row.pct}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('create.fee.locked')}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('create.submit')}
          </button>
        </form>

        <div className="flex items-center justify-center gap-3 py-6 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium">{t('create.poweredBy')}</span>
          <span className="text-xs text-muted-foreground/60 font-medium">Flap Protocol</span>
          <span className="text-muted-foreground/20">·</span>
          <span className="text-xs text-muted-foreground/60 font-medium">Four.meme</span>
          <span className="text-muted-foreground/20">·</span>
          <span className="text-xs text-muted-foreground/60 font-medium">BNB Chain</span>
        </div>
      </div>
      <Footer />

      <UploadSkillModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={(skill) => {
          setShowUploadModal(false);
          setSelectedSkill(skill);
        }}
      />

      <InitialBuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        formData={formData}
        onSuccess={(tokenAddress, txHash) => {
          setShowBuyModal(false);
          navigate(`/launchpad`);
        }}
      />

      <FourMemeDeployModal
        isOpen={showFourMemeModal}
        onClose={() => setShowFourMemeModal(false)}
        formData={formData}
        onSuccess={(tokenAddress, txHash) => {
          setShowFourMemeModal(false);
          navigate(`/launchpad`);
        }}
      />
    </div>
  );
}
