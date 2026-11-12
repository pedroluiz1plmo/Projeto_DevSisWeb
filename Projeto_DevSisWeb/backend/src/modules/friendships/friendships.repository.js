import { pool } from '../../config/database.js';

export const transaction = async (operation) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const searchUsers = (userId, username) => pool.query(
  `SELECT u.id, u.name, u.username,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM friendships f
              WHERE f.user_id = LEAST($1::bigint, u.id)
                AND f.friend_id = GREATEST($1::bigint, u.id)
            ) THEN 'friend'
            WHEN EXISTS (
              SELECT 1 FROM friendship_requests r
              WHERE r.requester_id = $1 AND r.recipient_id = u.id
                AND r.status = 'pending'
            ) THEN 'request_sent'
            WHEN EXISTS (
              SELECT 1 FROM friendship_requests r
              WHERE r.requester_id = u.id AND r.recipient_id = $1
                AND r.status = 'pending'
            ) THEN 'request_received'
            ELSE 'none'
          END AS relationship
   FROM users u
   WHERE u.id <> $1 AND u.is_active = TRUE
     AND POSITION(LOWER($2) IN LOWER(u.username)) > 0
   ORDER BY u.username
   LIMIT 25`,
  [userId, username],
);

export const lockUsers = (userIds, executor) => executor.query(
  `SELECT id, is_active FROM users
   WHERE id = ANY($1::bigint[])
   ORDER BY id
   FOR UPDATE`,
  [userIds],
);

export const findFriendship = (userId, friendId, executor = pool) =>
  executor.query(
    `SELECT id FROM friendships
     WHERE user_id = LEAST($1::bigint, $2::bigint)
       AND friend_id = GREATEST($1::bigint, $2::bigint)`,
    [userId, friendId],
  );

export const findPendingRequestBetween = (userId, otherUserId, executor) =>
  executor.query(
    `SELECT id FROM friendship_requests
     WHERE status = 'pending'
       AND LEAST(requester_id, recipient_id) = LEAST($1::bigint, $2::bigint)
       AND GREATEST(requester_id, recipient_id) = GREATEST($1::bigint, $2::bigint)
     LIMIT 1`,
    [userId, otherUserId],
  );

export const createRequest = (requesterId, recipientId, executor) =>
  executor.query(
    `INSERT INTO friendship_requests (requester_id, recipient_id)
     VALUES ($1, $2)
     RETURNING id, requester_id, recipient_id, status, created_at`,
    [requesterId, recipientId],
  );

export const listRequests = (userId, direction) => {
  const ownerColumn = direction === 'received' ? 'recipient_id' : 'requester_id';
  const otherColumn = direction === 'received' ? 'requester_id' : 'recipient_id';
  return pool.query(
    `SELECT request.id, request.requester_id, request.recipient_id,
            request.status, request.created_at, request.updated_at,
            other.name, other.username
     FROM friendship_requests request
     JOIN users other ON other.id = request.${otherColumn}
     WHERE request.${ownerColumn} = $1
     ORDER BY request.created_at DESC, request.id DESC`,
    [userId],
  );
};

export const findRequestParties = (requestId) => pool.query(
  `SELECT requester_id, recipient_id
   FROM friendship_requests WHERE id = $1`,
  [requestId],
);

export const findRequestForUpdate = (requestId, recipientId, executor) =>
  executor.query(
    `SELECT id, requester_id, recipient_id, status
     FROM friendship_requests
     WHERE id = $1 AND recipient_id = $2
     FOR UPDATE`,
    [requestId, recipientId],
  );

export const createFriendship = (firstUserId, secondUserId, executor) =>
  executor.query(
    `INSERT INTO friendships (user_id, friend_id)
     VALUES (LEAST($1::bigint, $2::bigint), GREATEST($1::bigint, $2::bigint))
     ON CONFLICT (user_id, friend_id) DO NOTHING
     RETURNING id`,
    [firstUserId, secondUserId],
  );

export const updateRequestStatus = (requestId, status, executor) =>
  executor.query(
    `UPDATE friendship_requests
     SET status = $1, updated_at = NOW()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, requester_id, recipient_id, status, updated_at`,
    [status, requestId],
  );

export const listFriendships = (userId) => pool.query(
  `SELECT friendship.id, friendship.created_at,
          friend.id AS friend_id, friend.name, friend.username
   FROM friendships friendship
   JOIN users friend
     ON friend.id = CASE
       WHEN friendship.user_id = $1 THEN friendship.friend_id
       ELSE friendship.user_id
     END
   WHERE friendship.user_id = $1 OR friendship.friend_id = $1
   ORDER BY friend.username`,
  [userId],
);

export const findFriendshipForUpdate = (friendshipId, userId, executor) =>
  executor.query(
    `SELECT id, user_id, friend_id
     FROM friendships
     WHERE id = $1 AND (user_id = $2 OR friend_id = $2)
     FOR UPDATE`,
    [friendshipId, userId],
  );

export const findFriendshipById = (friendshipId, userId) => pool.query(
  `SELECT id, user_id, friend_id
   FROM friendships
   WHERE id = $1 AND (user_id = $2 OR friend_id = $2)`,
  [friendshipId, userId],
);

export const deleteFriendship = (friendshipId, userId, executor) =>
  executor.query(
    `DELETE FROM friendships
     WHERE id = $1 AND (user_id = $2 OR friend_id = $2)
     RETURNING id`,
    [friendshipId, userId],
  );
