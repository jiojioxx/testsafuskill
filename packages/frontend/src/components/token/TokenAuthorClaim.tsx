import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Info, Wallet, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface AuthorClaim {
  id: string;
  status: string;
  githubUsername: string;
  beneficiaryAddress?: string;
  verifiedAt?: string;
  user: { id: string; username: string; avatarUrl?: string };
}

interface Skill {
  id: string;
  name: string;
  sourceRepo?: string;
  authorClaim?: AuthorClaim | null;
}

interface Props {
  skill: Skill;
  authorClaim?: AuthorClaim | null;
  tokenAddress?: string;
  tokenLaunchId: string;
  bscscanBase: string;
  taxRate: number;
  mktBps: number;
  onClaimSuccess: () => void;
}

export default function TokenAuthorClaim({
  skill, authorClaim, tokenAddress, tokenLaunchId,
  bscscanBase, taxRate, mktBps, onClaimSuccess,
}: Props) {
  const { t } = useTranslation('launchpad');
  const { user: currentUser } = useAuthStore();
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [myDispute, setMyDispute] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    if (!tokenAddress || !currentUser) return;
    api.get('/author-disputes/check', { params: { tokenAddress } })
      .then(({ data }) => setMyDispute(data))
      .catch(() => {});
  }, [tokenAddress, currentUser]);

  const handleClaim = async () => {
    if (!skill?.id) return;
    setClaiming(true);
    setClaimError('');
    try {
      await api.post('/author-claims', { skillId: skill.id });
      onClaimSuccess();
    } catch (err: any) {
      setClaimError(err?.response?.data?.message || err?.message || t('detail.claimFailed'));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-3">
      {authorClaim?.status === 'VERIFIED' ? (
        <>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('detail.verifiedAuthor')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {authorClaim.user.avatarUrl && (
              <img src={authorClaim.user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
            )}
            <span className="text-sm font-medium text-foreground">{authorClaim.githubUsername}</span>
          </div>

          {taxRate > 0 && (
            <div className="flex flex-col gap-1 pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('detail.revenuePerTrade')}</span>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('detail.taxRate')}</span>
                <span className="text-foreground font-medium">{taxRate / 100}%</span>
              </div>
              {mktBps > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('detail.devFundShare')}</span>
                  <span className="text-foreground font-medium">70%</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1 pt-2 border-t border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('detail.beneficiaryWallet')}</span>
            {authorClaim.beneficiaryAddress ? (
              <a
                href={`${bscscanBase}/address/${authorClaim.beneficiaryAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline font-mono flex items-center gap-1"
              >
                <Wallet className="w-3 h-3" />
                {authorClaim.beneficiaryAddress.slice(0, 8)}...{authorClaim.beneficiaryAddress.slice(-6)}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">{t('detail.notSet')}</span>
            )}
          </div>
        </>
      ) : (
        <>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('detail.authorVerification')}</h3>
          {!skill.sourceRepo ? (
            myDispute?.status === 'PENDING' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">{t('detail.disputePendingTitle')}</span>
                </div>
                <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 flex gap-2">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-blue-400">{t('detail.disputePendingSubtitle')}</span>
                    <p className="text-xs text-muted-foreground">{t('detail.disputePendingDesc')}</p>
                  </div>
                </div>
              </div>
            ) : myDispute?.status === 'APPROVED' ? (
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-green-500">{t('detail.disputeApproved')}</span>
              </div>
            ) : myDispute?.status === 'REJECTED' ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-destructive">{t('detail.disputeRejected')}</p>
                <Link
                  to={`/dashboard/revenue?tab=discover&skillName=${encodeURIComponent(skill.name)}${tokenAddress ? `&tokenAddress=${tokenAddress}` : ''}`}
                  className="h-9 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3 h-3" />
                  {t('detail.reapply')}
                </Link>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t('detail.zipClaimDesc')}</p>
                <Link
                  to={`/dashboard/revenue?tab=discover&skillName=${encodeURIComponent(skill.name)}${tokenAddress ? `&tokenAddress=${tokenAddress}` : ''}`}
                  className="h-9 rounded-lg bg-green-500/10 text-green-500 text-xs font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-3 h-3" />
                  {t('detail.applyClaimAuthor')}
                </Link>
              </>
            )
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground/60">{t('detail.onlyAuthorCanVerify')}</p>
              <Link to={`/dashboard/revenue?tab=discover&skillName=${encodeURIComponent(skill.name)}${tokenAddress ? `&tokenAddress=${tokenAddress}` : ''}`} className="text-[10px] text-primary hover:underline">{t('detail.disputeClaim')}</Link>
            </>
          )}
          {claimError && (
            <p className="text-xs text-destructive">{claimError}</p>
          )}
        </>
      )}
    </div>
  );
}
