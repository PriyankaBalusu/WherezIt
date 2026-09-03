import React from 'react';
import { BoxHistoryItem } from '../hooks/useBoxHistory';

interface RecentActivitySectionProps {
  title?: string;
  subtitle?: string;
  items: BoxHistoryItem[];
  isLoading: boolean;
  isError: boolean;
  onViewAll?: () => void;
  hasMore?: boolean;
  emptyText?: string;
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

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  title = 'Recent Activity',
  subtitle,
  items = [],
  isLoading,
  isError,
  onViewAll,
  hasMore = false,
  emptyText = 'No activity recorded yet.',
}) => {
  if (isLoading) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 700 }}>
          {title}
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading activity history...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 700 }}>
          {title}
        </h3>
        <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.875rem', margin: 0 }}>Failed to load history.</p>
      </div>
    );
  }

  const visibleItems = items.slice(0, 10);

  return (
    <div className="card box-history-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 700 }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {items.length > 0 && (
          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: '0.25rem', fontWeight: 600 }}>
            {items.length} {items.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-subtle)', borderRadius: '0.375rem', border: '1px dashed var(--color-border-strong)' }}>
          <h4 style={{ margin: '0 0 0.375rem 0', color: 'var(--color-text)', fontSize: '0.95rem' }}>{emptyText}</h4>
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
                {!isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '15px',
                      top: '30px',
                      bottom: '0',
                      width: '2px',
                      backgroundColor: 'var(--color-border)',
                      zIndex: 1,
                    }}
                  />
                )}

                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-strong)',
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
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(item.occurredAt)}
                    </span>
                  </div>

                  {item.description && (
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--color-text-muted)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {(hasMore || items.length >= 10) && onViewAll && (
            <div style={{ textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
              <button
                type="button"
                className="btn btn-secondary btn--sm"
                onClick={onViewAll}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}
              >
                View all activity →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
