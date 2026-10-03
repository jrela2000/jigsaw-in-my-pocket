// Looks up one gift by its unguessable token and returns a short-lived signed URL for the image.
import { admin, HttpError, json, serve } from '../_shared/util.ts';

serve(async (req) => {
  const { token } = await req.json();
  if (typeof token !== 'string' || token.length < 16) throw new HttpError(404, 'This gift link is not valid.');
  const db = admin();
  const { data: gift } = await db.from('gifts').select('*').eq('token', token).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!gift) throw new HttpError(404, 'This gift has expired or does not exist.');
  const signed = await db.storage.from('puzzle_gifts').createSignedUrl(gift.storage_path, 60 * 60);
  if (signed.error || !signed.data) throw new HttpError(404, 'This gift has expired or does not exist.');

  let prepaid = false;
  if (gift.is_prepaid_print && gift.print_order_id) {
    const { data: order } = await db.from('print_orders').select('status').eq('id', gift.print_order_id).maybeSingle();
    prepaid = order?.status === 'awaiting_address';
  }
  return json({
    token: gift.token, senderName: gift.sender_name, recipientName: gift.recipient_name, note: gift.personal_note,
    pieces: gift.piece_count, title: gift.title, rotation: gift.rotation, imageUrl: signed.data.signedUrl, prepaid,
  });
});
