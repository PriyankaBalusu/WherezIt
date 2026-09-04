import React from 'react';
import { useWorkspaceAudits } from '../hooks/useWorkspaces';

interface WorkspaceActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkspaceActivityModal: React.FC<WorkspaceActivityModalProps> = ({ isOpen, onClose }) => {
  const { data: audits = [], isLoading, error } = useWorkspaceAudits();

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog modal-surface"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', width: '100%', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
      >
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>📋 Storage Space Activity</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: 'var(--color-text-muted, #64748b)', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto', padding: '1rem' }}>
          {isLoading && <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>Loading activity history...</p>}
          {error && <div className="auth-error">Failed to load activity history.</div>}

          {!isLoading && !error && audits.length === 0 && (
            <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
              No storage space activity events recorded yet.
            </p>
          )}

          {!isLoading && !error && audits.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {audits.map((audit) => {
                const formattedDate = new Date(audit.occurredAt).toLocaleString();

                let details: any = null;
                if (audit.detailsJson) {
                  try {
                    details = JSON.parse(audit.detailsJson);
                  } catch {
                    details = null;
                  }
                }

                const locName = details?.locationName || details?.LocationName || 'Location';
                const parentLocName = details?.parentLocationName || details?.ParentLocationName || null;
                const prevLocName = details?.previousLocationName || details?.PreviousLocationName || '';
                const newLocName = details?.newLocationName || details?.NewLocationName || '';
                const prevWsName = details?.previousWorkspaceName || details?.PreviousWorkspaceName || '';
                const newWsName = details?.newWorkspaceName || details?.NewWorkspaceName || audit.workspaceName;

                let badgeLabel = 'Event';
                let badgeBg = 'var(--color-bg-subtle, rgba(255, 255, 255, 0.05))';
                let badgeColor = 'var(--color-text-muted, #475569)';
                let title = audit.workspaceName;
                let subtitle: string | null = null;

                switch (audit.eventType) {
                  case 'WORKSPACE_CREATED':
                    badgeLabel = 'Created';
                    badgeBg = 'rgba(34, 197, 94, 0.15)';
                    badgeColor = '#22c55e';
                    title = `Storage Space created: ${audit.workspaceName}`;
                    break;
                  case 'WORKSPACE_RENAMED':
                    badgeLabel = 'Renamed';
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                    badgeColor = '#f59e0b';
                    title = `Storage Space renamed: ${prevWsName ? `${prevWsName} → ` : ''}${newWsName}`;
                    break;
                  case 'WORKSPACE_DELETED':
                    badgeLabel = 'Deleted';
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeColor = '#ef4444';
                    title = `Storage Space deleted: ${audit.workspaceName}`;
                    if (details) {
                      const locs = details.locationsCount ?? details.LocationsCount ?? 0;
                      const boxes = details.boxesCount ?? details.BoxesCount ?? 0;
                      const items = details.itemsCount ?? details.ItemsCount ?? 0;
                      subtitle = `Impacted: ${locs} locations, ${boxes} boxes, ${items} items`;
                    }
                    break;
                  case 'LOCATION_CREATED':
                    if (parentLocName) {
                      badgeLabel = 'Sub-location Added';
                      title = `Sub-location added: ${locName}`;
                      subtitle = `under ${parentLocName}`;
                    } else {
                      badgeLabel = 'Location Added';
                      title = `Location added: ${locName}`;
                    }
                    badgeBg = 'rgba(59, 130, 246, 0.15)';
                    badgeColor = '#3b82f6';
                    break;
                  case 'LOCATION_RENAMED':
                    if (parentLocName) {
                      badgeLabel = 'Sub-location Renamed';
                      title = `Sub-location renamed: ${prevLocName} → ${newLocName}`;
                      subtitle = `under ${parentLocName}`;
                    } else {
                      badgeLabel = 'Location Renamed';
                      title = `Location renamed: ${prevLocName} → ${newLocName}`;
                    }
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                    badgeColor = '#f59e0b';
                    break;
                  case 'LOCATION_DELETED':
                    if (parentLocName) {
                      badgeLabel = 'Sub-location Deleted';
                      title = `Sub-location deleted: ${locName}`;
                      subtitle = `under ${parentLocName}`;
                    } else {
                      badgeLabel = 'Location Deleted';
                      title = `Location deleted: ${locName}`;
                    }
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeColor = '#ef4444';
                    break;
                  default:
                    title = audit.eventType;
                    break;
                }

                return (
                  <li
                    key={audit.id}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          textTransform: 'uppercase',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {badgeLabel}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #64748b)' }}>{formattedDate}</span>
                    </div>

                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text, #0f172a)', marginTop: '0.25rem' }}>
                      {title}
                    </div>

                    {subtitle && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)', marginTop: '0.1rem' }}>
                        {subtitle}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
