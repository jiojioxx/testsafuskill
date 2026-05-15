import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useSignMessage, useDisconnect, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { SiweMessage } from 'siwe';
import { Mail, Github, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { setToken, fetchUser, user, token } = useAuthStore();
  const [tab, setTab] = useState<'email' | 'wallet'>('email');
  const [walletTabActive, setWalletTabActive] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email) { showToast(t('login.enterEmail')); return; }
    setSendingCode(true);
    try {
      await api.post('/auth/send-code', { email });
      setCodeSent(true);
      setCountdown(60);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 429) {
        showToast(err.response?.data?.message || t('login.rateLimitTooMany'), 'error');
      } else {
        showToast(err.response?.data?.message || t('login.sendCodeFailed'), 'error');
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) { await handleSendCode(); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-code', {
        email,
        code: verificationCode,
        username: username || email.split('@')[0],
      });
      setToken(data.access_token);
      await fetchUser();
      navigate('/');
    } catch (err: any) {
      showToast(err.response?.data?.message || t('login.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignAndLogin = async (walletAddress: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const { data: nonceData } = await api.get(`/auth/wallet/nonce?address=${walletAddress}`);
      const effectiveChainId = chainId || 56;
      const message = new SiweMessage({
        domain: window.location.host,
        address: walletAddress,
        statement: t('login.siweStatement'),
        uri: window.location.origin,
        version: '1',
        chainId: effectiveChainId,
        nonce: nonceData.nonce,
      });
      const messageStr = message.prepareMessage();
      const signature = await signMessageAsync({ message: messageStr });
      const { data } = await api.post('/auth/wallet/login', { address: walletAddress, message: messageStr, signature });
      setToken(data.access_token);
      await fetchUser();
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('[WalletLogin] Error:', err);
      setWalletTabActive(false);
      disconnect();
      showToast(err.response?.data?.message || err.message || t('login.walletLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isConnected && address && walletTabActive && !loading) {
      handleSignAndLogin(address);
    }
  }, [isConnected, address, walletTabActive]);

  const handleGithubLogin = () => {
    setGithubLoading(true);
    window.location.href = '/api/auth/github';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-8">
        {/* Close button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <img src="/goplus-gold.svg" alt="GoPlus" className="h-6" />
            <span className="text-2xl font-bold text-foreground">SafuSkill</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-full bg-secondary p-1 mb-6">
          <button
            onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <Mail className="w-4 h-4" />
            {t('login.emailTab')}
          </button>
          <button
            onClick={() => { setTab('wallet'); setWalletTabActive(true); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === 'wallet' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM2 8h16V6H2v2zm2 4h1v1H4v-1z" clipRule="evenodd" />
            </svg>
            {t('login.walletTab')}
          </button>
        </div>

        {tab === 'email' && (
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              required
            />
            {codeSent && (
              <>
                <input
                  type="text"
                  placeholder={t('login.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('login.codePlaceholder')}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 h-11 px-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
                    required
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || sendingCode}
                    className="px-4 h-11 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                  >
                    {sendingCode ? '...' : countdown > 0 ? `${countdown}s` : t('login.resend')}
                  </button>
                </div>
              </>
            )}
            <button
              type="submit"
              disabled={loading || sendingCode || (codeSent && verificationCode.length !== 6)}
              className="h-11 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? t('login.verifying') : codeSent ? t('login.verifyLogin') : t('login.sendCode')}
            </button>
          </form>
        )}

        {tab === 'wallet' && (
          <div className="flex flex-col gap-3">
            {isConnected && loading ? (
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg bg-secondary">
                <span className="text-sm text-muted-foreground">{t('login.connected')}</span>
                <span className="text-xs font-mono text-foreground">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                <span className="text-sm text-primary">{t('login.signingMessage')}</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground text-center mb-2">{t('login.chooseWallet')}</p>
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading';
                    const connected =
                      ready &&
                      account &&
                      chain &&
                      (!authenticationStatus ||
                        authenticationStatus === 'authenticated');

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          'style': {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                disabled={loading}
                                className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zm14 5H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM2 8h16V6H2v2zm2 4h1v1H4v-1z" clipRule="evenodd" />
                                </svg>
                                {loading ? t('login.connecting') : t('login.connectWallet')}
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button
                                onClick={openChainModal}
                                className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-destructive text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                {t('login.wrongNetwork')}
                              </button>
                            );
                          }

                          return (
                            <div className="flex gap-2">
                              <button
                                onClick={openChainModal}
                                className="flex items-center gap-2 px-3 h-11 rounded-lg border border-border text-sm text-foreground hover:bg-secondary transition-colors"
                              >
                                {chain.hasIcon && (
                                  <div
                                    style={{
                                      background: chain.iconBackground,
                                      width: 12,
                                      height: 12,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      marginRight: 4,
                                    }}
                                  >
                                    {chain.iconUrl && (
                                      <img
                                        alt={chain.name ?? 'Chain icon'}
                                        src={chain.iconUrl}
                                        style={{ width: 12, height: 12 }}
                                      />
                                    )}
                                  </div>
                                )}
                                {chain.name}
                              </button>

                              <button
                                onClick={openAccountModal}
                                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                              >
                                {account.displayName}
                                {account.displayBalance
                                  ? ` (${account.displayBalance})`
                                  : ''}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            )}
          </div>
        )}

        {/* GitHub — only on email tab */}
        {tab === 'email' && (
          <div className="mt-4">
            <button
              onClick={handleGithubLogin}
              disabled={githubLoading}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
            >
              <Github className="w-5 h-5" />
              {githubLoading ? t('login.githubConnecting') : t('login.githubContinue')}
            </button>
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">
          {tab === 'email' ? t('login.emailHint') : t('login.walletHint')}
        </p>
      </div>
    </div>
  );
}
