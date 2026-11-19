const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const defaultApiUrl = import.meta.env.DEV ? 'http://localhost:3000' : '';
const apiUrl = configuredApiUrl || defaultApiUrl;

if (!apiUrl) {
  throw new Error('Defina VITE_API_URL com a URL pública do backend.');
}

const parsedApiUrl = new URL(apiUrl);
if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) {
  throw new Error('VITE_API_URL deve usar HTTP ou HTTPS.');
}
if (import.meta.env.PROD) {
  const hostname = parsedApiUrl.hostname;
  const isLocalAddress = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '::1'
    || hostname === '[::1]'
    || hostname === '0.0.0.0'
    || hostname.startsWith('127.');

  if (parsedApiUrl.protocol !== 'https:') {
    throw new Error('VITE_API_URL deve usar HTTPS em produção.');
  }
  if (isLocalAddress) {
    throw new Error('VITE_API_URL não pode apontar para localhost em produção.');
  }
}

export const API_URL: string = apiUrl.replace(/\/+$/, '');

/**
 * URL base da API incluindo o prefixo /api.
 * Utilizado pelos serviços que fazem chamadas ao backend.
 */
export const API_BASE: string = `${API_URL}/api`;
