import { assertSecret, bearerToken, getHuitaoPool, json, ORDER_STATUSES } from '../lib/orders.mjs';

function requireAdmin(request) {
  assertSecret(bearerToken(request), process.env.HUITAO_ADMIN_TOKEN, 'HUITAO_ADMIN_TOKEN');
}

async function listOrders(request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  if (status && !ORDER_STATUSES.includes(status)) return json({ error: 'Invalid status' }, 400);

  const pool = getHuitaoPool();
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE o.status = $${params.length}`;
  }
  params.push(limit);

  const result = await pool.query(
    `SELECT
       o.id, o.order_no, o.status, o.source, o.payment_method,
       o.shipping_name, o.shipping_email, o.shipping_phone, o.shipping_address,
       o.subtotal, o.shipping_fee, o.total, o.customer_note,
       o.submitted_at, o.created_at, o.updated_at,
       COALESCE(
         json_agg(
           json_build_object(
             'sku', i.sku,
             'productName', i.product_name,
             'quantity', i.quantity,
             'unitPrice', i.unit_price,
             'lineTotal', i.line_total
           ) ORDER BY i.id
         ) FILTER (WHERE i.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM orders o
     LEFT JOIN order_items i ON i.order_id = o.id
     ${where}
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  return json({ orders: result.rows });
}

async function updateOrder(request) {
  const body = await request.json();
  const orderId = Number(body?.orderId);
  const nextStatus = body?.status;
  const note = body?.note ? String(body.note).trim().slice(0, 2000) : null;

  if (!Number.isInteger(orderId) || orderId <= 0) return json({ error: 'Invalid orderId' }, 400);
  if (!ORDER_STATUSES.includes(nextStatus)) return json({ error: 'Invalid status' }, 400);

  const pool = getHuitaoPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, order_no, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return json({ error: 'Order not found' }, 404);
    }

    const previous = current.rows[0].status;
    await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, orderId]);
    await client.query(
      `INSERT INTO order_events (order_id, event_type, from_status, to_status, actor, note)
       VALUES ($1, 'status_changed', $2, $3, 'admin-token', $4)`,
      [orderId, previous, nextStatus, note],
    );
    await client.query(
      `INSERT INTO audit_logs (actor, action, resource_type, resource_id, metadata)
       VALUES ('admin-token', 'order.status.update', 'order', $1, jsonb_build_object('from', $2::text, 'to', $3::text))`,
      [String(orderId), previous, nextStatus],
    );
    await client.query('COMMIT');
    return json({ ok: true, orderId, orderNo: current.rows[0].order_no, status: nextStatus });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default async function handler(request) {
  try {
    requireAdmin(request);
    if (request.method === 'GET') return await listOrders(request);
    if (request.method === 'PATCH') return await updateOrder(request);
    return json({ error: 'Method not allowed' }, 405, { allow: 'GET, PATCH' });
  } catch (error) {
    console.error('Admin orders API failed', error);
    return json({ error: error?.message || 'Internal server error' }, error?.status || 500);
  }
}

export const config = {
  path: '/api/admin/orders',
};
