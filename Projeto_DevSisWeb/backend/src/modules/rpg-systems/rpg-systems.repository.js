import { pool } from '../../config/database.js';

const systemSelect = `
  SELECT s.id, s.name, s.slug, s.description,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', sv.id,
               'systemId', sv.system_id,
               'name', sv.name,
               'slug', sv.slug,
               'description', sv.description
             ) ORDER BY sv.name
           ) FILTER (WHERE sv.id IS NOT NULL),
           '[]'::json
         ) AS versions
  FROM systems s
  LEFT JOIN system_versions sv ON sv.system_id = s.id
`;

export const findActiveSystems = async () => {
  const result = await pool.query(
    `${systemSelect}
     WHERE s.is_active = TRUE
     GROUP BY s.id
     ORDER BY s.name`
  );
  return result.rows;
};

export const findActiveSystemById = async (id) => {
  const result = await pool.query(
    `${systemSelect}
     WHERE s.id = $1 AND s.is_active = TRUE
     GROUP BY s.id`,
    [id]
  );
  return result.rowCount ? result.rows[0] : null;
};

export const findActiveSystemVersionById = async (id) => {
  const result = await pool.query(
    `SELECT sv.id, sv.name, sv.slug, sv.description,
            s.id AS system_id, s.name AS system_name, s.slug AS system_slug
     FROM system_versions sv
     JOIN systems s ON s.id = sv.system_id
     WHERE sv.id = $1 AND s.is_active = TRUE`,
    [id]
  );
  return result.rowCount ? result.rows[0] : null;
};
