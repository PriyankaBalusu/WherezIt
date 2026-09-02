import React, { useState } from 'react';
import { useBoxHistory, BoxHistoryItem } from '../hooks/useBoxHistory';

interface BoxHistoryTimelineProps {
  workspaceId: string;
  containerId: string;
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'CONTAINER_CREATED':
      return '📦';
    case 'CONTAINER_RENAMED':
      return '✏️';
    case 'CONTAINER_MOVED':
      return '📍';
    case 'TRANSFERRED_OUT':
    case 'TRANSFERRED_IN':
      return '🔄';
    case 'CONTAINER_PACKED':
    case 'CONTAINER_UNPACKED':
      return '📋';
    case 'CONTAINER_ARCHIVED':
    case 'CONTAINER_RESTORED':
      return '📥';
    case 'ITEM_ADDED':
      return '🏷️';
    case 'ITEM_UPDATED':
      return '✏️';
    case 'ITEM_ARCHIVED':
      return '📥';
    case 'ITEM_RESTORED':
      return '📂';
    case 'ITEM_REMOVED':
      return '🗑️';
    case 'PHOTO_ADDED':
    case 'PHOTO_REMOVED':
      return '📷';
    default:
      return '⏱️';
  }
};

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
};

export const BoxHistoryTimeline: React.FC<BoxHistoryTimelineProps> = ({
  workspaceId,
  containerId,
}) => {
  const { data: historyItems = [], isLoading, isError } = useBoxHistory(workspaceId, containerId);
  const [displayLimit, setDisplayLimit] = useState(5);

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
          Box History
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Loading activity history...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
          Box History
        </h3>
        <p style={{ color: '#dc2626', fontSize: '0.875rem', margin: 0 }}>Failed to load history.</p>
      </div>
    );
  }

  const visibleItems = historyItems.slice(0, displayLimit);
  const hasMore = historyItems.length > displayLimit;

  return (
    <div className="card box-history-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 700 }}>
            Box History
          </h3>
          <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Read-only timeline of activity for this box.
          </p>
        </div>
        {historyItems.length > 0 && (
          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '0.25rem', fontWeight: 600 }}>
            {historyItems.length} {historyItems.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {historyItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '0.375rem', border: '1px dashed #cbd5e1' }}>
          <h4 style={{ margin: '0 0 0.375rem 0', color: '#0f172a', fontSize: '0.95rem' }}>No history yet</h4>
          <p style={{ margin: 0, fontSize: '0.825rem' }}>Activity for this box will appear here as changes are made.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {visibleItems.map((item, index) => {
            const icon = getEventIcon(item.activityType);
            const isLast = index === visibleItems.length - 1;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '0.875rem',
                  position: 'relative',
                  paddingBottom: isLast ? '0' : '1.25rem',
                }}
              >
                {/* Vertical Connector Line */}
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '15px',
                      top: '30px',
                      bottom: '0',
                      width: '2px',
                      backgroundColor: '#e2e8f0',
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Event Icon Bubble */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    flexShrink: 0,
                    zIndex: 2,
                  }}
                >
                  {icon}
                </div>

                {/* Event Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatDate(item.occurredAt)}
                    </span>
                  </div>

                  {item.description && (
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#475569', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={() => setDisplayLimit((prev) => prev + 10)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}
              >
                Load more history ({historyItems.length - displayLimit} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
