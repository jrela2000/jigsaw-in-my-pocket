const mem = new Map<string, string>();
const ls = () => (typeof localStorage === 'undefined' ? null : localStorage);

export const kv = {
  get: (key: string): string | null => ls()?.getItem(key) ?? mem.get(key) ?? null,
  set: (key: string, value: string) => {
    try {
      ls()?.setItem(key, value);
    } catch {
      mem.set(key, value);
    }
  },
  remove: (key: string) => {
    ls()?.removeItem(key);
    mem.delete(key);
  },
};
