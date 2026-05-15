import { useState, useEffect } from 'react';
import { Wallet, X, Loader2 } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';

interface WalletBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  required?: boolean;
}

export default function WalletBindingModal({ isOpen, onClose, onSuccess, required = false }: WalletBindingModalProps) {
  const { t } = useTranslation('components');
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { fetchUser } = useAuthStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!required && isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, required, onClose]);

  const handleBind = async () => {
    if (!address || !isConnected) {
      showToast(t('walletBinding.connectWalletFirst'));
      return;
    }

    setLoading(true);

    try {
      const { data: checkData } = await api.get(`/auth/wallet/check?address=${address}`);
      if (checkData.exists) {
        disconnect();
        showToast(t('walletBinding.addressAlreadyRegistered'));
        setLoading(false);
        return;
      }

      await api.post('/auth/wallet/bind', { address });

      await fetchUser();
      onSuccess();
    } catch (err: any) {
      showToast(err.response?.data?.message || t('walletBinding.bindFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={required ? undefined : (e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {required ? t('walletBinding.titleRequired') : t('walletBinding.title')}
            </h2>
          </div>
          {!required && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-muted-foreground">
            {t('walletBinding.desc')}
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• {t('walletBinding.feature1')}</li>
            <li>• {t('walletBinding.feature2')}</li>
            <li>• {t('walletBinding.feature3')}</li>
            <li>• {t('walletBinding.feature4')}</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('walletBinding.connectFirst')}
              </p>
              <div className="flex justify-center">
                <ConnectButton.Custom>
                  {({ openConnectModal, mounted }) => (
                    <button
                      onClick={openConnectModal}
                      disabled={!mounted}
                      className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      {t('walletBinding.connectWallet')}
                    </button>
                  )}
                </ConnectButton.Custom>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('walletBinding.connectedWallet')}</div>
                    <div className="text-sm font-mono text-foreground">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={() => disconnect()}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    {t('walletBinding.disconnect')}
                  </button>
                </div>
              </div>

              <button
                onClick={handleBind}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('walletBinding.binding')}
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    {t('walletBinding.linkWallet')}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {t('walletBinding.requiredNote')}
        </p>
      </div>
    </div>
  );
}
