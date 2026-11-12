import * as repository from './friendships.repository.js';

const error = (status, message) => ({ status, body: { success: false, message } });
const maxId = 9223372036854775807n;
const validId = (value) => {
  if (!/^\d+$/.test(String(value))) return false;
  try {
    const id = BigInt(value);
    return id > 0n && id <= maxId;
  } catch {
    return false;
  }
};
const idString = (value) => String(value);
const validUsername = (value) =>
  typeof value === 'string' && /^[a-z0-9_.-]{2,50}$/i.test(value.trim());
const publicRequest = (row) => ({
  id: idString(row.id),
  requesterId: idString(row.requester_id),
  recipientId: idString(row.recipient_id),
  name: row.name,
  username: row.username,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const searchUsers = async (userId, username) => {
  if (!validUsername(username)) {
    return error(400, 'Informe ao menos 2 caracteres válidos para pesquisar por username.');
  }
  const result = await repository.searchUsers(userId, username.trim());
  return {
    status: 200,
    body: {
      success: true,
      users: result.rows.map((user) => ({
        id: idString(user.id),
        name: user.name,
        username: user.username,
        relationship: user.relationship,
      })),
    },
  };
};

export const sendRequest = async (userId, body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !validId(body.recipientId)) {
    return error(400, 'Informe um usuário válido para a solicitação.');
  }
  const recipientId = String(BigInt(body.recipientId));
  if (BigInt(userId) === BigInt(recipientId)) {
    return error(400, 'Não é possível enviar uma solicitação para si mesmo.');
  }

  try {
    const created = await repository.transaction(async (executor) => {
      const users = await repository.lockUsers([userId, recipientId], executor);
      if (users.rowCount !== 2 || users.rows.some((user) => !user.is_active)) {
        return error(404, 'Usuário ativo não encontrado.');
      }
      if ((await repository.findFriendship(userId, recipientId, executor)).rowCount) {
        return error(409, 'Vocês já são amigos.');
      }
      if ((await repository.findPendingRequestBetween(userId, recipientId, executor)).rowCount) {
        return error(409, 'Já existe uma solicitação pendente entre esses usuários.');
      }
      const result = await repository.createRequest(userId, recipientId, executor);
      return result.rows[0];
    });
    if (created?.body) return created;
    return {
      status: 201,
      body: {
        success: true,
        message: 'Solicitação de amizade enviada.',
        request: {
          id: idString(created.id),
          status: created.status,
          createdAt: created.created_at,
        },
      },
    };
  } catch (exception) {
    if (exception.code === '23505') {
      return error(409, 'Já existe uma solicitação pendente entre esses usuários.');
    }
    throw exception;
  }
};

export const listReceivedRequests = async (userId) => {
  const result = await repository.listRequests(userId, 'received');
  return {
    status: 200,
    body: { success: true, requests: result.rows.map(publicRequest) },
  };
};

export const listSentRequests = async (userId) => {
  const result = await repository.listRequests(userId, 'sent');
  return {
    status: 200,
    body: { success: true, requests: result.rows.map(publicRequest) },
  };
};

const respondToRequest = async (requestId, userId, status) => {
  if (!validId(requestId)) return error(400, 'Identificador da solicitação inválido.');
  const parties = await repository.findRequestParties(requestId);
  if (!parties.rowCount || BigInt(parties.rows[0].recipient_id) !== BigInt(userId)) {
    return error(404, 'Solicitação pendente não encontrada.');
  }

  const result = await repository.transaction(async (executor) => {
    const requestParties = parties.rows[0];
    const lockedUsers = await repository.lockUsers(
      [requestParties.requester_id, requestParties.recipient_id],
      executor,
    );
    if (lockedUsers.rowCount !== 2 || lockedUsers.rows.some((user) => !user.is_active)) {
      return error(404, 'Usuário ativo não encontrado.');
    }

    const request = await repository.findRequestForUpdate(requestId, userId, executor);
    if (!request.rowCount || request.rows[0].status !== 'pending') {
      return error(409, 'Esta solicitação já foi respondida.');
    }
    if (status === 'accepted') {
      await repository.createFriendship(
        request.rows[0].requester_id,
        request.rows[0].recipient_id,
        executor,
      );
    }
    const updated = await repository.updateRequestStatus(requestId, status, executor);
    return updated.rowCount
      ? updated.rows[0]
      : error(409, 'Esta solicitação já foi respondida.');
  });
  if (result?.body) return result;
  return {
    status: 200,
    body: {
      success: true,
      message: status === 'accepted' ? 'Solicitação aceita.' : 'Solicitação recusada.',
      request: {
        id: idString(result.id),
        status: result.status,
        updatedAt: result.updated_at,
      },
    },
  };
};

export const acceptRequest = (requestId, userId) =>
  respondToRequest(requestId, userId, 'accepted');

export const rejectRequest = (requestId, userId) =>
  respondToRequest(requestId, userId, 'rejected');

export const listFriendships = async (userId) => {
  const result = await repository.listFriendships(userId);
  return {
    status: 200,
    body: {
      success: true,
      friends: result.rows.map((row) => ({
        id: idString(row.id),
        userId: idString(row.friend_id),
        name: row.name,
        username: row.username,
        createdAt: row.created_at,
      })),
    },
  };
};

export const removeFriendship = async (friendshipId, userId) => {
  if (!validId(friendshipId)) return error(400, 'Identificador da amizade inválido.');
  const parties = await repository.findFriendshipById(friendshipId, userId);
  if (!parties.rowCount) return error(404, 'Amizade não encontrada.');
  const result = await repository.transaction(async (executor) => {
    await repository.lockUsers(
      [parties.rows[0].user_id, parties.rows[0].friend_id],
      executor,
    );
    const friendship = await repository.findFriendshipForUpdate(friendshipId, userId, executor);
    if (!friendship.rowCount) return false;
    const deleted = await repository.deleteFriendship(friendshipId, userId, executor);
    return deleted.rowCount > 0;
  });
  return result
    ? { status: 200, body: { success: true, message: 'Amizade removida.' } }
    : error(404, 'Amizade não encontrada.');
};
