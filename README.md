# 💗 CampusCrush

A pink, fun dating site for university students across South Africa.
React + Vite on the front, Supabase (Postgres, Auth, Storage, Realtime) on the back.

## What it does
- Sign up, sign in, forgot / reset password (email links)
- 18+ only, enforced in the database
- Profile: name, age, gender identity, optional visible orientation, height, dating intention, university, city, bio, interests, music and lifestyle preferences
- 5–6 photos required to discover or be discovered; all profile photos are visible to people you meet
- Mutual gender-preference matching and editable age and distance preferences (5 km up to all of South Africa)
- Swipe forward to like or pass (no undo), **6 like credits per day** (enforced on the server, resets at midnight SA time)
- New profiles receive one 30-minute boost to appear first to people who match their preferences
- Mutual likes become a match and unlock live text and voice-note chat
- Shows an "Active now" status while a member is using the app
- Block (hides you both, deletes the chat) and Report
- Hinge-style design in plum and black with a floating tab bar, profile cards, swipe-to-like/pass, and a heart on profile cards
- Likes You (people waiting for your answer), Pause, Block list with unblock, Download my data, Delete account
- Privacy Policy, Terms, Safe dating tips and Member principles pages
- Light and dark mode switches (top bar and Settings)
- Installable as an app (PWA) with favicon and app icons

## Set it up (about 10 minutes)

1. **Create a Supabase project** at https://supabase.com (free tier is fine).
2. **Create the database:** Dashboard → SQL Editor → New query → paste all of `supabase/schema.sql` → Run (click "Run query" on the warning).
   Then run `supabase/update_1.sql` (adds Pause, Likes You, Block list, Delete account), `supabase/update_2.sql` (repairs photo upload policies and makes photo storage private), `supabase/update_3.sql` (adds profile preferences, presence, boosts, six daily likes, five-photo discovery, and private voice notes), and `supabase/update_4.sql` (restricts profile and photo access to eligible members and matches). Existing projects should run all four update scripts in order.
3. **Add your keys to the hidden `.env` file** (already in `.gitignore`, so it is never uploaded to GitHub):
   - Dashboard → Project Settings → API
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = `anon` `public` key
   - Never use the `service_role` key here.
4. **Allow your site address for email links:** Authentication → URL Configuration
   - Site URL: `http://localhost:5173` (change to your real domain when you deploy)
   - Redirect URLs: add the same address(es)
5. **Run it:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:5173

While testing you can switch off email confirmation (Authentication → Providers → Email → "Confirm email").
Supabase's built-in email sender is restricted and is not suitable for launch. Before publishing,
configure a production SMTP provider in Authentication → SMTP Settings, verify the sender/domain
with that provider, and test signup confirmation and password-reset emails using your deployed URL.
Your SMTP provider can have its own sending quotas, so choose a plan appropriate
for expected usage. The app replaces Supabase's raw email rate-limit response with a retry message,
but only the Supabase/provider configuration can prevent sending limits from stopping email delivery.

## Put it online
Push to GitHub, then import the repo into Netlify or Vercel. Add the two `VITE_` variables in the host's
"Environment variables" settings (they read them instead of your local `.env`). Build command: `npm run build`,
output folder: `dist`. Then update the Site URL in Supabase to your live address.

## Android app and Google Play

The Android project uses Capacitor and the permanent application ID `com.campuscrush.app`.

1. Install Android Studio and its Android SDK, then open the project with `npm run android:open`. Voice notes request microphone access when recording.
2. Before a release build, configure the production Supabase project, working email delivery, and authentication redirect URLs. The app's current auth links use the app's URL; test signup, email confirmation, password reset, and sign-in on a physical Android device.
3. Run `npm run android:sync` to build the web app and copy its latest assets into Android.
4. In Android Studio, build a **signed Android App Bundle (.aab)** for release. Create and securely back up an upload key; never commit signing credentials.
5. Create a Google Play Console developer account, upload the AAB to an internal testing track, and complete Play Console's required app content, age rating, Data safety, and testing declarations before requesting production access.

Before submitting, publish a public privacy-policy page and provide working support/contact details. Verify account deletion and user-report/block flows, and complete the Play Console declarations for personal data, location, photos, and messages. Google Play review and testing requirements apply; building the AAB does not guarantee approval.

For a web install, open the deployed site on a phone and choose "Add to Home Screen" / "Install app".

## Safety and legal notes
- The `anon` key is designed to be public. Row Level Security and the private-photo access rules are defined in the Supabase SQL scripts, including `update_4.sql`.
- Photos are stored in a private bucket and served through short-lived signed URLs only to authorized members.
- Exact coordinates are private to each user. Others only see "X km away".
- Reports land in the `reports` table. Check it in the Supabase dashboard and act on it.
- Before real launch you need a privacy policy and terms. South Africa's POPIA law applies because you store personal information.
- Real dating apps also use ID or selfie checks and active moderation. Consider adding them as you grow.


## Before you publish: checklist
1. Run `schema.sql`, `update_1.sql`, `update_2.sql`, `update_3.sql`, and `update_4.sql` in Supabase, in that order. Existing projects should run the update scripts in order.
2. Change `SUPPORT_EMAIL` in `src/lib/constants.js` to a real inbox you check.
3. Have a South African lawyer read the Privacy Policy and Terms in `src/components/InfoPage.jsx`. They are drafts.
4. Supabase → Authentication → URL Configuration: set Site URL and Redirect URLs to your live address.
5. Supabase → Authentication → SMTP Settings: add a real email sender, or sign-up emails will hit the free limit fast.
6. Add the two `VITE_` variables in Netlify/Vercel settings. Do not upload `.env`.
7. Check the `reports` table regularly and act on reports.
8. Not built yet: selfie verification, push notifications, email notifications, changing your email address, unread message badges.
