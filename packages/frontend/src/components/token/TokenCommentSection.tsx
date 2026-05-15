import { useState, useEffect } from 'react';
import { MessageCircle, Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

function timeAgo(date: string, t: (key: string, opts?: any) => string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return t('detail.time.justNow');
  if (s < 3600) return t('detail.time.mAgo', { count: Math.floor(s / 60) });
  if (s < 86400) return t('detail.time.hAgo', { count: Math.floor(s / 3600) });
  return t('detail.time.dAgo', { count: Math.floor(s / 86400) });
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string; walletAddress?: string };
}

interface Props {
  tokenLaunchId: string;
  isConnected: boolean;
  currentUser: { id: string; username: string } | null;
}

export default function TokenCommentSection({ tokenLaunchId, isConnected, currentUser }: Props) {
  const { t } = useTranslation('launchpad');
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentsTotal, setCommentsTotal] = useState(0);

  useEffect(() => {
    if (!tokenLaunchId) return;
    api.get(`/comments?tokenLaunchId=${tokenLaunchId}`)
      .then(({ data }) => { setComments(data.comments); setCommentsTotal(data.total); })
      .catch(() => {});
  }, [tokenLaunchId]);

  const handlePostComment = async () => {
    if (!commentText.trim() || !tokenLaunchId) return;
    setPostingComment(true);
    try {
      const { data } = await api.post('/comments', { tokenLaunchId, content: commentText.trim() });
      setComments((prev) => [data, ...prev]);
      setCommentsTotal((prev) => prev + 1);
      setCommentText('');
    } catch {
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-card flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t('detail.comments')}</h3>
        <span className="text-xs text-muted-foreground">({commentsTotal})</span>
      </div>

      {isConnected ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
            placeholder={t('detail.commentPlaceholder')}
            maxLength={1000}
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment || !commentText.trim()}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('detail.connectToComment')}</p>
      )}

      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">{t('detail.noComments')}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 py-2 border-b border-border last:border-0">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                {c.user.avatarUrl ? (
                  <img src={c.user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  c.user.username[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {c.user.walletAddress
                      ? `${c.user.walletAddress.slice(0, 6)}...${c.user.walletAddress.slice(-4)}`
                      : c.user.username}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt, t)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 break-words">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
