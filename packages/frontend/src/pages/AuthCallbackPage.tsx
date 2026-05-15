import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';

export default function AuthCallbackPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setToken, fetchUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    const redirect = params.get('redirect') || localStorage.getItem('auth_redirect') || '/';
    localStorage.removeItem('auth_redirect');

    if (token) {
      setToken(token);
      fetchUser().then(() => navigate(redirect));
    } else {
      navigate('/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">{t('callback.authenticating')}</p>
    </div>
  );
}
