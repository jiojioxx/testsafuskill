import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, Rocket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/store/auth.store';
import { useLaunchFourMeme } from '@/hooks/useLaunchFourMeme';
import type { TokenFormData } from '@/components/skills/InitialBuyModal';
import api from '@/lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  formData: TokenFormData;
  onSuccess: (tokenAddress: string, txHash: string) => void;
}

export default function FourMemeDeployModal({ isOpen, onClose, formData, onSuccess }: Props) {
  const { t } = useTranslation('launchpad');
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const targetChainId = 56;

  const { step, txHash, tokenAddress, error, launch, reset } = useLaunchFourMeme();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      reset();
    }
  }, [isOpen, reset]);

  useEffect(() => {
    if (step === 'success' && tokenAddress && txHash) {
      onSuccess(tokenAddress, txHash);
    }
  }, [step, tokenAddress, txHash, onSuccess]);

  const handleDeploy = async () => {
    if (!isConnected || !connectedAddress) return;

    if (user?.walletAddress && connectedAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
      showToast(t('create.toast.walletMismatch', {
        address: user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4),
      }), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { data: draft } = await api.post('/tokens', {
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        description: formData.description,
        skillId: formData.skillId,
        chainId: targetChainId,
        website: formData.website || undefined,
        twitter: formData.twitter || undefined,
        launchPlatform: 'FOURMEME',
      });

      await launch({
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        description: formData.description,
        imageFile: formData.imageFile,
        skillId: formData.skillId,
        website: formData.website,
        twitter: formData.twitter,
        draftId: draft.id,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.shortMessage || err?.message || t('create.toast.transactionFailed');
      showToast(msg, 'error');
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = submitting || (step !== 'idle' && step !== 'error' && step !== 'success');
  const isCorrectChain = chainId === targetChainId;

  const getStepLabel = () => {
    switch (step) {
      case 'signing': return t('create.fourmeme.signing');
      case 'uploading_image': return t('create.fourmeme.uploading');
      case 'getting_signature': return t('create.fourmeme.gettingSignature');
      case 'deploying': return t('create.fourmeme.deploying');
      case 'confirming': return t('create.fourmeme.confirming');
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {t('create.fourmeme.title')}
          </h2>
          {!isLoading && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          )}
        </div>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('create.fourmeme.tokenName')}</span>
            <span className="text-foreground font-medium">{formData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('create.fourmeme.symbol')}</span>
            <span className="text-foreground font-medium">${formData.symbol.toUpperCase()}</span>
          </div>
          {formData.skillName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('create.fourmeme.linkedSkill')}</span>
              <span className="text-foreground font-medium">{formData.skillName}</span>
            </div>
          )}
          <div className="border-t border-border my-1" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('create.fourmeme.platform')}</span>
            <span className="text-foreground font-medium">four.meme</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('create.fourmeme.target')}</span>
            <span className="text-foreground font-medium">24 BNB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('create.fourmeme.taxRate')}</span>
            <span className="text-foreground font-medium">1%</span>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{getStepLabel()}</span>
          </div>
        )}

        {error && step === 'error' && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          {!isLoading && (
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('create.fourmeme.back')}
            </button>
          )}
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  {t('detail.connectWallet')}
                </button>
              )}
            </ConnectButton.Custom>
          ) : !isCorrectChain ? (
            <button
              onClick={() => switchChain({ chainId: targetChainId })}
              className="flex-1 h-11 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('detail.switchChain', { chain: 'BNB Chain' })}
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={isLoading}
              className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {isLoading
                ? t('create.fourmeme.processing')
                : t('create.fourmeme.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
