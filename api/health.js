import { dbName, getDb, sendJson } from './_mongo.js';

export default async function handler(req, res) {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return sendJson(res, 200, { ok: true, db: dbName });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Mongo connection failed' });
  }
}
