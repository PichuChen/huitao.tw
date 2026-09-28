import crypto from 'node:crypto';
import { getDatabase } from '@netlify/database';

export function getHuitaoDatabase() {
  const connectionString = process.env.HUITAO_DATABASE_URL?.trim();
  return connectionString ? getDatabase({ connectionString }) : getDatabase();
}

export const ORDER_STATUSES = [
  'new',
  'contacted',
  'pending_payment',
  'paid',
  'packing',
  'shipped',
  'completed',
  'cancelled',
];

const PLANS = {
  one_bottle: {
    sku: 'MEDCORAL-SERUM',
    productName: '珊瑚精靈 MedCoral 珊瑚活力精華液',
    quantity: 1,
    unitPrice: 4500,
    shippingFee: 0,
  },
  two_bottles: {
    sku: 'MEDCORAL-SERUM',
    productName: '珊瑚精靈 MedCoral 珊瑚活力精華液',
    quantity: 2,
    unitPrice: 4300,
    shippingFee: 0,
  },
  sample_2ml: {
    sku: 'MEDCORAL-SAMPLE-2ML',
    productName: '珊瑚精靈 MedCoral 2ml 試用樣本',
    quantity: 1,
    unitPrice: 0,
    shippingFee: 60,
  },
};

function clean(value, maxLength = 500) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function makeOrderNo() {
  const now = new Date();
  const ymd = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HT${ymd}-${suffix}`;
}

export function bearerToken(request) {
  const value = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim() || null;
}

export function assertSecret(actual, expected, label) {
  if (!expected) {
    throw Object.assign(new Error(`${label} is not configured`), { status: 503 });
  }
  if (!actual || actual.length !== expected.length) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!ok) throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

export function normalizeImportPayload(input) {
  const customer = input?.customer || {};
  const shipping = input?.shipping || {};
  const planKey = clean(input?.plan, 50);
  const plan = planKey ? PLANS[planKey] : null;

  if (!plan) {
    throw Object.assign(new Error('Unknown order plan'), { status: 400 });
  }

  const name = clean(customer.name || shipping.name, 120);
  if (!name) throw Object.assign(new Error('Customer name is required'), { status: 400 });

  const address = clean(shipping.address, 500);
  if (!address) throw Object.assign(new Error('Shipping address is required'), { status: 400 });

  const email = clean(customer.email || shipping.email, 254);
  const phone = clean(customer.phone || shipping.phone, 80);
  const subtotal = plan.quantity * plan.unitPrice;

  return {
    source: 'google_form',
    sourceSubmissionId: clean(input?.sourceSubmissionId, 200),
    submittedAt: clean(input?.submittedAt, 80),
    customer: {
      name,
      email,
      phone,
      lineId: clean(customer.lineId, 120),
    },
    shipping: {
      name: clean(shipping.name || name, 120),
      email: clean(shipping.email || email, 254),
      phone: clean(shipping.phone || phone, 80),
      address,
    },
    paymentMethod: clean(input?.paymentMethod, 120),
    note: clean(input?.note, 2000),
    item: {
      ...plan,
      subtotal,
      total: subtotal + plan.shippingFee,
    },
  };
}

export async function createImportedOrder(payload) {
  const normalized = normalizeImportPayload(payload);
  const db = getHuitaoDatabase();
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    if (normalized.sourceSubmissionId) {
      const existing = await client.query(
        `SELECT id, order_no FROM orders
         WHERE source = $1 AND source_submission_id = $2
         LIMIT 1`,
        [normalized.source, normalized.sourceSubmissionId],
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return { ...existing.rows[0], duplicate: true };
      }
    }

    let customerId = null;
    const found = await client.query(
      `SELECT id FROM customers
       WHERE ($1::text IS NOT NULL AND LOWER(email) = LOWER($1))
          OR ($2::text IS NOT NULL AND phone = $2)
       ORDER BY id ASC
       LIMIT 1`,
      [normalized.customer.email, normalized.customer.phone],
    );

    if (found.rows[0]) {
      customerId = found.rows[0].id;
      await client.query(
        `UPDATE customers
         SET name = $1,
             email = COALESCE($2, email),
             phone = COALESCE($3, phone),
             line_id = COALESCE($4, line_id),
             updated_at = NOW()
         WHERE id = $5`,
        [
          normalized.customer.name,
          normalized.customer.email,
          normalized.customer.phone,
          normalized.customer.lineId,
          customerId,
        ],
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO customers (name, email, phone, line_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          normalized.customer.name,
          normalized.customer.email,
          normalized.customer.phone,
          normalized.customer.lineId,
        ],
      );
      customerId = inserted.rows[0].id;
    }

    const product = await client.query('SELECT id FROM products WHERE sku = $1 LIMIT 1', [normalized.item.sku]);
    const orderNo = makeOrderNo();
    const order = await client.query(
      `INSERT INTO orders (
         order_no, customer_id, source, source_submission_id, status, payment_method,
         shipping_name, shipping_email, shipping_phone, shipping_address,
         subtotal, shipping_fee, total, customer_note, submitted_at
       ) VALUES (
         $1, $2, $3, $4, 'new', $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14
       )
       RETURNING id, order_no`,
      [
        orderNo,
        customerId,
        normalized.source,
        normalized.sourceSubmissionId,
        normalized.paymentMethod,
        normalized.shipping.name,
        normalized.shipping.email,
        normalized.shipping.phone,
        normalized.shipping.address,
        normalized.item.subtotal,
        normalized.item.shippingFee,
        normalized.item.total,
        normalized.note,
        normalized.submittedAt,
      ],
    );

    await client.query(
      `INSERT INTO order_items (
         order_id, product_id, sku, product_name, quantity, unit_price, line_total
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        order.rows[0].id,
        product.rows[0]?.id || null,
        normalized.item.sku,
        normalized.item.productName,
        normalized.item.quantity,
        normalized.item.unitPrice,
        normalized.item.subtotal,
      ],
    );

    await client.query(
      `INSERT INTO order_events (order_id, event_type, to_status, actor, note)
       VALUES ($1, 'created', 'new', 'google-form-sync', 'Imported from Google Form')`,
      [order.rows[0].id],
    );

    await client.query('COMMIT');
    return { ...order.rows[0], duplicate: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}
