# Setup checklist

Everything the app needs from you. The app already runs without any of this (photo puzzles, collage, daily art from a bundled list, saving progress). Each section below switches on one more part. Work top to bottom; tick boxes as you go.

**Where values go**

- *App values* (public, safe to ship): EAS environment variables. `npx eas-cli env:create --environment production --name NAME --value VALUE --visibility plaintext` (repeat for `preview` and `development`), or locally in `.env.local` (copy `.env.example`).
- *Secrets* (never in the app): Supabase function secrets. `npx supabase secrets set NAME=VALUE`.

| Status | What it unlocks |
|---|---|
| ⬜ 1. Expo / EAS | Building the iOS and Android apps |
| ⬜ 2. Apple + Google developer accounts | Installing on phones, store release |
| ⬜ 3. Supabase | Anonymous identity, daily art schedule, gifts, orders |
| ⬜ 4. RevenueCat | Pro subscription |
| ⬜ 5. AdMob | Ads on the free tier |
| ⬜ 6. Stripe | Paying for printed puzzles |
| ⬜ 7. Printify | Printing and shipping |
| ⬜ 8. Website + legal pages | Gift links, Terms, Privacy |

---

## 1. Expo / EAS (builds)

- [ ] Create a free account at https://expo.dev.
- [ ] In this folder run `npx eas-cli login`, then `npx eas-cli init`. It prints a project ID.
- [ ] Save it: `npx eas-cli env:create --name EAS_PROJECT_ID --value <id> --environment production --environment preview --environment development --visibility plaintext`.
- [ ] Decide the final app identifiers. The placeholders are `com.studiojigsaw.app` (both platforms). To change them set `IOS_BUNDLE_ID` and `ANDROID_PACKAGE` as EAS env vars **before the first store build**; they cannot change after release.

Build commands (all run in the cloud; no Mac needed):

```bash
npx eas-cli build --profile development --platform all   # test build with developer menu
npx eas-cli build --profile preview --platform android   # shareable APK
npx eas-cli build --profile production --platform all    # store builds
npx eas-cli submit --profile production --platform all   # upload to TestFlight / Play internal testing
```

## 2. Developer accounts

- [ ] Apple Developer Program ($99/yr) — https://developer.apple.com/programs. EAS creates certificates for you on the first iOS build.
- [ ] In App Store Connect create the app, then put its numeric Apple ID into `eas.json` → `submit.production.ios.ascAppId`.
- [ ] Google Play Console ($25 once) — https://play.google.com/console. Create the app. The first upload must be done by hand in the Console (upload the `.aab` from EAS to Internal testing); after that `eas submit` works once you add a service-account key (EAS prompts for it).

## 3. Supabase

- [ ] Create a project at https://supabase.com. From Project Settings → API copy:
  - `EXPO_PUBLIC_SUPABASE_URL` (app value)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (app value)
- [ ] Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**. Turn on **Email** too (used only for the optional "save across devices" link).
- [ ] Install the CLI and connect: `npx supabase login`, `npx supabase link --project-ref <ref>`.
- [ ] Create the tables and storage buckets: `npx supabase db push`.
- [ ] Deploy the functions: `npx supabase functions deploy`.
- [ ] Set a random cron secret: `npx supabase secrets set CRON_SECRET=<long random string>`.
- [ ] Schedule the two jobs. In the SQL editor (Database → Extensions: enable `pg_cron` and `pg_net` first), replacing `<ref>` and `<CRON_SECRET>`:

```sql
select cron.schedule('seed-daily-puzzles', '0 4 * * 1', $$
  select net.http_post(url := 'https://<ref>.supabase.co/functions/v1/seed-daily-puzzles',
                       headers := '{"x-cron-secret":"<CRON_SECRET>"}'::jsonb) $$);
select cron.schedule('cleanup-storage', '30 4 * * *', $$
  select net.http_post(url := 'https://<ref>.supabase.co/functions/v1/cleanup-storage',
                       headers := '{"x-cron-secret":"<CRON_SECRET>"}'::jsonb) $$);
```

- [ ] Run the seed once now so the first 60 days exist: the same `net.http_post` for `seed-daily-puzzles`, on its own.

Note: the schema differs from the original spec in three deliberate ways. (1) `profiles.is_under_13` is a function, not a generated column, because Postgres does not allow generated columns that depend on today's date. (2) Gifts are **not** publicly readable; recipients go through the `get-gift` function with the unguessable token, so nobody can list other people's gift names and notes. (3) Print orders can only be written by the server.

## 4. RevenueCat (Pro subscription)

- [ ] Create the subscriptions in the stores first:
  - App Store Connect → Subscriptions: group "Studio Jigsaw Pro", products `pro_monthly` ($3.99/month) and `pro_yearly` ($24.99/year). Optional 7-day free trial as an introductory offer on either; the paywall button says "Start 7-Day Free Trial" only when the store really offers one.
  - Play Console → Monetize → Subscriptions: `pro_monthly` and `pro_yearly` with the same prices.
- [ ] Create a project at https://app.revenuecat.com, add the iOS and Android apps, connect the store credentials it asks for.
- [ ] Entitlement: `pro`. Attach both products. Offering: default, with a Monthly and an Annual package.
- [ ] App values: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (starts `appl_`), `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (starts `goog_`).
- [ ] Secret (lets the server verify Pro before giving the print discount): `npx supabase secrets set REVENUECAT_SECRET_KEY=sk_...` (RevenueCat → API keys → Secret key).
- No weekly plan exists anywhere in the app, by design.

## 5. AdMob (free-tier ads)

Development builds always use Google's test ads. Real ads appear only in production builds with the IDs below.

- [ ] Create an account at https://admob.google.com and add two apps (iOS, Android).
- [ ] App IDs (contain `~`) → EAS env vars `ADMOB_IOS_APP_ID` and `ADMOB_ANDROID_APP_ID`.
- [ ] Create one **Rewarded** and one **Interstitial** unit per platform → app values `EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID`, `EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID`, `EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID`.
- [ ] AdMob → Privacy & messaging: create and publish the **GDPR** message and the **US states** message (this is the Google UMP consent form the app shows), and the **IDFA explainer** for iOS.
- [ ] AdMob → Blocking controls: set the maximum ad content rating to PG or lower to suit a 13+ audience.

## 6. Stripe (print payments)

- [ ] Create an account at https://stripe.com and complete business verification.
- [ ] App value: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...` while testing, `pk_live_...` for release).
- [ ] Secret: `npx supabase secrets set STRIPE_SECRET_KEY=sk_...`.
- [ ] Developers → Webhooks → add endpoint `https://<ref>.supabase.co/functions/v1/create-print-order`, event `payment_intent.succeeded`. Copy the signing secret: `npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.
- [ ] Apple Pay: in the Apple Developer portal create merchant ID `merchant.com.studiojigsaw.app` (or your own, then set EAS env var `APPLE_MERCHANT_ID` and update `src/services/payments.tsx`), and add it in Stripe → Settings → Payment methods → Apple Pay.
- [ ] Sales tax: the app currently applies one estimated rate (8.5%, `taxRate` in `supabase/functions/_shared/pricing.ts`). **Talk to an accountant** about where you must collect tax; Stripe Tax can replace the flat rate.

## 7. Printify (printing and shipping)

- [ ] Create an account at https://printify.com, add a payment method, and create a shop of type **API**.
- [ ] Account → Connections → generate a Personal Access Token. Secret: `npx supabase secrets set PRINTIFY_API_TOKEN=...`.
- [ ] Find the real product IDs: `PRINTIFY_API_TOKEN=... node scripts/fetch-printify-catalog.mjs`. Choose a **US** print provider for the jigsaw puzzle blueprint and set what it prints:

```bash
npx supabase secrets set PRINTIFY_SHOP_ID=... PRINTIFY_BLUEPRINT_ID=... PRINTIFY_PROVIDER_ID=... \
  PRINTIFY_VARIANTS='{"30":...,"110":...,"252":...,"500":...,"1000":...}'
```

- [ ] If the provider's piece counts or print sizes differ from 30 / 110 / 252 / 500 / 1000, update `src/config/printify.ts` and the price table in `supabase/functions/_shared/pricing.ts` to match, then run `npm test`.
- [ ] Check each variant's real cost in the Printify dashboard, update `estimatedCostCents` (or set the `PRINTIFY_COSTS` secret, cents per piece count) and re-read `MARGINS.md`.
- [ ] Webhooks: register `order:sent-to-production`, `order:shipment:created` and `order:shipment:delivered` pointing to `https://<ref>.supabase.co/functions/v1/printify-webhook` with a secret of your choice (Printify API: `POST /v1/shops/{shop_id}/webhooks.json` with `{"topic": ..., "url": ..., "secret": ...}`), then `npx supabase secrets set PRINTIFY_WEBHOOK_SECRET=<same secret>`.
- [ ] Place one real test order to your own address before launch.

**Known limitations to decide on**

- **Box text and gift message are switched off.** Printify's standard puzzle does not print custom lid text or include a message card, so the checkout does not offer them (`PRINT_PERSONALIZATION = false` in `src/config/env.ts`). The fields are stored with the order if you turn the flag on, but nothing prints them yet.
- **Express shipping** is offered at $12.99 and maps to Printify shipping method 2. Confirm your provider supports it for puzzles; if not, remove the `express` tier in `src/app/checkout/[id].tsx`.
- **The design mockups promised things Printify does not make** (wooden pieces, magnetic gift box, velvet bag, foil stamping, a 30-day warranty). The app's wording describes the real product instead. Change it in `src/app/completed/[id].tsx` if your provider offers more.
- If Printify rejects an order after payment, the order is marked "Needs attention" and you must refund or resubmit it by hand (Stripe dashboard / Printify dashboard). There is no automatic refund.

## 8. Website and legal pages

- [ ] Register the domain used for gift links (placeholder: `studiojigsaw.app`) and host the `web/` folder there (see `web/README.md`). If you use a different domain, change it in `app.config.ts` (two places) and set `EXPO_PUBLIC_GIFT_BASE_URL`.
- [ ] `web/.well-known/apple-app-site-association`: replace `REPLACE_TEAM_ID` with your Apple Team ID.
- [ ] `web/.well-known/assetlinks.json`: replace the fingerprint with the SHA-256 from Play Console → Setup → App signing.
- [ ] `web/gift/index.html`: replace the App Store link once the app has an ID.
- [ ] Publish a Terms of Service and a Privacy Policy and set `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL`. The in-app screens show a short summary and link to these. **Have a lawyer review them**; the privacy policy must cover AdMob, RevenueCat, Stripe, Printify and Supabase.
- [ ] Set up a support email address; both stores require one.
