import { pool } from '../config/database.js';
import { listPermissions } from '../modules/admin/admin.service.js';

const readArgument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1] ?? null;
};

const userId = readArgument('--user-id');
const reason = readArgument('--reason');

try {
  if (!/^\d+$/.test(userId || '') || !reason?.trim() || reason.trim().length > 500) {
    throw new Error('Uso: npm run admin:bootstrap -- --user-id <ID> --reason "<motivo operacional>"');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query(
      'SELECT id, name, username, is_active FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!user.rowCount) throw new Error('O usuário informado não existe.');
    if (!user.rows[0].is_active) throw new Error('Não é possível provisionar uma conta ADM bloqueada.');
    const permissions = listPermissions();
    for (const permission of permissions) {
      await client.query(
        `INSERT INTO admin_permissions (user_id, permission)
         VALUES ($1, $2)
         ON CONFLICT (user_id, permission) DO NOTHING`,
        [userId, permission],
      );
    }
    await client.query(
      `INSERT INTO admin_audit_log
         (actor_source, action, entity_type, entity_id, before_data, after_data, metadata)
       VALUES ('bootstrap', 'admin.bootstrapped', 'user', $1, NULL, $2::jsonb, $3::jsonb)`,
      [
        String(userId),
        JSON.stringify({ permissions }),
        JSON.stringify({ reason: reason.trim(), userName: user.rows[0].name, username: user.rows[0].username }),
      ],
    );
    await client.query('COMMIT');
    console.log(`Permissões ADM provisionadas para ${user.rows[0].username} (ID ${userId}).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
