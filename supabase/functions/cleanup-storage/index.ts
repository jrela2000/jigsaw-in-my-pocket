// Scheduled nightly. Deletes gift images after 90 days (unless ordered as a print) and print uploads 30 days after delivery.
import { admin, env, json, safeEqual } from '../_shared/util.ts';

const DAY = 86400000;

Deno.serve(async (req) => {
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) return json({ error: 'forbidden' }, 403);
  const db = admin();
  const now = Date.now();

  const { data: gifts } = await db.from('gifts').select('id,storage_path').lt('expires_at', new Date(now).toISOString()).limit(500);
  if (gifts?.length) {
    await db.storage.from('puzzle_gifts').remove(gifts.map((g) => g.storage_path));
    await db.from('gifts').delete().in('id', gifts.map((g) => g.id));
  }

  // Delivered more than 30 days ago, or shipped more than 60 days ago if no delivery event ever arrived.
  const { data: orders } = await db.from('print_orders').select('id,storage_upload_path')
    .neq('storage_upload_path', '')
    .or(`delivered_at.lt.${new Date(now - 30 * DAY).toISOString()},and(status.eq.shipped,updated_at.lt.${new Date(now - 60 * DAY).toISOString()})`)
    .limit(500);
  if (orders?.length) {
    await db.storage.from('print_uploads').remove(orders.map((o) => o.storage_upload_path));
    await db.from('print_orders').update({ storage_upload_path: '' }).in('id', orders.map((o) => o.id));
  }

  // Abandoned checkouts: uploads for orders never paid within two days.
  const { data: stale } = await db.from('print_orders').select('id,storage_upload_path').eq('status', 'pending_payment').lt('created_at', new Date(now - 2 * DAY).toISOString()).limit(500);
  if (stale?.length) {
    await db.storage.from('print_uploads').remove(stale.map((o) => o.storage_upload_path));
    await db.from('print_orders').delete().in('id', stale.map((o) => o.id));
  }
  return json({ giftsRemoved: gifts?.length ?? 0, printsPurged: orders?.length ?? 0, abandoned: stale?.length ?? 0 });
});
