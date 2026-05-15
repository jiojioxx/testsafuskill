import { Link } from 'react-router-dom';
import { ExternalLink, Rocket, ShieldCheck, User, Github, Star, Download, Code, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  description?: string;
  authorName?: string;
  repoUrl?: string;
  sourceRepo?: string;
  userId?: string;
  downloadCount?: number;
  language?: string;
  stars?: number;
  platforms?: string;
  category?: string;
  authorClaim?: AuthorClaim | null;
}

interface Props {
  skill: Skill;
  authorClaim?: AuthorClaim | null;
}

export default function TokenSkillCard({ skill, authorClaim }: Props) {
  const { t } = useTranslation('launchpad');

  return (
    <div className="flex flex-col p-5 rounded-lg border border-border bg-card flex-1">
      <Link
        to={`/skills/${skill.id}`}
        className="flex items-center gap-4 hover:opacity-80 transition-opacity group"
      >
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Rocket className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('detail.linkedSkill')}</span>
            {authorClaim?.status === 'VERIFIED' && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] font-medium">
                <ShieldCheck className="w-3 h-3" /> {t('detail.verified')}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {skill.name}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors" />
      </Link>

      {skill.description && (
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed whitespace-pre-line">{skill.description}</p>
      )}

      {skill.sourceRepo && (
        <div className="mt-4 p-3 rounded-md bg-background/50 border border-border">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('detail.install')}</span>
          <p className="text-sm font-mono text-foreground mt-1.5 select-all">
            &gt; {t('detail.installCommand', { skillName: skill.name, sourceRepo: skill.sourceRepo })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-4 pt-4 border-t border-border text-sm">
        {skill.authorName && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">{skill.authorName}</span>
          </div>
        )}
        {skill.repoUrl && (
          <a
            href={skill.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Github className="w-4 h-4 shrink-0" />
            <span className="truncate">{skill.sourceRepo || 'GitHub'}</span>
          </a>
        )}
        {(skill.stars ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star className="w-4 h-4 shrink-0" />
            <span>{skill.stars} {t('detail.stars')}</span>
          </div>
        )}
        {(skill.downloadCount ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Download className="w-4 h-4 shrink-0" />
            <span>{skill.downloadCount! >= 1000 ? `${(skill.downloadCount! / 1000).toFixed(1)}K` : skill.downloadCount} {t('detail.downloads')}</span>
          </div>
        )}
        {skill.language && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Code className="w-4 h-4 shrink-0" />
            <span>{skill.language}</span>
          </div>
        )}
        {skill.category && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="w-4 h-4 shrink-0" />
            <span>{skill.category}</span>
          </div>
        )}
        {skill.platforms && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{skill.platforms}</span>
          </div>
        )}
      </div>
    </div>
  );
}
