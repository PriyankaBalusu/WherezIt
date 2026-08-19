import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { resolveContainerIdentifier, ResolvedContainerResponse } from '../api/identifierApi';

export const ScanResolverScreen: React.FC = () => {
  const { tokenValue } = useParams<{ tokenValue: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [resolved, setResolved] = useState<ResolvedContainerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Unauthenticated scan flow: store return path safely if relative scan route
      const currentPath = `/scan/${tokenValue || ''}`;
      if (currentPath.startsWith('/scan/')) {
        sessionStorage.setItem('returnPath', currentPath);
      }
      navigate('/login');
      return;
    }

    if (!tokenValue) {
      setError('Invalid scan link.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadResolvedContainer() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await resolveContainerIdentifier(tokenValue!);
        if (isMounted) {
          setResolved(data);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Container not found or unavailable.');
          setIsLoading(false);
        }
      }
    }

    loadResolvedContainer();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading, tokenValue, navigate]);

  if (authLoading || isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#4a5568' }}>
        Resolving scanned container...
      </div>
    );
  }

  if (error || !resolved) {
    return (
      <div style={{ maxWidth: '500px', margin: '3rem auto', padding: '1.5rem', backgroundColor: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '0.5rem', textAlign: 'center' }}>
        <h3 style={{ color: '#c53030', marginTop: 0 }}>Container Unavailable</h3>
        <p style={{ color: '#4a5568', marginBottom: '1.5rem' }}>
          {error || 'Container not found or unavailable.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/workspaces')}
          style={{ padding: '0.5rem 1rem', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '0.25rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Go to Workspaces
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3182ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Scanned Label Identity
          </div>
          <h2 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.75rem', color: '#1a202c' }}>
            {resolved.boxDisplayId}
          </h2>
          <div style={{ color: '#4a5568', fontSize: '0.95rem' }}>
            📍 <strong>Location:</strong> {resolved.breadcrumbDisplay}
          </div>
        </div>

        <h3 style={{ fontSize: '1.1rem', color: '#2d3748', marginTop: 0, marginBottom: '0.75rem' }}>
          Container Inventory ({resolved.items.length})
        </h3>

        {resolved.items.length === 0 ? (
          <div style={{ padding: '1.5rem', backgroundColor: '#f7fafc', borderRadius: '0.375rem', textAlign: 'center', color: '#a0aec0' }}>
            This container is currently empty.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {resolved.items.map((item) => (
              <div
                key={item.itemId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f7fafc',
                  border: '1px solid #edf2f7',
                  borderRadius: '0.375rem',
                }}
              >
                <span style={{ fontWeight: 600, color: '#2d3748' }}>{item.name}</span>
                <span style={{ backgroundColor: '#e2e8f0', color: '#4a5568', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.85rem', fontWeight: 700 }}>
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #edf2f7', paddingTop: '1rem' }}>
          <button
            type="button"
            onClick={() => navigate(`/workspaces/${encodeURIComponent(resolved.workspaceId)}/containers`)}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#2b6cb0', color: '#fff', border: 'none', borderRadius: '0.25rem', fontWeight: 600, cursor: 'pointer' }}
          >
            View Container Details
          </button>
        </div>
      </div>
    </div>
  );
};
