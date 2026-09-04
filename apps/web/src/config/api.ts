const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!rawApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not configured.');
}

if (
  import.meta.env.PROD &&
  /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(rawApiBaseUrl)
) {
  throw new Error(
    'Invalid production configuration: VITE_API_BASE_URL cannot point to localhost.'
  );
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
