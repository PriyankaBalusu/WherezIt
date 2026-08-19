import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1.5rem', backgroundColor: '#f7fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e0', margin: '1rem 0' }}>
      <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2d3748', marginBottom: '0.5rem' }}>{title}</h4>
      {description && <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1rem', maxWidth: '400px', margin: '0 auto 1rem auto' }}>{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
