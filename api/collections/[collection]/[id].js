import { handleCollection, sendJson } from '../../_mongo.js';

export default async function handler(req, res) {
  try {
    return handleCollection(req, res, req.query.collection, req.query.id);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
}
