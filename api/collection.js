import { handleCollection, sendJson } from './_mongo.js';

export default async function handler(req, res) {
  try {
    const collectionName = req.query.collection;
    const id = req.query.id;

    if (!collectionName || Array.isArray(collectionName)) {
      return sendJson(res, 400, { error: 'Missing collection query parameter' });
    }

    return await handleCollection(req, res, collectionName, Array.isArray(id) ? id[0] : id);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
}
