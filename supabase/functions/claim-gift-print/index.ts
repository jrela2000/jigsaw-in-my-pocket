// The recipient of a prepaid gift supplies a delivery address; the order then goes to Printify.
import { submitToPrintify } from '../_shared/printify.ts';
import { admin, cleanAddress, HttpError, json, serve } from '../_shared/util.ts';

serve(async (req) => {
  const { token, address } = await req.json();
  const db = admin();
  const { data: gift } = await db.from('gifts').select('print_order_id').eq('token', String(token)).maybeSingle();
  if (!gift?.print_order_id) throw new HttpError(404, 'No prepaid print is attached to this gift.');
  const shipping = cleanAddress(address);
  // The status check makes the claim single-use even if two requests race.
  const { data: order } = await db.from('print_orders')
    .update({ shipping_address: shipping, status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', gift.print_order_id).eq('status', 'awaiting_address').select('*').maybeSingle();
  if (!order) throw new HttpError(409, 'This printed puzzle has already been claimed.');
  try {
    await submitToPrintify(db, order);
  } catch (err) {
    console.error('Printify submission failed', err);
    await db.from('print_orders').update({ status: 'failed' }).eq('id', order.id);
    throw new HttpError(502, 'We saved your address but could not reach the print studio. We will retry and email you.');
  }
  return json({ ok: true });
});
