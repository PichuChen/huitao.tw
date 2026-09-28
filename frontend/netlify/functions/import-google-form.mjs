import { assertSecret, createImportedOrder, json } from '../lib/orders.mjs';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });
  }

  try {
    assertSecret(
      request.headers.get('x-huitao-sync-token'),
      process.env.HUITAO_FORM_SYNC_TOKEN,
      'HUITAO_FORM_SYNC_TOKEN',
    );

    const payload = await request.json();
    const result = await createImportedOrder(payload);
    return json({ ok: true, order: result }, result.duplicate ? 200 : 201);
  } catch (error) {
    console.error('Google Form import failed', error);
    return json({ error: error?.message || 'Internal server error' }, error?.status || 500);
  }
}

export const config = {
  path: '/api/import/google-form',
};
