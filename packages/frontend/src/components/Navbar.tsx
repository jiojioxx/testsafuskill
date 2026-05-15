import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, User, Wallet, Menu, X, Bell, Globe } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useDisconnect, useAccount } from 'wagmi';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import WalletBindingModal from '@/components/WalletBindingModal';

const navLinks = [
  { labelKey: 'nav.marketplace', path: '/marketplace' },
  { labelKey: 'nav.launchpad', path: '/launchpad' },
  { labelKey: 'nav.docs', path: '/docs' },
  { labelKey: 'nav.developers', path: '/dashboard' },
];

function truncateAddress(name: string) {
  if (name.length <= 12) return name;
  return name.slice(0, 6) + '...' + name.slice(-4);
}

function formatWalletAddress(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = languages.find((l) => i18n.language?.startsWith(l.code.split('-')[0])) || languages[0];

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
        className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-full border border-border hover:bg-secondary transition-colors flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLang.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 sm:top-12 z-50 min-w-[140px] rounded-xl bg-card border border-border shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3.5 py-2 text-sm transition-colors ${
                currentLang.code === lang.code
                  ? 'text-primary font-medium bg-primary/5'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              {lang.label}
              {currentLang.code === lang.code && <span className="text-primary text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ username, walletAddress, onLogout, onBindWallet }: { username: string; walletAddress?: string; onLogout: () => void; onBindWallet: () => void }) {
  const displayName = walletAddress ? formatWalletAddress(walletAddress) : truncateAddress(username);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

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
        className="flex items-center gap-1.5 sm:gap-2.5 h-9 sm:h-10 pl-1.5 pr-2 sm:pr-3 rounded-full bg-secondary border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
          {walletAddress ? <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-foreground" /> : <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary-foreground" />}
        </div>
        <span className="text-sm font-medium text-foreground hidden sm:inline">{displayName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 sm:top-12 z-50 min-w-[200px] rounded-xl bg-card border border-border shadow-lg py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-2.5 border-b border-border">
            {walletAddress ? (
              <button
                onClick={() => navigator.clipboard.writeText(walletAddress)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                title={t('navbar.copyAddress')}
              >
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono">{formatWalletAddress(walletAddress)}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{username}</span>
              </div>
            )}
          </div>
          {!walletAddress && (
            <button
              onClick={() => { setOpen(false); onBindWallet(); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {t('navbar.connectWallet')}
            </button>
          )}
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <User className="w-4 h-4 text-muted-foreground" />
            {t('navbar.mySkills')}
          </Link>
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t('navbar.disconnect')}
          </button>
        </div>
      )}
    </div>
  );
}

function NotificationBell() {
  const [count, setCount] = useState(0);
  const { token } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (!token) return;
    api.get('/launch-requests/pending/count')
      .then((res) => setCount(res.data.count || 0))
      .catch(() => {});
  }, [token]);

  return (
    <div className="relative">
      <Link
        to="/dashboard/requests"
        className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
        title={t('navbar.incentiveProposals')}
      >
        <Bell className="w-4.5 h-4.5 text-muted-foreground" />
      </Link>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10 pointer-events-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { disconnect } = useDisconnect();
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { t } = useTranslation();

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try {
      if (isConnected && disconnect) {
        disconnect();
      }
      await new Promise((r) => setTimeout(r, 100));
      logout();
    } catch (error) {
      console.error('Error during logout/disconnect:', error);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      <nav className="h-14 md:h-16 flex items-center justify-between px-4 md:px-10 border-b border-border bg-background fixed top-0 left-0 right-0 z-50 overflow-visible">
        {/* Left */}
        <div className="flex items-center gap-4 md:gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src="/goplus-gold.svg" alt="GoPlus" className="h-5" />
            <span className="text-lg md:text-[22px] font-bold text-foreground">SafuSkill</span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path ||
                (link.path === '/marketplace' && location.pathname.startsWith('/skills')) ||
                (link.path === '/launchpad' && location.pathname.startsWith('/launchpad'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`text-[15px] transition-colors ${
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground font-medium'
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 md:gap-3 overflow-visible">
          <LanguageSwitcher />
          {user ? (
            <>  
              <NotificationBell />
              <UserMenu 
                username={user.username} 
                walletAddress={user.walletAddress} 
                onLogout={handleLogout} 
                onBindWallet={() => setShowWalletModal(true)}
              />
            </>
          ) : (
            <Link
              to="/login"
              className="h-9 md:h-10 px-3 md:px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              {t('navbar.getStarted')}
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 top-14 z-40 bg-background md:hidden">
          <div className="flex flex-col gap-1 p-4">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path ||
                (link.path === '/marketplace' && location.pathname.startsWith('/skills')) ||
                (link.path === '/launchpad' && location.pathname.startsWith('/launchpad'));
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center h-12 px-4 rounded-lg text-base font-medium transition-colors ${
                    isActive ? 'text-primary bg-primary/10' : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <WalletBindingModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onSuccess={() => setShowWalletModal(false)}
      />
    </>
  );
}
