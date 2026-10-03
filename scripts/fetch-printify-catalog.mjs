#!/usr/bin/env node
// Lists Printify jigsaw-puzzle blueprints, US print providers and variant IDs so the piece
// counts in the app can be matched to real SKUs.
//
//   PRINTIFY_API_TOKEN=xxxx node scripts/fetch-printify-catalog.mjs
//
// Copy the printed values into your Supabase function secrets (see SETUP_CHECKLIST.md).
const token = process.env.PRINTIFY_API_TOKEN;
if (!token) {
  console.error('Set PRINTIFY_API_TOKEN first. Create one at Printify > Account > Connections.');
  process.exit(1);
}
const api = async (path) => {
  const res = await fetch(`https://api.printify.com/v1${path}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'StudioJigsaw-setup' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const shops = await api('/shops.json');
console.log('\nShops (use the id as PRINTIFY_SHOP_ID):');
for (const s of shops) console.log(`  ${s.id}  ${s.title}  [${s.sales_channel}]`);

const blueprints = (await api('/catalog/blueprints.json')).filter((b) => /jigsaw|puzzle/i.test(b.title));
for (const bp of blueprints) {
  console.log(`\nBlueprint ${bp.id}: ${bp.title}`);
  for (const p of await api(`/catalog/blueprints/${bp.id}/print_providers.json`)) {
    const detail = await api(`/catalog/print_providers/${p.id}.json`).catch(() => null);
    const country = detail?.location?.country ?? '??';
    const { variants } = await api(`/catalog/blueprints/${bp.id}/print_providers/${p.id}/variants.json`);
    console.log(`  Provider ${p.id}: ${p.title} (${country})`);
    const map = {};
    for (const v of variants) {
      const pieces = Number((v.title.match(/(\d[\d,]*)\s*-?\s*(pcs|piece)/i) ?? [])[1]?.replace(',', ''));
      const area = v.placeholders?.find((h) => h.position === 'front');
      console.log(`    variant ${v.id}: ${v.title}${area ? `  print area ${area.width}x${area.height}px` : ''}`);
      if (pieces) map[pieces] = v.id;
    }
    if (Object.keys(map).length) {
      console.log(`    -> PRINTIFY_BLUEPRINT_ID=${bp.id} PRINTIFY_PROVIDER_ID=${p.id}`);
      console.log(`    -> PRINTIFY_VARIANTS='${JSON.stringify(map)}'`);
    }
  }
}
console.log('\nPick a US provider whose variants cover 30, 110, 252, 500 and 1000 pieces.');
console.log('If its piece counts differ, update src/config/printify.ts and supabase/functions/_shared/pricing.ts to match.');
