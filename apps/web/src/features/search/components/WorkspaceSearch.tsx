import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGlobalSearch } from '../hooks/useSearch';
import { useWorkspaceContext } from '../../workspaces/context/WorkspaceContext';

interface WorkspaceSearchProps {
  initialQuery?: string;
}

type FilterType = 'ALL' | 'ITEM' | 'CONTAINER';

export const WorkspaceSearch: React.FC<WorkspaceSearchProps> = ({ initialQuery = '' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || initialQuery;
  const typeFromUrl = (searchParams.get('type') as FilterType) || 'ALL';
  const pageFromUrl = Number(searchParams.get('page')) || 1;
  const pageSizeFromUrl = Number(searchParams.get('pageSize')) || 10;

  const [inputQuery, setInputQuery] = useState(queryFromUrl);
  const [activeQuery, setActiveQuery] = useState(queryFromUrl);
  const [filterType, setFilterType] = useState<FilterType>(typeFromUrl);
  const [currentPage, setCurrentPage] = useState<number>(pageFromUrl);
  const [pageSize, setPageSize] = useState<number>(pageSizeFromUrl);
  const [submitted, setSubmitted] = useState(Boolean(queryFromUrl));

  const workspaceContext = useWorkspaceContext();

  useEffect(() => {
    if (queryFromUrl) {
      setInputQuery(queryFromUrl);
      setActiveQuery(queryFromUrl);
      setSubmitted(true);
    }
  }, [queryFromUrl]);

  const { data: results, isLoading, isError, error } = useGlobalSearch(
    activeQuery,
    submitted && Boolean(activeQuery)
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputQuery.trim();
    if (!trimmed) return;
    setActiveQuery(trimmed);
    setSubmitted(true);
    setFilterType('ALL');
    setCurrentPage(1);
    setSearchParams({ q: trimmed, type: 'ALL', page: '1', pageSize: String(pageSize) });
  };

  const [isListening, setIsListening] = useState(false);
  const [recognitionRef, setRecognitionRef] = useState<any>(null);
  const isSpeechSupported =
    typeof window !== 'undefined' &&
    (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

  const handleVoiceSearch = () => {
    if (isListening && recognitionRef) {
      try {
        recognitionRef.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
        setIsListening(false);
        setRecognitionRef(null);
      };
      recognition.onerror = () => {
        setIsListening(false);
        setRecognitionRef(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInputQuery(transcript);
        }
      };

      setRecognitionRef(recognition);
      recognition.start();
    } catch {
      setIsListening(false);
      setRecognitionRef(null);
    }
  };

  // Filtered & Paginated Results calculation
  const filteredResults = (results || []).filter((r) => {
    if (filterType === 'ITEM') return r.resultType === 'ITEM';
    if (filterType === 'CONTAINER') return r.resultType === 'CONTAINER';
    return true;
  });

  const totalCount = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ marginBottom: '0.25rem', color: '#0f172a', fontSize: '2rem', fontWeight: 800 }}>
        Where is it?
      </h1>
      <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.25rem' }}>
        Find anything you've stored.
      </p>

      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            maxLength={100}
            placeholder="Search items (e.g., Christmas lights) or BOX (e.g., BOX 012)..."
            aria-label="Search query"
            style={{
              width: '100%',
              padding: '0.75rem 2.5rem 0.75rem 1rem',
              fontSize: '1rem',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          />
          {isSpeechSupported && (
            <button
              type="button"
              onClick={handleVoiceSearch}
              style={{
                position: 'absolute',
                right: '0.5rem',
                backgroundColor: isListening ? '#ef4444' : 'transparent',
                color: isListening ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.25rem 0.5rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title={isListening ? 'Click to cancel voice input' : 'Voice search'}
            >
              🎙️ {isListening ? <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Listening... (Cancel)</span> : null}
            </button>
          )}
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={!inputQuery.trim() || isLoading}
          style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div style={{ marginTop: '-0.25rem', marginBottom: '1.25rem', fontSize: '0.825rem', color: '#64748b' }}>
        🔍 Searching all your Storage Spaces
      </div>

      {/* Results Toolbar (Count, Type Filter, Page Size) */}
      {submitted && !isLoading && !isError && results && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            {totalCount} {totalCount === 1 ? 'result' : 'results'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Result-Type Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <label htmlFor="search-type-filter" style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 600 }}>
                Filter:
              </label>
              <select
                id="search-type-filter"
                aria-label="Filter results by type"
                value={filterType}
                onChange={(e) => {
                  const newType = e.target.value as FilterType;
                  setFilterType(newType);
                  setCurrentPage(1);
                  setSearchParams({ q: activeQuery, type: newType, page: '1', pageSize: String(pageSize) });
                }}
                style={{
                  padding: '0.35rem 0.625rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Results</option>
                <option value="ITEM">Items Only</option>
                <option value="CONTAINER">Boxes Only</option>
              </select>
            </div>

            {/* Page Size Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <label htmlFor="search-page-size" style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 600 }}>
                Show:
              </label>
              <select
                id="search-page-size"
                aria-label="Results per page"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                  setSearchParams({ q: activeQuery, type: filterType, page: '1', pageSize: String(newSize) });
                }}
                style={{
                  padding: '0.35rem 0.625rem',
                  fontSize: '0.85rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.375rem',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                }}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
          Searching across authorized storage spaces...
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
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
                No results found for "{activeQuery}"
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                Try searching for another item name, category, location, or description.
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.1rem' }}>
                No {filterType === 'ITEM' ? 'item' : 'box'} results found for "{activeQuery}"
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn--md"
                onClick={() => {
                  setFilterType('ALL');
                  setCurrentPage(1);
                  setSearchParams({ q: activeQuery, type: 'ALL', page: '1', pageSize: String(pageSize) });
                }}
                style={{ marginTop: '0.75rem' }}
              >
                View All Results ({results.length})
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {paginatedResults.map((res, index) => (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.25rem', fontWeight: 700 }}>
                          🏠 {res.workspaceName}
                        </span>
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
                    </div>

                    {res.resultType === 'ITEM' && res.quantity != null && (
                      <div style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem' }}>
                        Quantity: <strong>{res.quantity}</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: '#334155', flexWrap: 'wrap', alignItems: 'center' }}>
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
                      <Link
                        to={`/workspaces/${res.workspaceId}/containers/${res.containerId}`}
                        onClick={() => {
                          if (workspaceContext && workspaceContext.activeWorkspace?.id !== res.workspaceId) {
                            workspaceContext.setActiveWorkspaceId(res.workspaceId);
                          }
                        }}
                        className="btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none' }}
                      >
                        Open Box →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                    Showing {startIndex}–{endIndex} of {totalCount}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => {
                        const prevPage = currentPage - 1;
                        setCurrentPage(prevPage);
                        setSearchParams({ q: activeQuery, type: filterType, page: String(prevPage), pageSize: String(pageSize) });
                      }}
                      className="btn btn-secondary btn--sm"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 600, padding: '0 0.35rem' }} aria-current="page">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        const nextPage = currentPage + 1;
                        setCurrentPage(nextPage);
                        setSearchParams({ q: activeQuery, type: filterType, page: String(nextPage), pageSize: String(pageSize) });
                      }}
                      className="btn btn-secondary btn--sm"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
