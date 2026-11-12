import { requireAuth } from '../../middleware/auth.js';
import { generateCharacterAttributes } from './character-generation.service.js';

export const handleCharacterGenerationRoute = (request, body) => {
  if (request.url.split('?')[0] !== '/api/character-generation/attributes') return null;
  if (request.method !== 'POST') {
    return { status: 404, body: { success: false, message: 'Rota não encontrada.' } };
  }
  if (!requireAuth(request)) {
    return { status: 401, body: { success: false, message: 'Não autorizado.' } };
  }
  return generateCharacterAttributes(body);
};
