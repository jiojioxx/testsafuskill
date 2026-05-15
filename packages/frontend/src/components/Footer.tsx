import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="px-4 sm:px-6 md:px-10 py-6 md:py-8 bg-[#0A0D10] border-t border-border">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8 md:gap-0">
        {/* Left — brand */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <img src="/goplus-gold.svg" alt="GoPlus" className="h-4" />
            <span className="text-sm font-semibold text-foreground">SafuSkill</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
            {t('footer.desc')}
          </p>
        </div>

        {/* Middle — internal links */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8 md:gap-16">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('footer.platform')}</span>
            <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.marketplace')}</Link>
            <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.documentation')}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('footer.legal')}</span>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.privacyPolicy')}</Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t('footer.termsOfService')}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t('footer.partners')}</span>
            <a href="https://gopluslabs.io/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              GoPlus Security <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://www.bnbchain.org/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              BNBChain <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        <span className="text-xs text-muted-foreground">{t('footer.copyright')}</span>
        <div className="flex items-center gap-4 flex-wrap">
          <a href="https://x.com/SafuSkill" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="w-3.5 h-3.5" /> @SafuSkill
          </a>
          <a href="https://x.com/goplussecurity" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="w-3.5 h-3.5" /> @GoPlusSecurity
          </a>
          <a href="https://x.com/BNBCHAIN" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <XIcon className="w-3.5 h-3.5" /> @BNBCHAIN
          </a>
          <span className="text-xs text-muted-foreground">{t('footer.builtOn')}</span>
        </div>
      </div>
    </footer>
  );
}
