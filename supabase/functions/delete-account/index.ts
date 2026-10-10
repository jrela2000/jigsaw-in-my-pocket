// Erases everything tied to the caller's anonymous identity: uploaded print files, then the identity itself (order rows cascade).
import { admin, HttpError, json, serve, userOf } from '../_shared/util.ts';

serve(async (req) => {
  const user = await userOf(req);
  if (!user) throw new HttpError(401, 'Not signed in.');
  const db = admin();
  const { data } = await db.storage.from('print_uploads').list(user.id, { limit: 1000 });
  if (data?.length) await db.storage.from('print_uploads').remove(data.map((f) => `${user.id}/${f.name}`));
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
