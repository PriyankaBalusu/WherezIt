import React from 'react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load content',
  message = 'An unexpected issue occurred. Please check your connection and try again.',
  onRetry,
}) => {
  return (
    <div
      role="alert"
      style={{
        padding: '1.25rem',
        backgroundColor: '#fff5f5',
        border: '1px solid #feb2b2',
        borderRadius: '0.5rem',
        color: '#9b2c2c',
        margin: '1rem 0',
      }}
    >
      <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.375rem', marginTop: 0 }}>{title}</h4>
      <p style={{ fontSize: '0.875rem', marginBottom: onRetry ? '0.75rem' : 0 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '0.375rem 0.875rem',
            backgroundColor: '#c53030',
            color: '#fff',
            border: 'none',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
};
