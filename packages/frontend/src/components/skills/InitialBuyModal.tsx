import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccount, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'viem';
import { useAuthStore } from '@/store/auth.store';
import { useLaunchToken } from '@/hooks/useLaunchToken';
import { useToast } from '@/components/Toast';
import WalletBindingModal from '@/components/WalletBindingModal';
import api from '@/lib/api';

// Flap 联合曲线参数（来自合约，用于前端估算，实际数量以合约为准）
// 公式：Δx = (x₀ + h) - K / (Δy + r)
// 其中 Δy = 输入 BNB，Δx = 获得 token 数量
const R = 6.14;           // 初始 BNB 储备
const H = 107036752;      // 偏移量（防止价格为 0）
const K = 6797205657.28;  // 常数乘积
const X0 = 1e9;           // 最大供应量 10 亿
const MAX_TOKENS = 8e8;   // 用户最多可买 8 亿（合约限制）

function calcTokenAmount(bnb: number): number {
  if (bnb <= 0) return 0;
  const delta = (X0 + H) - K / (bnb + R);
  return Math.max(0, Math.min(delta, MAX_TOKENS));
}

function ceilDisplay(value: number): string {
  if (value <= 0) return '0';
  const strip = (s: string) => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  if (value >= 1) {
    const d = 4;
    const factor = 10 ** d;
    return strip((Math.ceil(value * factor) / factor).toFixed(d));
  }
  const s = value.toFixed(18);
  const match = s.match(/^0\.(0*)([1-9]\d{0,3})/);
  if (!match) return strip(value.toFixed(8));
  const zeros = match[1].length;
  const digits = match[2];
  const d = zeros + digits.length;
  const factor = 10 ** d;
  return strip((Math.ceil(value * factor) / factor).toFixed(d));
}

export interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  skillId: string;
  website?: string;
  twitter?: string;
  skillName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  formData: TokenFormData;
  onSuccess: (tokenAddress: string, txHash: string) => void;
}

export default function InitialBuyModal({ isOpen, onClose, formData, onSuccess }: Props) {
  const { t } = useTranslation('launchpad');
  const { user } = useAuthStore();
  const { isConnected, address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { showToast } = useToast();
  const { step: launchStep, txHash, tokenAddress, error: launchError, launch, reset } = useLaunchToken();

  const [bnbInput, setBnbInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showWalletBinding, setShowWalletBinding] = useState(false);

  // 目标链：主网 56，测试网 97
  // 当前固定为主网，如需测试网支持可改为 97
  const targetChainId = 56;
  const isCorrectChain = chainId === targetChainId;

  const { data: balanceData } = useBalance({
    address: connectedAddress,
    query: { enabled: isConnected && !!connectedAddress },
  });

  const bnbBalance = balanceData ? parseFloat(formatEther(balanceData.value)) : 0;
  const bnbAmount = parseFloat(bnbInput) || 0;
  const estimatedTokens = calcTokenAmount(bnbAmount);
  const totalCost = bnbAmount;
  const insufficientBalance = isConnected && bnbBalance > 0 && totalCost > bnbBalance;

  useEffect(() => {
    if (launchStep === 'success' && tokenAddress) {
      onSuccess(tokenAddress, txHash || '');
    }
  }, [launchStep, tokenAddress, txHash, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setBnbInput('');
      setSubmitting(false);
      reset();
    }
  }, [isOpen, reset]);

  const handleCreate = async () => {
    if (!isConnected || !connectedAddress) return;

    // 校验连接的钱包是否与绑定钱包一致
    if (user?.walletAddress && connectedAddress.toLowerCase() !== user.walletAddress.toLowerCase()) {
      console.warn('[InitialBuyModal] Wallet mismatch, connected:', connectedAddress, 'bound:', user.walletAddress);
      showToast(t('create.toast.walletMismatch', {
        address: user.walletAddress.slice(0, 6) + '...' + user.walletAddress.slice(-4),
      }), 'error');
      return;
    }

    console.log('[InitialBuyModal] Creating token draft, skill:', formData.skillId, 'bnb:', bnbAmount);
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
      });

      console.log('[InitialBuyModal] Draft created, id:', draft.id, '— launching token...');
      await launch({
        name: formData.name,
        symbol: formData.symbol.toUpperCase(),
        description: formData.description,
        imageFile: formData.imageFile,
        skillId: formData.skillId,
        website: formData.website,
        twitter: formData.twitter,
        draftId: draft.id,
        initialBuyBnb: bnbAmount > 0 ? bnbAmount : undefined,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.shortMessage || err?.message || t('create.toast.transactionFailed');
      console.error('[InitialBuyModal] Launch error:', msg, err);
      showToast(msg, 'error');
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = submitting || (launchStep !== 'idle' && launchStep !== 'error' && launchStep !== 'success');

  const getStepLabel = () => {
    if (launchStep === 'uploading') return t('create.review.uploadingIPFS');
    if (launchStep === 'finding_salt') return t('create.review.computingAddress');
    if (launchStep === 'deploying') return t('create.initialBuy.deploying');
    if (launchStep === 'buying') return t('create.initialBuy.buying');
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={!isLoading ? onClose : undefined} />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">
            {t('create.initialBuy.title', { symbol: formData.symbol.toUpperCase() })}
          </h3>
          {!isLoading && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('create.initialBuy.desc', { symbol: formData.symbol.toUpperCase() })}
          </p>

          {isConnected && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {t('create.initialBuy.balance')}
              </span>
              <span className="font-medium text-foreground">{bnbBalance.toFixed(4)} BNB</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-3 h-11 rounded-lg bg-secondary border border-border">
              <input
                type="number"
                min="0"
                step="any"
                value={bnbInput}
                onChange={(e) => setBnbInput(e.target.value)}
                placeholder={t('create.initialBuy.inputPlaceholder')}
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1 min-w-0"
                disabled={isLoading}
              />
              <span className="text-sm font-medium text-primary ml-2">BNB</span>
            </div>
            {bnbAmount > 0 && (
              <p className="text-xs text-muted-foreground px-1">
                ≈ {t('create.initialBuy.willReceive', {
                  amount: estimatedTokens >= 1e8
                    ? (estimatedTokens / 1e8).toFixed(2) + t('create.initialBuy.unit100m')
                    : Math.floor(estimatedTokens).toLocaleString(),
                  symbol: formData.symbol.toUpperCase(),
                })}
              </p>
            )}
          </div>

          {insufficientBalance && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {t('detail.insufficientBalance')}
            </div>
          )}

          {launchError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {launchError}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground">
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              {getStepLabel()}
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground px-1 gap-2">
            <span className="truncate">{t('create.initialBuy.willPay', { amount: bnbAmount > 0 ? ceilDisplay(totalCost) : '0' })}</span>
          </div>

          {!user?.walletAddress ? (
            <button
              onClick={() => setShowWalletBinding(true)}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              {t('create.review.connectWallet')}
            </button>
          ) : !isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  onClick={openConnectModal}
                  disabled={!mounted}
                  className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {t('create.review.connectWallet')}
                </button>
              )}
            </ConnectButton.Custom>
          ) : !isCorrectChain ? (
            <button
              onClick={() => switchChain({ chainId: targetChainId })}
              className="w-full h-11 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:opacity-90"
            >
              {t('create.review.switchChain', { chain: 'BNB Chain' })}
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={isLoading || insufficientBalance}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('create.initialBuy.confirm')}
            </button>
          )}
        </div>
      </div>

      <WalletBindingModal
        isOpen={showWalletBinding}
        onClose={() => setShowWalletBinding(false)}
        onSuccess={() => setShowWalletBinding(false)}
        required={false}
      />
    </div>
  );
}
