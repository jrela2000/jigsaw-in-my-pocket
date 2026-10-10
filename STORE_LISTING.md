# Store listing

## Basics

| | |
|---|---|
| Name | Jigsaw In My Pocket |
| Subtitle (iOS, 30 chars) | Photo puzzles you can print |
| Short description (Play, 80 chars) | Turn your photos into calm jigsaw puzzles, then order the real one. |
| Category | Games › Puzzle (secondary: Lifestyle) |
| Price | Free, with subscription and physical purchases |

**Description**

Turn any photo into a jigsaw puzzle and solve it at your own pace. When you finish, order the same picture as a real, printed puzzle, delivered to your door.

- Your photos, your puzzles: 30 to 1,000 pieces, with optional piece rotation
- Photos stay on your phone. No account, no sign-up, no user database
- A new public-domain museum masterpiece to solve every day, with streaks
- Collage puzzles from 2 to 9 photos
- Sort by edges and colour, zoom, hints, five board backgrounds
- Fair pricing: free up to 110 pieces; Pro is $3.99 a month or $24.99 a year. No weekly plans

Jigsaw In My Pocket Pro removes ads, unlocks every size, gives unlimited hints and collage layouts, and takes 15% off printed puzzles. Subscriptions renew automatically until cancelled in your store account settings.

**Keywords (iOS):** jigsaw, photo puzzle, custom puzzle, puzzle maker, daily puzzle, art puzzle, collage, relaxing, print

## Age and audience

- **Apple:** complete the age-rating questionnaire honestly (no objectionable content; "Unrestricted web access": No; ads: Yes). **Do not** opt into the Kids category.
- **Google Play:** Target audience **13 and over** only. Ads: Yes. Complete the content rating questionnaire (IARC).
- The app asks for birth year on first launch with a neutral picker. Ads are non-personalised for everyone. Under 13: child-directed ad treatment and no print ordering.

## Screenshots to capture (6.7" iPhone, 6.5" iPhone, 12.9" iPad if supporting tablets, Android phone)

1. Puzzle board mid-solve with the piece tray — "Your photo, your puzzle"
2. Home gallery with the daily masterwork — "A new masterpiece every day"
3. Piece-count picker — "30 to 1,000 pieces"
4. Completed screen with the print offer — "Solve it, then order the real one"
5. Collage studio — "Up to nine photos in one puzzle"
6. Settings privacy card — "Everything stays on your phone"

Use your own photos or public-domain art in screenshots; do not show other people's copyrighted images.

## Apple privacy "nutrition label" (App Privacy)

| Data type | Collected? | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Identifiers — Device ID | Possibly, by the AdMob SDK on the free tier (confirm against Google's current SDK disclosure) | No | **No** — the app never requests tracking | Third-party advertising (non-personalised) |
| Identifiers — User ID (anonymous ID) | Yes | Yes | No | App functionality |
| Purchases — Purchase history | Yes (RevenueCat) | Yes | No | App functionality |
| Contact info — Name, physical address, email | Only when ordering a print; sent to Stripe and Printify, not stored by us | Yes | No | App functionality (order fulfilment) |
| User content — Photos | Yes, **only** when ordering a print; deleted 30 days after delivery | Yes | No | App functionality |
| Usage data — Advertising data, product interaction | Yes (AdMob) | No | No | Third-party advertising (non-personalised), analytics |
| Diagnostics — Crash/performance data | Yes (AdMob SDK) | No | No | Analytics |
| Financial info — Payment info | **No** (handled by Apple, Google and Stripe; never reaches our servers) | | | |

The app does not show the tracking permission prompt (ATT) and answers "No" to "used to track you" for every data type.

## Google Play Data safety

- **Data collected:** Approximate location: No. Personal info: name, email, address (optional, print orders only; passed to Stripe and Printify). Photos: optional (print orders only). App activity: app interactions (ads SDK). Device or other IDs: advertising ID (ads), anonymous ID. Purchase history. Birth year is stored on the device only and is not collected.
- **Data shared with third parties:** Advertising ID and app interactions with Google AdMob (advertising). Name and address with Printify (order fulfilment — counts as a service provider, declare under "processed"). Payment handled by Stripe/Google.
- **Encrypted in transit:** Yes.
- **Users can request deletion:** Yes — Settings › Erase my cloud data. Provide the same instructions at a web URL for the Play form.
- **Ads:** Yes, contains ads. Declare use of the advertising ID.

## Review notes for Apple

- Physical puzzles are physical goods, paid with Stripe (Apple Pay / card), as permitted by guideline 3.1.3(e). The Pro subscription uses In-App Purchase only.
- No login is required and there is no user account. Data deletion is under Settings › Erase my cloud data.
- AI disclosure: the app was built with AI assistance and contains no AI features.
- Rewarded ads unlock a single large puzzle or extra hints on the free tier.

## Release checklist

- [ ] Every item in `SETUP_CHECKLIST.md` ticked, with **live** keys in the `production` EAS environment
- [ ] `npm test` and `npm run typecheck` pass
- [ ] One full test on a real iPhone and a real Android phone: 1,000-piece puzzle performance, a sandbox subscription purchase and restore, a test-mode print order end to end
- [ ] Production build → TestFlight and Play internal testing → at least a week of testing → submit for review
