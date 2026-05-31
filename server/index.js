import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

const envPath = new URL('../.env', import.meta.url);

if (existsSync(envPath)) {
  const envFile = readFileSync(envPath, 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const port = Number(process.env.PORT || 8787);
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'cashier_demo';

const allowedCollections = new Set([
  'store_settings',
  'categories',
  'products',
  'customers',
  'orders',
  'order_items',
  'invoice_counter',
  'cashiers',
  'employees',
  'employee_transactions',
  'expenses',
  'suppliers',
  'purchase_invoices',
  'purchase_items',
]);

let clientPromise;

function getClient() {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI in .env');
  }

  if (!clientPromise) {
    const client = new MongoClient(mongoUri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  return body ? JSON.parse(body) : {};
}

function normalizeDocument(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function buildSort(searchParams) {
  const sort = searchParams.get('sort');
  if (!sort) return undefined;

  const direction = searchParams.get('order') === 'asc' ? 1 : -1;
  return { [sort]: direction };
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function buildFilter(searchParams) {
  const filter = {};

  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('eq_')) {
      filter[key.slice(3)] = parseValue(value);
    }

    if (key.startsWith('gte_')) {
      const field = key.slice(4);
      filter[field] = { ...(filter[field] || {}), $gte: parseValue(value) };
    }

    if (key.startsWith('lte_')) {
      const field = key.slice(4);
      filter[field] = { ...(filter[field] || {}), $lte: parseValue(value) };
    }
  }

  const or = searchParams.get('or');
  if (or) {
    filter.$or = or.split(',').map((part) => {
      const [field, operator, ...rest] = part.split('.');
      const value = rest.join('.');
      if (operator === 'eq') return { [field]: parseValue(value) };
      return {};
    });
  }

  return filter;
}

async function enrichOrders(db, orders) {
  const customerIds = [...new Set(orders.map((order) => order.customer_id).filter(Boolean))];
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  const productIds = new Set();

  const customers = customerIds.length
    ? await db.collection('customers').find({ id: { $in: customerIds } }).toArray()
    : [];
  const items = orderIds.length
    ? await db.collection('order_items').find({ order_id: { $in: orderIds } }).toArray()
    : [];

  for (const item of items) {
    if (item.product_id) productIds.add(item.product_id);
  }

  const products = productIds.size
    ? await db.collection('products').find({ id: { $in: [...productIds] } }).toArray()
    : [];

  const customersById = new Map(customers.map((customer) => [customer.id, normalizeDocument(customer)]));
  const productsById = new Map(products.map((product) => [product.id, normalizeDocument(product)]));
  const itemsByOrderId = new Map();

  for (const item of items) {
    const normalized = normalizeDocument(item);
    normalized.products = productsById.get(item.product_id) || null;
    const orderItems = itemsByOrderId.get(item.order_id) || [];
    orderItems.push(normalized);
    itemsByOrderId.set(item.order_id, orderItems);
  }

  return orders.map((order) => ({
    ...order,
    customers: order.customer_id ? customersById.get(order.customer_id) || null : null,
    order_items: itemsByOrderId.get(order.id) || [],
  }));
}

async function enrichPurchaseInvoices(db, invoices) {
  const supplierIds = [...new Set(invoices.map((invoice) => invoice.supplier_id).filter(Boolean))];
  const invoiceIds = invoices.map((invoice) => invoice.id).filter(Boolean);
  const productIds = new Set();

  const suppliers = supplierIds.length
    ? await db.collection('suppliers').find({ id: { $in: supplierIds } }).toArray()
    : [];
  const items = invoiceIds.length
    ? await db.collection('purchase_items').find({ purchase_invoice_id: { $in: invoiceIds } }).toArray()
    : [];

  for (const item of items) {
    if (item.product_id) productIds.add(item.product_id);
  }

  const products = productIds.size
    ? await db.collection('products').find({ id: { $in: [...productIds] } }).toArray()
    : [];

  const suppliersById = new Map(suppliers.map((supplier) => [supplier.id, normalizeDocument(supplier)]));
  const productsById = new Map(products.map((product) => [product.id, normalizeDocument(product)]));
  const itemsByInvoiceId = new Map();

  for (const item of items) {
    const normalized = normalizeDocument(item);
    normalized.products = productsById.get(item.product_id) || null;
    const invoiceItems = itemsByInvoiceId.get(item.purchase_invoice_id) || [];
    invoiceItems.push(normalized);
    itemsByInvoiceId.set(item.purchase_invoice_id, invoiceItems);
  }

  return invoices.map((invoice) => ({
    ...invoice,
    suppliers: invoice.supplier_id ? suppliersById.get(invoice.supplier_id) || null : null,
    purchase_items: itemsByInvoiceId.get(invoice.id) || [],
  }));
}

async function handleCollection(req, res, collectionName, id, searchParams) {
  if (!allowedCollections.has(collectionName)) {
    return sendJson(res, 404, { error: `Unknown collection "${collectionName}"` });
  }

  const db = await getDb();
  const collection = db.collection(collectionName);

  if (req.method === 'GET') {
    const filter = buildFilter(searchParams);

    if (id) {
      const doc = await collection.findOne({ id: parseValue(id) });
      return sendJson(res, 200, { data: normalizeDocument(doc) });
    }

    const filterId = searchParams.get('id');
    if (filterId) filter.id = parseValue(filterId);

    const limit = Math.min(Number(searchParams.get('limit') || 1000), 5000);
    let cursor = collection.find(filter).limit(limit);
    const sort = buildSort(searchParams);
    if (sort) cursor = cursor.sort(sort);

    let data = (await cursor.toArray()).map(normalizeDocument);

    if (searchParams.get('include') === 'relations' && collectionName === 'orders') {
      data = await enrichOrders(db, data);
    }

    if (searchParams.get('include') === 'relations' && collectionName === 'purchase_invoices') {
      data = await enrichPurchaseInvoices(db, data);
    }

    return sendJson(res, 200, { data });
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const docs = Array.isArray(body) ? body : [body];
    const now = new Date().toISOString();
    const prepared = docs.map((doc) => ({
      id: doc.id || randomUUID(),
      created_at: doc.created_at || now,
      ...doc,
    }));

    await collection.insertMany(prepared);
    const data = prepared.map(normalizeDocument);
    return sendJson(res, 201, { data: Array.isArray(body) ? data : data[0] });
  }

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    const updated = {
      ...body,
      updated_at: new Date().toISOString(),
    };
    const filter = id ? { id: parseValue(id) } : buildFilter(searchParams);

    await collection.updateOne(filter, { $set: updated }, { upsert: false });
    const data = normalizeDocument(await collection.findOne(filter));
    return sendJson(res, 200, { data });
  }

  if (req.method === 'DELETE') {
    const filter = id ? { id: parseValue(id) } : buildFilter(searchParams);
    await collection.deleteOne(filter);
    return sendJson(res, 200, { data: id ? { id } : filter });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {});
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/api/health') {
      const db = await getDb();
      await db.command({ ping: 1 });
      return sendJson(res, 200, { ok: true, db: dbName });
    }

    const match = url.pathname.match(/^\/api\/collections\/([^/]+)(?:\/([^/]+))?$/);
    if (match) {
      return handleCollection(req, res, match[1], match[2], url.searchParams);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mongo API running at http://127.0.0.1:${port}`);
});
