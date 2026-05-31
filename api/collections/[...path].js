import { handleCollection, sendJson } from '../_mongo.js';

export default async function handler(req, res) {
  try {
    const path = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const [collectionName, id] = path;

    if (!collectionName) {
      return sendJson(res, 404, { error: 'Missing collection name' });
    }

    return handleCollection(req, res, collectionName, id);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
}
