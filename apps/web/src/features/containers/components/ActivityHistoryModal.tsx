import React from 'react';
import { BoxHistoryItem } from '../hooks/useBoxHistory';

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  items: BoxHistoryItem[];
  isLoading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
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

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  isOpen,
  onClose,
  title = 'Activity History',
  items = [],
  isLoading = false,
  onLoadMore,
  hasMore = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '550px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
            {title}
          </h3>
          <button
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: '#64748b', cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
              No activity recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {items.map((item, index) => {
                const icon = getEventIcon(item.activityType);
                const isLast = index === items.length - 1;

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

              {hasMore && onLoadMore && (
                <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn--sm"
                    disabled={isLoading}
                    onClick={onLoadMore}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}
                  >
                    {isLoading ? 'Loading...' : 'Load more history'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
