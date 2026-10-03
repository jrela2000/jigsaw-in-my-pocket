// Erases the caller's cloud data: uploads, then the auth user (profiles, unlocks and gifts cascade).
import { admin, HttpError, json, serve, userOf } from '../_shared/util.ts';

serve(async (req) => {
  const user = await userOf(req);
  if (!user) throw new HttpError(401, 'Not signed in.');
  const db = admin();
  for (const bucket of ['puzzle_gifts', 'print_uploads']) {
    const { data } = await db.storage.from(bucket).list(user.id, { limit: 1000 });
    if (data?.length) await db.storage.from(bucket).remove(data.map((f) => `${user.id}/${f.name}`));
  }
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) throw new Error(error.message);
  return json({ ok: true });
});
