import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import TokenDetailPage from './TokenDetailPage';
import FourMemeTokenDetailPage from './FourMemeTokenDetailPage';

export default function LaunchpadDetailRouter() {
  const { t } = useTranslation('launchpad');
  const { id } = useParams<{ id: string }>();
  const [launch, setLaunch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/tokens/${id}`)
      .then(({ data }) => setLaunch(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('detail.loading')}
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">{t('detail.tokenNotFound')}</p>
        <Link to="/launchpad" className="text-primary hover:underline text-sm">{t('detail.backToLaunchpad')}</Link>
      </div>
    );
  }

  if (launch.launchPlatform === 'FOURMEME') {
    return <FourMemeTokenDetailPage launch={launch} onLaunchUpdate={setLaunch} />;
  }

  return <TokenDetailPage launch={launch} onLaunchUpdate={setLaunch} />;
}
