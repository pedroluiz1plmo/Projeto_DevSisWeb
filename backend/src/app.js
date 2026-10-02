import 'dotenv/config';
import http from 'node:http';
import { handleAuthRoute } from './routes/auth_routes.js';
import { handleUserRoute } from './routes/user_routes.js';

const port = Number(process.env.PORT || 3000);

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  response.end(JSON.stringify(body));
};

const readBody = (request) => new Promise((resolve, reject) => {
  let raw = '';

  request.on('data', (chunk) => {
    raw += chunk;

    if (raw.length > 1e6) {
      reject(new Error('Solicitação muito grande.'));
    }
  });

  request.on('end', () => {
    try {
      resolve(raw ? JSON.parse(raw) : {});
    } catch {
      reject(new Error('JSON inválido.'));
    }
  });

  request.on('error', reject);
});

http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    return sendJson(response, 204, {});
  }

  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
      ? await readBody(request)
      : {};

    let result = await handleAuthRoute(request, body);

    if (!result) {
      result = await handleUserRoute(request, body);
    }

    return result
      ? sendJson(response, result.status, result.body)
      : sendJson(response, 404, {
          success: false,
          message: 'Rota não encontrada.'
        });

  } catch (error) {
    console.error(error);

    return sendJson(response, 500, {
      success: false,
      message: 'Não foi possível concluir a solicitação.'
    });
  }
}).listen(port, () => {
  console.log(`API do RPG Manager em http://localhost:${port}`);
});