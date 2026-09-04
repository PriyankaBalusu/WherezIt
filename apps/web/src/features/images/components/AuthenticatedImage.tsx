import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { API_BASE_URL } from '../../../config/api';

interface AuthenticatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackText?: string;
  spinnerSize?: number;
}

export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  fallbackText = 'Image unavailable',
  spinnerSize = 16,
  style,
  className,
  onClick,
  ...props
}) => {
  const { getIdToken } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!src) {
      setIsError(true);
      setIsLoading(false);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    async function fetchImage() {
      try {
        setIsLoading(true);
        setIsError(false);

        // If it's already a data URI or blob URL, use directly
        if (src.startsWith('data:') || src.startsWith('blob:')) {
          if (active) {
            setBlobUrl(src);
            setIsLoading(false);
          }
          return;
        }

        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Prepend API origin if src is a relative path starting with /api
        let fetchUrl = src;
        if (src.startsWith('/') && !src.startsWith('http://') && !src.startsWith('https://')) {
          if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
            const apiOrigin = new URL(API_BASE_URL).origin;
            fetchUrl = `${apiOrigin}${src}`;
          }
        }

        const res = await fetch(fetchUrl, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load image: ${res.status}`);
        }

        const blob = await res.blob();
        if (active) {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (active) {
          setIsError(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchImage();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [src, getIdToken]);

  if (isLoading) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
          color: '#94a3b8',
          width: '100%',
          height: '100%',
          minHeight: '40px',
          borderRadius: 'inherit',
          ...style,
        }}
      >
        <div
          className="spinner"
          style={{
            width: `${spinnerSize}px`,
            height: `${spinnerSize}px`,
            border: '2px solid #cbd5e1',
            borderTopColor: '#0284c7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (isError || !blobUrl) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#64748b',
          fontSize: '0.75rem',
          padding: '0.25rem',
          textAlign: 'center',
          width: '100%',
          height: '100%',
          border: '1px dashed #cbd5e1',
          borderRadius: 'inherit',
          ...style,
        }}
        title={alt}
      >
        <span style={{ fontSize: '1rem', marginBottom: '0.125rem' }}>📷</span>
        <span style={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {fallbackText}
        </span>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      {...props}
    />
  );
};
