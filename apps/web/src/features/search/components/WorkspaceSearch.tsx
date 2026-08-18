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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem', color: '#1a202c' }}>Workspace Inventory Search</h2>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
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
            border: '1px solid #cbd5e0',
            borderRadius: '0.375rem',
          }}
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            backgroundColor: !inputQuery.trim() || isLoading ? '#cbd5e0' : '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: !inputQuery.trim() || isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#4a5568' }}>
          Searching workspace inventory...
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div role="alert" style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          {error?.message || 'Search failed. Please try again.'}
        </div>
      )}

      {/* Results / Empty state */}
      {submitted && !isLoading && !isError && results && (
        <div>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096', backgroundColor: '#f7fafc', borderRadius: '0.375rem' }}>
              No inventory matching "{activeQuery}" was found.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {results.map((res, index) => (
                <div
                  key={res.itemId || `${res.containerId}-${index}`}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      {res.resultType === 'ITEM' ? (
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#2d3748' }}>
                          {res.itemName}
                        </h3>
                      ) : (
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#2b6cb0' }}>
                          Container {res.boxDisplayId}
                        </h3>
                      )}
                    </div>
                    <span
                      style={{
                        backgroundColor: res.resultType === 'ITEM' ? '#ebf8ff' : '#feebc8',
                        color: res.resultType === 'ITEM' ? '#2b6cb0' : '#744210',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {res.resultType}
                    </span>
                  </div>

                  {res.resultType === 'ITEM' && res.quantity != null && (
                    <div style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '0.5rem' }}>
                      Quantity: <strong>{res.quantity}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: '#4a5568', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #edf2f7' }}>
                    <div>
                      <span style={{ color: '#718096' }}>Container: </span>
                      <strong>{res.boxDisplayId}</strong>
                    </div>
                    {res.breadcrumbDisplay && (
                      <div>
                        <span style={{ color: '#718096' }}>Location: </span>
                        <strong>{res.breadcrumbDisplay}</strong>
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
