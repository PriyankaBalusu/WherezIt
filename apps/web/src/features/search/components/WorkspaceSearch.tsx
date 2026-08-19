import React, { useState } from 'react';
import { useWorkspaceSearch } from '../hooks/useSearch';

interface WorkspaceSearchProps {
  workspaceId: string;
}

export const WorkspaceSearch: React.FC<WorkspaceSearchProps> = ({ workspaceId }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: results, isLoading, isError, error } = useWorkspaceSearch(
    workspaceId,
    activeQuery,
    submitted && Boolean(activeQuery)
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputQuery.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
    setSubmitted(true);
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem', color: '#0f172a', fontSize: '1.75rem', fontWeight: 800 }}>
        Workspace Inventory Search
      </h2>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem' }}>
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          maxLength={100}
          placeholder="Search items (e.g., Christmas lights) or BOX (e.g., BOX 012)..."
          aria-label="Search query"
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            fontSize: '1rem',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            backgroundColor: '#ffffff',
            color: '#0f172a',
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!inputQuery.trim() || isLoading}
          style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          Searching workspace inventory...
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div role="alert" style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
          {error?.message || 'Search failed. Please try again.'}
        </div>
      )}

      {/* Results / Empty state */}
      {submitted && !isLoading && !isError && results && (
        <div>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
              No inventory matching "{activeQuery}" was found. Check your search terms or verify container contents.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {results.map((res, index) => (
                <div
                  key={res.itemId || `${res.containerId}-${index}`}
                  className="card"
                  style={{
                    backgroundColor: '#ffffff',
                    borderLeft: res.resultType === 'ITEM' ? '4px solid #0284c7' : '4px solid #f59e0b',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      {res.resultType === 'ITEM' ? (
                        <h3 style={{ margin: 0, fontSize: '1.375rem', color: '#0f172a', fontWeight: 800 }}>
                          {res.itemName}
                        </h3>
                      ) : (
                        <h3 style={{ margin: 0, fontSize: '1.375rem', color: '#0f172a', fontWeight: 800 }}>
                          Container {res.boxDisplayId}
                        </h3>
                      )}
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: res.resultType === 'ITEM' ? '#e0f2fe' : '#fef3c7',
                        color: res.resultType === 'ITEM' ? '#0369a1' : '#d97706',
                        border: res.resultType === 'ITEM' ? '1px solid rgba(2, 132, 199, 0.2)' : '1px solid rgba(217, 119, 6, 0.2)',
                      }}
                    >
                      {res.resultType}
                    </span>
                  </div>

                  {res.resultType === 'ITEM' && res.quantity != null && (
                    <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem' }}>
                      Quantity: <strong>{res.quantity}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: '#334155', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ color: '#64748b' }}>Container:</span>
                      <span className="badge badge-boxid">{res.boxDisplayId}</span>
                    </div>
                    {res.breadcrumbDisplay && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ color: '#64748b' }}>Location:</span>
                        <strong style={{ color: '#d97706' }}>{res.breadcrumbDisplay}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
