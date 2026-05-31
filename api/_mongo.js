import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

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

export function getClient() {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }

  if (!clientPromise) {
    const client = new MongoClient(mongoUri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function normalizeDocument(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function buildSort(query) {
  if (!query.sort) return undefined;
  return { [query.sort]: query.order === 'asc' ? 1 : -1 };
}

function buildFilter(query) {
  const filter = {};

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) continue;

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

  if (typeof query.or === 'string') {
    filter.$or = query.or.split(',').map((part) => {
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

export async function handleCollection(req, res, collectionName, id) {
  if (!allowedCollections.has(collectionName)) {
    return sendJson(res, 404, { error: `Unknown collection "${collectionName}"` });
  }

  const db = await getDb();
  const collection = db.collection(collectionName);

  if (req.method === 'GET') {
    const filter = buildFilter(req.query);

    if (id) {
      const doc = await collection.findOne({ id: parseValue(id) });
      return sendJson(res, 200, { data: normalizeDocument(doc) });
    }

    if (req.query.id) filter.id = parseValue(req.query.id);

    const limit = Math.min(Number(req.query.limit || 1000), 5000);
    let cursor = collection.find(filter).limit(limit);
    const sort = buildSort(req.query);
    if (sort) cursor = cursor.sort(sort);

    let data = (await cursor.toArray()).map(normalizeDocument);

    if (req.query.include === 'relations' && collectionName === 'orders') {
      data = await enrichOrders(db, data);
    }

    if (req.query.include === 'relations' && collectionName === 'purchase_invoices') {
      data = await enrichPurchaseInvoices(db, data);
    }

    return sendJson(res, 200, { data });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
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
    const updated = {
      ...(req.body || {}),
      updated_at: new Date().toISOString(),
    };
    const filter = id ? { id: parseValue(id) } : buildFilter(req.query);

    await collection.updateOne(filter, { $set: updated }, { upsert: false });
    const data = normalizeDocument(await collection.findOne(filter));
    return sendJson(res, 200, { data });
  }

  if (req.method === 'DELETE') {
    const filter = id ? { id: parseValue(id) } : buildFilter(req.query);
    await collection.deleteOne(filter);
    return sendJson(res, 200, { data: id ? { id } : filter });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

export { dbName };
