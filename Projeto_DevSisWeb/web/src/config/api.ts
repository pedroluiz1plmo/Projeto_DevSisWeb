/**
 * URL base da API do backend.
 *
 * Em produção, utiliza a variável de ambiente VITE_API_URL definida na Vercel.
 * Em desenvolvimento local, utiliza http://localhost:3000 como padrão.
 */
const defaultApiUrl = import.meta.env.PROD
  ? 'https://projetodevsisweb-backend.vercel.app'
  : 'http://localhost:3000';

export const API_URL: string = import.meta.env.VITE_API_URL || defaultApiUrl;

/**
 * URL base da API incluindo o prefixo /api.
 * Utilizado pelos serviços que fazem chamadas ao backend.
 */
export const API_BASE: string = `${API_URL}/api`;
