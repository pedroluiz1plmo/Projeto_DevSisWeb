import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { pool } from '../src/config/database.js';
import { handleUserRoute } from '../src/routes/user_routes.js';
import { handleFriendshipRoute } from '../src/modules/friendships/friendships.routes.js';

describe('amizades e pesquisa de usuários', () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  let database;

  beforeEach(() => {
    database = createDatabase();
    pool.query = database.query;
    pool.connect = async () => ({ query: database.query, release() {} });
  });

  afterEach(() => {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  });

  it('pesquisa parcialmente por username, exclui a própria conta e retorna apenas dados públicos', async () => {
    const response = await userRequest('GET', '/api/users/search?username=ave');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.users.map(({ name, username, relationship }) =>
      ({ name, username, relationship })), [
      { name: 'Jogador', username: 'aventureiro', relationship: 'none' },
    ]);
    assert.equal('email' in response.body.users[0], false);
    assert.equal('password_hash' in response.body.users[0], false);
    assert.equal(
      (await handleUserRoute({
        method: 'GET',
        url: '/api/users/search?username=av',
        headers: {},
      })).status,
      401,
    );
  });

  it('não captura rotas alheias nem rotas inválidas sem autenticação', async () => {
    assert.equal(
      await handleFriendshipRoute({
        method: 'GET',
        url: '/api/campaigns',
        headers: {},
      }),
      null,
    );
    assert.equal(
      (await handleFriendshipRoute({
        method: 'GET',
        url: '/api/friendships',
        headers: {},
      })).status,
      401,
    );
  });

  it('envia solicitação sem identidade fornecida pelo cliente e impede duplicidade em qualquer direção', async () => {
    const created = await friendshipRequest(
      'POST',
      '/api/friendships/requests',
      { recipientId: '43', requesterId: '44' },
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.request.status, 'pending');
    assert.equal(database.requests[0].requester_id, 42);
    assert.equal(database.requests[0].recipient_id, 43);
    assert.equal(
      (await friendshipRequest('POST', '/api/friendships/requests', { recipientId: '43' })).status,
      409,
    );
    assert.equal(
      (await friendshipRequest('POST', '/api/friendships/requests', { recipientId: '42' })).status,
      400,
    );
    assert.equal(
      (await friendshipRequest('POST', '/api/friendships/requests', null)).status,
      400,
    );
  });

  it('lista solicitações enviadas e recebidas e aceita apenas pelo destinatário', async () => {
    const created = await friendshipRequest(
      'POST',
      '/api/friendships/requests',
      { recipientId: '43' },
    );
    const requestId = created.body.request.id;
    assert.equal(
      (await friendshipRequest('GET', '/api/friendships/requests/sent')).body.requests[0].username,
      'aventureiro',
    );
    assert.equal(
      (await friendshipRequest(
        'GET',
        '/api/friendships/requests/received',
        {},
        '43',
      )).body.requests[0].username,
      'mestre',
    );
    assert.equal(
      (await friendshipRequest(
        'PATCH',
        `/api/friendships/requests/${requestId}/accept`,
        {},
        '44',
      )).status,
      404,
    );
    const accepted = await friendshipRequest(
      'PATCH',
      `/api/friendships/requests/${requestId}/accept`,
      {},
      '43',
    );
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.request.status, 'accepted');
    assert.equal(database.friendships.length, 1);
    assert.equal(database.campaignMembers.length, 0);

    const [requesterFriends, recipientFriends] = await Promise.all([
      friendshipRequest('GET', '/api/friendships', {}, '42'),
      friendshipRequest('GET', '/api/friendships', {}, '43'),
    ]);
    assert.equal(requesterFriends.body.friends[0].username, 'aventureiro');
    assert.equal(recipientFriends.body.friends[0].username, 'mestre');
    assert.equal(
      (await friendshipRequest(
        'PATCH',
        `/api/friendships/requests/${requestId}/accept`,
        {},
        '43',
      )).status,
      409,
    );
  });

  it('recusa sem criar amizade e remove amizades somente para um dos envolvidos', async () => {
    const pending = await friendshipRequest(
      'POST',
      '/api/friendships/requests',
      { recipientId: '43' },
    );
    assert.equal(
      (await friendshipRequest(
        'PATCH',
        `/api/friendships/requests/${pending.body.request.id}/reject`,
        {},
        '43',
      )).status,
      200,
    );
    assert.equal(database.friendships.length, 0);

    const second = await friendshipRequest(
      'POST',
      '/api/friendships/requests',
      { recipientId: '43' },
    );
    await friendshipRequest(
      'PATCH',
      `/api/friendships/requests/${second.body.request.id}/accept`,
      {},
      '43',
    );
    const friendshipId = String(database.friendships[0].id);
    assert.equal(
      (await friendshipRequest('DELETE', `/api/friendships/${friendshipId}`, {}, '44')).status,
      404,
    );
    assert.equal(
      (await friendshipRequest('DELETE', `/api/friendships/${friendshipId}`, {}, '43')).status,
      200,
    );
    assert.equal(database.friendships.length, 0);
  });

  async function friendshipRequest(method, url, body = {}, userId = '42') {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    return handleFriendshipRoute({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
    }, body);
  }

  async function userRequest(method, url, userId = '42') {
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET);
    return handleUserRoute({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
    });
  }
});

function createDatabase() {
  const users = [
    { id: 42, name: 'Mestre', username: 'mestre', email: 'secret@example.test', password_hash: 'secret', is_active: true },
    { id: 43, name: 'Jogador', username: 'aventureiro', email: 'secret2@example.test', password_hash: 'secret', is_active: true },
    { id: 44, name: 'Outro', username: 'outro', email: 'secret3@example.test', password_hash: 'secret', is_active: true },
  ];
  const requests = [];
  const friendships = [];
  const campaignMembers = [];
  let nextRequestId = 1;
  let nextFriendshipId = 1;
  const result = (rows = []) => ({ rowCount: rows.length, rows });
  const query = async (rawSql, params = []) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return result();
    if (sql.startsWith('SELECT u.id, u.name, u.username, CASE')) {
      const term = params[1].toLowerCase();
      const rows = users.filter(user =>
        user.id !== Number(params[0]) &&
        user.is_active &&
        user.username.toLowerCase().includes(term)).map(user => ({
          id: user.id,
          name: user.name,
          username: user.username,
          relationship: relation(Number(params[0]), user.id),
        }));
      return result(rows);
    }
    if (sql.startsWith('SELECT id, is_active FROM users')) {
      return result(users
        .filter(user => params[0].map(Number).includes(user.id))
        .map(({ id, is_active }) => ({ id, is_active })));
    }
    if (sql.startsWith('SELECT id FROM friendships')) {
      const friendship = findFriendship(Number(params[0]), Number(params[1]));
      return result(friendship ? [{ id: friendship.id }] : []);
    }
    if (sql.startsWith('SELECT id FROM friendship_requests')) {
      const [first, second] = params.map(Number);
      const request = requests.find(item =>
        item.status === 'pending' &&
        Math.min(item.requester_id, item.recipient_id) === Math.min(first, second) &&
        Math.max(item.requester_id, item.recipient_id) === Math.max(first, second));
      return result(request ? [{ id: request.id }] : []);
    }
    if (sql.startsWith('INSERT INTO friendship_requests')) {
      const [requesterId, recipientId] = params.map(Number);
      if (requests.some(item => item.status === 'pending' &&
        Math.min(item.requester_id, item.recipient_id) === Math.min(requesterId, recipientId) &&
        Math.max(item.requester_id, item.recipient_id) === Math.max(requesterId, recipientId))) {
        throw Object.assign(new Error('duplicate pending request'), { code: '23505' });
      }
      const request = {
        id: nextRequestId++,
        requester_id: requesterId,
        recipient_id: recipientId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      requests.push(request);
      return result([{ ...request }]);
    }
    if (sql.startsWith('SELECT request.id, request.requester_id, request.recipient_id')) {
      const received = sql.includes('WHERE request.recipient_id = $1');
      const rows = requests
        .filter(item => received ? item.recipient_id === Number(params[0]) : item.requester_id === Number(params[0]))
        .map(item => {
          const otherId = received ? item.requester_id : item.recipient_id;
          const other = users.find(user => user.id === otherId);
          return {
            ...item,
            name: other.name,
            username: other.username,
          };
        });
      return result(rows);
    }
    if (sql.startsWith('SELECT requester_id, recipient_id FROM friendship_requests')) {
      const request = requests.find(item => item.id === Number(params[0]));
      return result(request ? [{ requester_id: request.requester_id, recipient_id: request.recipient_id }] : []);
    }
    if (sql.startsWith('SELECT id, requester_id, recipient_id, status FROM friendship_requests')) {
      const request = requests.find(item =>
        item.id === Number(params[0]) && item.recipient_id === Number(params[1]));
      return result(request ? [{ ...request }] : []);
    }
    if (sql.startsWith('INSERT INTO friendships')) {
      const [firstId, secondId] = params.map(Number);
      const pair = findFriendship(firstId, secondId);
      if (pair) return result();
      const friendship = {
        id: nextFriendshipId++,
        user_id: Math.min(firstId, secondId),
        friend_id: Math.max(firstId, secondId),
        created_at: new Date().toISOString(),
      };
      friendships.push(friendship);
      return result([{ id: friendship.id }]);
    }
    if (sql.startsWith('UPDATE friendship_requests SET status =')) {
      const request = requests.find(item => item.id === Number(params[1]) && item.status === 'pending');
      if (!request) return result();
      request.status = params[0];
      request.updated_at = new Date().toISOString();
      return result([{ ...request }]);
    }
    if (sql.startsWith('SELECT friendship.id, friendship.created_at')) {
      const userId = Number(params[0]);
      return result(friendships
        .filter(item => item.user_id === userId || item.friend_id === userId)
        .map(item => {
          const friend = users.find(user => user.id === (item.user_id === userId ? item.friend_id : item.user_id));
          return {
            id: item.id,
            created_at: item.created_at,
            friend_id: friend.id,
            name: friend.name,
            username: friend.username,
          };
        }));
    }
    if (sql.startsWith('SELECT id, user_id, friend_id FROM friendships')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const friendship = friendships.find(item =>
        item.id === id && (item.user_id === userId || item.friend_id === userId));
      return result(friendship ? [{ ...friendship }] : []);
    }
    if (sql.startsWith('DELETE FROM friendships')) {
      const id = Number(params[0]);
      const userId = Number(params[1]);
      const index = friendships.findIndex(item =>
        item.id === id && (item.user_id === userId || item.friend_id === userId));
      if (index < 0) return result();
      const [deleted] = friendships.splice(index, 1);
      return result([{ id: deleted.id }]);
    }
    throw new Error(`Unexpected SQL in friendship test: ${sql}`);
  };
  const findFriendship = (first, second) => friendships.find(item =>
    item.user_id === Math.min(first, second) && item.friend_id === Math.max(first, second));
  const relation = (userId, otherId) => findFriendship(userId, otherId)
    ? 'friend'
    : requests.some(item => item.requester_id === userId && item.recipient_id === otherId && item.status === 'pending')
      ? 'request_sent'
      : requests.some(item => item.requester_id === otherId && item.recipient_id === userId && item.status === 'pending')
        ? 'request_received'
        : 'none';
  return { query, requests, friendships, campaignMembers };
}
