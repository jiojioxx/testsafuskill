import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function GitHubBindCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success) {
      setStatus('success');
      setMessage('GitHub bound successfully');
      setTimeout(() => window.close(), 1000);
    } else if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    } else {
      setStatus('error');
      setMessage('Unknown error');
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center">
        {status === 'loading' && <p className="text-sm text-muted-foreground">Binding GitHub...</p>}
        {status === 'success' && <p className="text-sm text-success">{message}</p>}
        {status === 'error' && (
          <>
            <p className="text-sm text-destructive">{message}</p>
            <button onClick={() => window.close()} className="mt-4 text-xs text-primary hover:underline">Close</button>
          </>
        )}
      </div>
    </div>
  );
}
