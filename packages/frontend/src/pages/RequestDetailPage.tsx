import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Github, CheckCircle, XCircle, Clock, ExternalLink, Star, Code2, Tag, User, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/components/Toast';
import api from '@/lib/api';

interface RequestDetail {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  reviewNote: string | null;
  skill: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    authorName: string | null;
    sourceRepo: string | null;
    repoUrl: string | null;
    authorAvatar: string | null;
    stars: number | null;
    language: string | null;
    category: string | null;
  };
  requester: {
    username: string;
    avatarUrl: string | null;
    walletAddress: string | null;
  };
}

export default function RequestDetailPage() {
  const { t } = useTranslation('dashboard');
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuthStore();
  const { showToast } = useToast();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/launch-requests/${id}/public`)
      .then((res) => setRequest(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Request not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleVerifyApprove = async () => {
    if (!token || !user?.githubId) {
      localStorage.setItem('auth_redirect', window.location.pathname);
      const apiBase = import.meta.env.VITE_API_URL || '';
      window.location.href = `${apiBase}/auth/github`;
      return;
    }

    // ZIP upload: check if user is the uploader
    if (!request?.skill.sourceRepo) {
      if (user.id !== request?.skill.userId) {
        showToast(t('requestDetail.notSkillOwner'));
        return;
      }
    } else {
      // GitHub URL upload: check if user's GitHub matches authorName
      const isAuthorMatch = !!(user?.githubLogin && request?.skill.authorName &&
        user.githubLogin.toLowerCase() === request.skill.authorName.toLowerCase());
      if (!isAuthorMatch) {
        showToast(t('requestDetail.accountMismatch', { username: user.githubLogin || user.username, authorName: request?.skill.authorName }));
        return;
      }
    }

    setApproving(true);
    try {
      await api.put(`/launch-requests/${id}/verify-approve`);
      setRequest((prev) => prev ? { ...prev, status: 'APPROVED' } : prev);
      setActionResult({ type: 'success', message: t('requestDetail.approvedMsg') });
    } catch (err: any) {
      setActionResult({ type: 'error', message: err.response?.data?.message || t('requestDetail.approveFailed') });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setApproving(true);
    try {
      await api.put(`/launch-requests/${id}/reject`, { reviewNote: 'Rejected by author' });
      setRequest((prev) => prev ? { ...prev, status: 'REJECTED' } : prev);
      setActionResult({ type: 'success', message: t('requestDetail.rejectedMsg') });
    } catch (err: any) {
      setActionResult({ type: 'error', message: err.response?.data?.message || t('requestDetail.rejectFailed') });
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">{t('requestDetail.notFound')}</h2>
          <p className="text-muted-foreground mb-6">{error || t('requestDetail.notFoundDesc')}</p>
          <Link to="/" className="text-primary hover:underline">{t('requestDetail.goHome')}</Link>
        </div>
      </div>
    );
  }

  const isPending = request.status === 'PENDING';
  const isAuthor = !!(user?.githubLogin && request.skill.authorName &&
    user.githubLogin.toLowerCase() === request.skill.authorName.toLowerCase());
  const canApprove = isPending && token && user?.githubId && isAuthor;

  const statusConfig = {
    PENDING: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', label: t('requestDetail.pendingReview') },
    APPROVED: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30', label: t('requestDetail.approved') },
    REJECTED: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', label: t('requestDetail.rejected') },
    USED: { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/30', label: t('requestDetail.used') },
  };

  const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('requestDetail.backToSafuSkill')}
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('requestDetail.title')}</h1>
          <p className="text-muted-foreground">
            {t('requestDetail.subtitle')}
          </p>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border ${status.bg} mb-8`}>
          <StatusIcon className={`w-5 h-5 ${status.color}`} />
          <span className={`font-semibold ${status.color}`}>{status.label}</span>
        </div>

        {/* Skill Card */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-6">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('requestDetail.yourProject')}</div>
          <div className="flex items-start gap-4">
            {request.skill.authorAvatar ? (
              <img src={request.skill.authorAvatar} alt="" className="w-12 h-12 rounded-xl" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Code2 className="w-6 h-6 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-foreground">{request.skill.name}</h3>
              {request.skill.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{request.skill.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-muted-foreground">
                {request.skill.authorName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> {request.skill.authorName}
                  </span>
                )}
                {request.skill.sourceRepo && (
                  <a
                    href={`https://github.com/${request.skill.sourceRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Github className="w-3.5 h-3.5" /> {request.skill.sourceRepo}
                  </a>
                )}
                {request.skill.stars != null && request.skill.stars > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" /> {request.skill.stars}
                  </span>
                )}
                {request.skill.language && (
                  <span className="flex items-center gap-1">
                    <Code2 className="w-3.5 h-3.5" /> {request.skill.language}
                  </span>
                )}
                {request.skill.category && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> {request.skill.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 mb-6">
          <div className="text-xs font-medium text-primary uppercase tracking-wider mb-4">{t('requestDetail.howItWorks')}</div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
              <span>{t('requestDetail.step1')}</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
              <span>{t('requestDetail.step2')}</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
              <span>{t('requestDetail.step3')}</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">4</span>
              <span>{t('requestDetail.step4')}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-primary/10">
            {t('requestDetail.flywheelNote')}
          </p>
        </div>

        {/* Proposed By */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-6">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{t('requestDetail.proposedBy')}</div>
          <div className="flex items-center gap-3">
            {request.requester.avatarUrl ? (
              <img src={request.requester.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="font-medium text-foreground">{request.requester.username}</div>
              {request.requester.walletAddress && (
                <div className="text-xs text-muted-foreground font-mono">
                  {request.requester.walletAddress.slice(0, 6)}...{request.requester.walletAddress.slice(-4)}
                </div>
              )}
            </div>
          </div>
          {request.message && (
            <div className="mt-4 p-3 rounded-lg bg-secondary/50 text-sm text-foreground">
              "{request.message}"
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Action Result */}
        {actionResult && (
          <div className={`rounded-xl border p-4 mb-6 ${actionResult.type === 'success' ? 'bg-green-400/10 border-green-400/30 text-green-400' : 'bg-red-400/10 border-red-400/30 text-red-400'}`}>
            {actionResult.message}
          </div>
        )}

        {/* Action Buttons */}
        {isPending && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('requestDetail.authorVerification')}
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {t('requestDetail.authorVerificationDesc')}
            </p>

            {!token || !user?.githubId ? (
              <button
                onClick={() => {
                  localStorage.setItem('auth_redirect', window.location.pathname);
                  window.location.href = '/login';
                }}
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#24292e] text-white font-medium hover:bg-[#2f363d] transition-colors cursor-pointer"
              >
                {t('requestDetail.signInGithub')}
              </button>
            ) : !isAuthor ? (
              <div className="p-4 rounded-xl bg-red-400/10 border border-red-400/30 text-sm text-red-400">
                {t('requestDetail.accountMismatch', { username: user.username, authorName: request.skill.authorName })}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleVerifyApprove}
                  disabled={approving}
                  className="flex-1 h-12 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {approving ? t('requestDetail.processing') : t('requestDetail.approve')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={approving}
                  className="flex-1 h-12 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  {t('requestDetail.reject')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rejected note */}
        {request.status === 'REJECTED' && request.reviewNote && (
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('requestDetail.reviewNote')}</div>
            <p className="text-sm text-foreground">{request.reviewNote}</p>
          </div>
        )}

        {/* Approved — link to create token */}
        {request.status === 'APPROVED' && (
          <div className="rounded-2xl border border-green-400/30 bg-green-400/5 p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">{t('requestDetail.proposalApproved')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('requestDetail.proposalApprovedDesc')}</p>
            <Link
              to={`/launchpad/create?skillId=${request.skill.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              {t('requestDetail.activate')} <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
