import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const pg = require('/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg');
const bcrypt = require('/home/runner/workspace/artifacts/api-server/node_modules/bcryptjs');
const { readFileSync } = await import('fs');

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('No DATABASE_URL');

const pool = new Pool({ connectionString: DATABASE_URL });

const passwordHash = await bcrypt.hash('wemineforgold', 12);

const checkUser = await pool.query("SELECT id FROM users WHERE username = $1", ['AndyFunke']);
if (checkUser.rows.length === 0) {
  await pool.query(
    `INSERT INTO users (username, password_hash, role, is_bootstrap_admin, site, preferences) VALUES ($1,$2,$3,$4,$5,$6)`,
    ['AndyFunke', passwordHash, 'system_admin', true, 'echo_bay', JSON.stringify({ lastGoverningState: 'WA' })]
  );
  console.log('Created AndyFunke');
} else {
  await pool.query(
    `UPDATE users SET password_hash=$1, role=$2, is_bootstrap_admin=$3, site=$4, preferences=$5 WHERE username=$6`,
    [passwordHash, 'system_admin', true, 'echo_bay', JSON.stringify({ lastGoverningState: 'WA' }), 'AndyFunke']
  );
  console.log('Updated AndyFunke');
}

for (const value of [96, 120, 136, 160, 176, 200, 216]) {
  await pool.query(`INSERT INTO pto_options (value) VALUES ($1) ON CONFLICT (value) DO NOTHING`, [value]);
}
const opts = await pool.query('SELECT value FROM pto_options ORDER BY value');
console.log('PTO options:', opts.rows.map(r => r.value));

const letterheadBuf = readFileSync('/home/runner/workspace/attached_assets/Offer_Letterhead_1774644605564.docx');
const b64 = letterheadBuf.toString('base64');
await pool.query(
  `INSERT INTO app_settings (key, value_text, updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value_text=$2, updated_at=NOW()`,
  ['letterhead', b64]
);
console.log('Stored letterhead:', letterheadBuf.length, 'bytes');

await pool.end();
console.log('Done.');
