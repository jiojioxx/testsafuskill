import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Footer from '@/components/Footer';
import api from '@/lib/api';

/* ── data ── */
const pillarKeys = [
  { icon: 'storefront', iconColor: 'text-primary', iconBg: 'bg-primary/10', key: 'marketplace' },
  { icon: 'security', iconColor: 'text-green-400', iconBg: 'bg-green-400/10', key: 'security' },
  { icon: 'rocket_launch', iconColor: 'text-blue-400', iconBg: 'bg-blue-400/10', key: 'economy' },
];

const economyStepKeys = ['discover', 'build', 'launch', 'grow'];

const tokenParamKeys = [
  { key: 'totalSupply', icon: 'token' },
  { key: 'currency', icon: 'currency_exchange' },
  { key: 'graduation', icon: 'trending_up' },
  { key: 'security', icon: 'verified_user' },
];

const securityItems = [
  { icon: 'bug_report', key: 'maliciousCode' },
  { icon: 'shield', key: 'dataLeakage' },
  { icon: 'language', key: 'networkRequests' },
  { icon: 'terminal', key: 'shelloutAccess' },
  { icon: 'folder_open', key: 'fileSystem' },
];


/* ── hooks ── */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useMouseGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);
  return { ref, handleMove };
}

/* ── component ── */
export default function LandingPage() {
  const { t } = useTranslation('landing');
  const hero = useInView(0.1);
  const feat = useInView(0.1);
  const hiw = useInView(0.1);
  const tok = useInView(0.1);
  const sec = useInView(0.1);
  const cta = useInView(0.1);

  const { ref: glowRef, handleMove } = useMouseGlow();

  // Global feed
  const [feed, setFeed] = useState<{ type: string; id: string; message: string; user: string; tokenId: string; symbol: string; createdAt: string }[]>([]);
  useEffect(() => {
    api.get('/tokens/feed').then(({ data }) => setFeed(data)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col overflow-hidden">

      {/* ═══ HERO ═══ */}
      <section
        ref={hero.ref}
        className="relative flex flex-col items-center gap-5 md:gap-7 px-4 sm:px-6 md:px-10 py-12 md:py-20 grid-bg"
      >
        {/* Ambient glow orbs */}
        <div className="hero-glow top-[-200px] left-1/2 -translate-x-1/2 animate-float" />
        <div className="hero-glow top-[100px] left-[10%] w-[300px] h-[300px] opacity-40 animate-float delay-500 hidden sm:block" style={{ animationDuration: '6s' }} />
        <div className="hero-glow top-[80px] right-[10%] w-[250px] h-[250px] opacity-30 animate-float delay-300 hidden sm:block" style={{ animationDuration: '5s' }} />

        {/* G+ background watermark */}
        <img
          src="/goplus-gold.svg"
          alt=""
          className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[400px] md:w-[500px] lg:w-[650px] opacity-[0.08] pointer-events-none blur-[1px]"
          style={{ animation: 'float 8s ease-in-out infinite' }}
        />

        {/* Orbiting rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-primary/[0.04] pointer-events-none hidden md:block" style={{ animation: 'orbit 60s linear infinite' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-primary/[0.06] pointer-events-none hidden md:block" style={{ animation: 'orbit 45s linear infinite reverse' }} />

        {/* Tag */}
        <div className={`flex items-center gap-2 rounded-full border border-primary/25 px-3 py-1.5 animate-pulse-glow ${hero.inView ? 'animate-fade-up' : 'opacity-0'}`}>
          <span className="material-symbols-rounded text-primary text-base">verified</span>
          <span className="text-primary text-[12px] sm:text-[13px] font-medium">{t('hero.tag')}</span>
        </div>

        {/* Title */}
        <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center leading-[1.08] max-w-[800px] animate-gradient-text ${hero.inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}>
          {t('hero.title')}
        </h1>

        {/* Subtitle */}
        <p className={`text-sm sm:text-base text-muted-foreground text-center leading-relaxed max-w-[620px] ${hero.inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
          {t('hero.subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto ${hero.inView ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
          <Link
            to="/marketplace"
            className="group relative h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(240,185,11,0.35)] hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto"
          >
            <span className="relative z-10">{t('hero.explore')}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          </Link>
          <Link
            to="/launchpad"
            className="h-11 px-6 rounded-full border border-border text-foreground text-sm font-medium flex items-center justify-center transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto"
          >
            {t('hero.launch')}
          </Link>
        </div>
      </section>

      {/* ═══ LIVE FEED ═══ */}
      {/* {feed.length > 0 && (
        <div className="overflow-hidden border-y border-border bg-card/50 py-2.5">
          <div className="flex animate-marquee gap-8 px-4">
            {[...feed, ...feed].map((item, i) => (
              <Link
                key={`${item.id}-${i}`}
                to={`/launchpad/${item.tokenId}`}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
              >
                <span>{item.type === 'launch' ? '🚀' : '💬'}</span>
                <span className="font-medium text-foreground">{item.user}</span>
                <span>{item.message}</span>
                <span className="text-primary font-medium">${item.symbol}</span>
              </Link>
            ))}
          </div>
        </div>
      )} */}

      {/* ═══ THREE PILLARS ═══ */}
      <section ref={feat.ref} className="flex flex-col items-center gap-8 px-4 sm:px-6 md:px-10 py-10 md:py-16">
        <div className={`flex flex-col items-center gap-2 ${feat.inView ? 'animate-fade-up' : 'opacity-0'}`}>
          <h2 className="text-xl md:text-2xl font-bold text-foreground text-center">{t('pillars.heading')}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">{t('pillars.subheading')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
          {pillarKeys.map((f, i) => (
            <div
              key={f.key}
              className={`group relative flex flex-col gap-4 p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_40px_rgba(240,185,11,0.06)] ${feat.inView ? `animate-grid-fade delay-${(i + 1) * 100}` : 'opacity-0'}`}
            >
              <div className={`w-12 h-12 rounded-xl ${f.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                <span className={`material-symbols-rounded ${f.iconColor} text-2xl`}>{f.icon}</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{t(`pillars.${f.key}.title`)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`pillars.${f.key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW THE ECONOMY WORKS ═══ */}
      <section ref={hiw.ref} className="flex flex-col items-center gap-6 md:gap-8 px-4 sm:px-6 md:px-10 py-10 md:py-16 bg-[#0B0E11] relative">
        <h2 className={`text-xl md:text-2xl font-bold text-foreground ${hiw.inView ? 'animate-fade-up' : 'opacity-0'}`}>{t('howItWorks.heading')}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-[20px] left-[12.5%] right-[12.5%] h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          {economyStepKeys.map((key, i) => (
            <div
              key={key}
              className={`flex flex-col items-center gap-4 text-center ${hiw.inView ? `animate-fade-up delay-${(i + 1) * 150}` : 'opacity-0'}`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-base relative z-10 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(240,185,11,0.4)]">
                  {i + 1}
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '3s', animationDelay: `${i * 0.5}s` }} />
              </div>
              <h3 className="text-base font-semibold text-foreground">{t(`howItWorks.steps.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`howItWorks.steps.${key}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TOKENOMICS — hidden while launchpad is disabled ═══
      <section ref={tok.ref} className="flex flex-col items-center gap-6 md:gap-10 px-4 sm:px-6 md:px-10 py-10 md:py-16 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #F0B90B 0%, transparent 70%)' }} />
        <div className={`flex flex-col items-center gap-2 ${tok.inView ? 'animate-fade-up' : 'opacity-0'}`}>
          <h2 className="text-xl md:text-2xl font-bold text-foreground text-center">{t('tokenomics.heading')}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-lg">{t('tokenomics.subheading')}</p>
        </div>
        ...tokenomics content...
      </section>
      */}

      {/* ═══ SECURITY ═══ */}
      <section ref={sec.ref} className="flex flex-col items-center gap-5 px-4 sm:px-6 md:px-10 py-8 md:py-12 bg-[#0B0E11]">
        <div className={`flex items-center gap-3 ${sec.inView ? 'animate-fade-up' : 'opacity-0'}`}>
          <img src="/goplus-white.svg" alt="GoPlus" className="h-5 opacity-90" />
          <h2 className="text-base md:text-lg font-bold text-foreground">{t('security.heading')}</h2>
        </div>
        <div className={`flex flex-wrap items-center justify-center gap-3 md:gap-4 max-w-3xl ${sec.inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}>
          {securityItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/15 bg-primary/[0.03]"
            >
              <span className="material-symbols-rounded text-primary text-base">{item.icon}</span>
              <span className="text-xs font-medium text-foreground">{t(`security.${item.key}`)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section
        ref={(el) => { (cta as any).ref.current = el; (glowRef as any).current = el; }}
        onMouseMove={handleMove}
        className="relative flex flex-col items-center gap-5 md:gap-6 px-4 sm:px-6 md:px-10 py-12 md:py-20 bg-card overflow-hidden"
      >
        {/* Mouse-follow spotlight */}
        <div
          className="pointer-events-none absolute w-[400px] h-[400px] rounded-full opacity-[0.07] hidden md:block"
          style={{
            background: 'radial-gradient(circle, rgb(240 185 11) 0%, transparent 70%)',
            left: 'var(--mx, 50%)',
            top: 'var(--my, 50%)',
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.3s ease, top 0.3s ease',
          }}
        />

        <h2 className={`text-xl md:text-2xl font-bold text-foreground relative z-10 text-center ${cta.inView ? 'animate-fade-up' : 'opacity-0'}`}>
          {t('cta.heading')}
        </h2>
        <p className={`text-sm text-muted-foreground text-center max-w-lg relative z-10 ${cta.inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}>
          {t('cta.subheading')}
        </p>
        <div className={`flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto relative z-10 ${cta.inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
          <Link
            to="/upload"
            className="group relative h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(240,185,11,0.35)] hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto"
          >
            <span className="relative z-10">{t('cta.startBuilding')}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          </Link>
          <Link
            to="/launchpad/create"
            className="h-11 px-6 rounded-full border border-border text-foreground text-sm font-medium flex items-center justify-center transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto"
          >
            {t('cta.launchToken')}
          </Link>
          <Link
            to="/launchpad"
            className="h-11 px-6 rounded-full border border-border text-foreground text-sm font-medium flex items-center justify-center transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.03] active:scale-[0.97] w-full sm:w-auto"
          >
            {t('cta.exploreLaunchpad')}
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
