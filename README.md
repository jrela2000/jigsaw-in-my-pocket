# Jigsaw In My Pocket

Photo jigsaw puzzle app for iOS and Android (Expo SDK 57, React Native, TypeScript). Solve your own photos, a daily public-domain artwork, or a collage; then order the picture as a printed puzzle.

- `SETUP_CHECKLIST.md` — every account, key and dashboard setting still needed
- `MARGINS.md` — print pricing and margin table
- `STORE_LISTING.md` — store copy, privacy answers, release checklist

## Run it

```bash
npm install
npx expo start --web                                      # quick browser preview (no ads, purchases or payments)
npx eas-cli build --profile development --platform all    # real phone builds (needs an Expo account)
npm test                                                  # puzzle engine + pricing tests
npm run typecheck
```

Expo Go cannot run this app (ads, subscriptions and payments need native code); use a development build.

## Layout

| Path | What lives there |
|---|---|
| `src/app/` | Screens (Expo Router): age screen, tabs (Gallery, New Puzzle, Daily Art, Orders), puzzle board, completed, paywall, collage, checkout, settings |
| `src/engine/` | Pure puzzle logic: piece shapes, grid sizing, snap/merge rules, print DPI checks (unit-tested) |
| `src/components/board/` | Skia board: sprite atlas of cut pieces, gestures, tray |
| `src/services/` | Supabase, RevenueCat, AdMob, Stripe, daily art, notifications. Each degrades gracefully when its keys are missing |
| `src/store/` | On-device state (SQLite key-value): puzzles, progress, settings, entitlement |
| `supabase/` | Database schema and Edge Functions (quotes, payments, Printify, webhooks, cleanup) |

## How the board stays fast

The photo is cut once into a sprite atlas (every piece pre-clipped with its bevel). Each frame draws the whole puzzle with a handful of `drawAtlas` calls whose transforms are computed on the UI thread, so dragging never waits on JavaScript and 1,000 pieces cost about the same as 30. Tray pieces outside the visible strip are culled.

## Privacy

No account and no user database. Photos, progress, streak and birth year stay on the device. The only server-side per-device data is print order status (no name, address or email; Stripe and Printify hold those). The app was built with AI assistance and has no AI features.

## Secrets

Nothing secret is in the app. The Printify token, Stripe secret key, RevenueCat secret key and Supabase service-role key exist only as Supabase function secrets. Prices are always computed on the server.
