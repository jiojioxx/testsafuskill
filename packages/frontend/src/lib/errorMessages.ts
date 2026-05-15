export function mapErrorMessage(backendMessage: string, t: any, fallbackKey: string): string {
  const msg = backendMessage?.toLowerCase() || '';
  
  if (msg.includes('already been imported') || msg.includes('already exists')) return t('errors.alreadyImported');
  if (msg.includes('skill.md') && msg.includes('not found')) return t('errors.skillMdNotFound');
  if (msg.includes('unable to download')) return t('errors.downloadFailed');
  if (msg.includes('repository not found')) return t('errors.repoNotFound');
  if (msg.includes('access denied') || msg.includes('rate limit')) return t('errors.githubAccessDenied');
  if (msg.includes('invalid') && msg.includes('url')) return t('errors.invalidUrl');
  if (msg.includes('file too large')) return t('errors.fileTooLarge');
  if (msg.includes('invalid file type')) return t('errors.invalidFileType');
  if (msg.includes('temporarily unavailable')) return t('errors.temporarilyUnavailable');
  
  return backendMessage || t(fallbackKey);
}
