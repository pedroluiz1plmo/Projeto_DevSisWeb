import 'dotenv/config';
import http from 'node:http';
import { handleAuthRoute } from './routes/auth_routes.js';
import { handleUserRoute } from './routes/user_routes.js';
import { handleCampaignRoute } from './modules/campaigns/campaigns.routes.js';
import { handleFolderRoute } from './modules/folders/folders.routes.js';
import { handleSystemRoute } from './modules/rpg-systems/rpg-systems.routes.js';
import { handleCharactersRoute } from './modules/characters/characters.routes.js';
import { handleRecordRoute } from './modules/notes-missions/records.routes.js';
import { handleMonsterRoute } from './modules/monsters/monsters.routes.js';
import { handleAdminRoute } from './modules/admin/admin.routes.js';
import { requireAuth } from './middleware/auth.js';
import { pool } from './config/database.js';

const port = Number(process.env.PORT || 3000);

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Workspace-Type',
  });
  response.end(JSON.stringify(body));
};

class MalformedJsonError extends Error {
  constructor(message = 'JSON malformado ou inválido.') {
    super(message);
    this.name = 'MalformedJsonError';
    this.status = 400;
  }
}

class PayloadTooLargeError extends Error {
  constructor(message = 'Solicitação muito grande.') {
    super(message);
    this.name = 'PayloadTooLargeError';
    this.status = 413;
  }
}

const readBody = (request) => new Promise((resolve, reject) => {
  let raw = '';

  request.on('data', (chunk) => {
    raw += chunk;

    if (raw.length > 1e6) {
      reject(new PayloadTooLargeError());
    }
  });

  request.on('end', () => {
    try {
      resolve(raw ? JSON.parse(raw) : {});
    } catch {
      reject(new MalformedJsonError());
    }
  });

  request.on('error', reject);
});

http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    return sendJson(response, 204, {});
  }

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      body = await readBody(request);
    } catch (error) {
      if (error instanceof MalformedJsonError || error instanceof PayloadTooLargeError) {
        return sendJson(response, error.status, {
          success: false,
          message: error.message,
        });
      }
      return sendJson(response, 400, {
        success: false,
        message: 'Falha ao processar corpo da requisição.',
      });
    }
  }

  try {
    const token = requireAuth(request);
    if (token) {
      const activeUser = await pool.query('SELECT is_active FROM users WHERE id = $1', [token.sub]);
      if (!activeUser.rowCount || !activeUser.rows[0].is_active) {
        return sendJson(response, 401, { success: false, message: 'Sessão inválida ou conta bloqueada.' });
      }
    }

    let result = await handleAuthRoute(request, body);

    if (!result) {
      result = await handleAdminRoute(request, body);
    }
    if (!result) {
      result = await handleUserRoute(request, body);
    }
    if (!result) {
      result = await handleCampaignRoute(request, body);
    }
    if (!result) {
      result = await handleMonsterRoute(request, body);
    }
    if (!result) {
      result = await handleFolderRoute(request, body);
    }
    if (!result) {
      result = await handleRecordRoute(request, body);
    }
    if (!result) {
      result = await handleSystemRoute(request);
    }
    if (!result) {
      result = await handleCharactersRoute(request, body);
    }

    return result
      ? sendJson(response, result.status, result.body)
      : sendJson(response, 404, {
          success: false,
          message: 'Rota não encontrada.'
        });

  } catch (error) {
    console.error(error);

    if (!response.headersSent) {
      return sendJson(response, 500, {
        success: false,
        message: 'Não foi possível concluir a solicitação.'
      });
    }
  }
}).listen(port, () => {
  console.log(`API do RPG Manager em http://localhost:${port}`);
});
