# Releasing on the App Store

The iOS app is the Next.js static export (`out/`) wrapped with [Capacitor](https://capacitorjs.com). The
native project lives in `ios/`. Everything here is done once unless noted.

## What you need

- An [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).
- A Mac with the current Xcode (Capacitor 8 uses Swift Package Manager; no CocoaPods needed).
- The deployed website (e.g. on Vercel). It hosts the privacy/support URLs Apple asks for and the
  password-reset page that emailed links open.

## 1. Supabase

Run these in the Supabase SQL Editor if you haven't already:

- `supabase/collection_cards.sql`: table behind My Collection.
- `supabase/delete_my_account.sql`: in-app account deletion (Apple requires it for apps with sign-up).
- `supabase/wants_and_copies.sql`: want list and copy details (quantity, condition, grade, price paid).
- `supabase/admin.sql`: anonymous feedback, announcements and the `/admin` dashboard. Then make
  yourself an admin with the `INSERT INTO public.admins …` line at the top of that file.

Under **Authentication → URL Configuration**, add `https://<your-site>/reset-password` to **Redirect URLs**.

## 2. Environment variables

Set these for the web deployment **and** in `.env.local` on the Mac that builds the iOS app (they're
baked into the bundle at build time):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | The deployed site, e.g. `https://pocketi.app`. Password-reset emails link here (the app's own origin, `capacitor://localhost`, can't be opened from email). |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | The address shown on the Support and Privacy pages. Apple reviews these. |

## 3. App identity

- **Bundle ID**: `capacitor.config.ts` (`appId`) and Xcode → App target → Signing & Capabilities. It's
  `com.pocketi.app` now; change it to one you own (e.g. `com.yourname.pocketi`) and
  register it in App Store Connect.
- **Version**: Xcode → App target → General (`MARKETING_VERSION` 1.0, build `CURRENT_PROJECT_VERSION` 1).
  Increase the build number for every upload.
- **Icon / splash**: `resources/icon.svg` is the source. The rendered `resources/icon.png` (1024×1024, no
  alpha) is already in `ios/App/App/Assets.xcassets`. To regenerate everything from it:
  `npx @capacitor/assets generate --ios`.
- The app is iPhone-only (it still runs on iPad in compatibility mode). This avoids needing iPad
  screenshots and an iPad review; add iPad later by setting `TARGETED_DEVICE_FAMILY = "1,2"`.

## 4. Build and upload

```bash
npm install
npm run ios:sync    # next build + copy out/ into ios/
npm run ios:open    # opens Xcode
```

In Xcode: pick your team under Signing & Capabilities → choose **Any iOS Device (arm64)** → **Product →
Archive** → **Distribute App → App Store Connect**. Run `npm run ios:sync` again after every web change.

Test on a real iPhone first (plug it in, select it, press Run), and through **TestFlight** before submitting.

## 5. App Store Connect listing

- **Privacy Policy URL**: `https://<your-site>/privacy`
- **Support URL**: `https://<your-site>/support`
- **App Privacy** questionnaire: *Contact Info → Email Address* and *User Content → Other User Content*
  (collection data), both **linked to the user**, used for **App Functionality**, **not used for tracking**.
  No other data types.
- **Age rating**: no objectionable content. Answer "No" throughout, giving 4+.
- **Screenshots**: 6.9" iPhone (1320×2868 or 2868×1320) is required; take them in the Simulator
  (iPhone 17 Pro Max) with ⌘S.
- **App Review notes**: include a demo account (email + password) with a few tracked sets so the
  reviewer can sign in. Mention that card data comes from TCGdex.
- **Category**: Reference (or Utilities).

## ⚠️ Trademark risk (read before submitting)

Apple rejects apps that use other companies' trademarks without permission (Guideline 5.2.1), and
Nintendo/The Pokémon Company actively enforce theirs. To reduce the risk:

- Keep "Pokémon" **out of the app name, subtitle and icon**. The name is "pocketi"; a subtitle like
  "Master set tracker for TCG collectors" is safer than any wording containing "Pokémon".
- "pocketi" sits close to "Pokémon TCG Pocket" (The Pokémon Company's own app). Check the name isn't
  taken or confusingly similar before submitting: search the App Store and USPTO/EUIPO trademarks.
- Keep the "unofficial, not affiliated" disclaimer (on the Support page) and say the same in the App Store
  description.
- Card images are copyrighted. Collection apps that show them do get approved, but Apple may still ask
  for proof of rights. If that happens, the usual answer is that images are displayed for
  identification only, sourced from TCGdex, with no affiliation claimed.

## Other review pitfalls this repo already handles

- **Account deletion in-app** (5.1.1(v)): Account → Delete Account.
- **Privacy policy reachable in-app**: sign-in screen and Account page.
- **No broken features** (2.1): the barcode scanner needs an API iOS doesn't have, so on iPhone the
  Scan button is hidden instead of showing a camera that never detects anything.
- **Camera usage string** and **export compliance** (`ITSAppUsesNonExemptEncryption = NO`) are in
  `ios/App/App/Info.plist`.
- **Notch / home indicator**: the layout uses `viewport-fit=cover` with safe-area padding.
- **Minimum functionality** (4.2): the app bundles its UI rather than loading a website, and uses
  native haptics (marking cards, completing a set). A share sheet or push notifications would
  further reduce the chance of a "just a website" rejection.
