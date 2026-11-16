# TM Hub

Live task board, TM profiles and the three daily emails for Roshan's team.

**Start:** double-click `start-hub.cmd` (opens http://localhost:3100). Keep the window open; mails only go out while it runs.

| When (Mon–Sat, IST) | Mail |
|---|---|
| 11:00 | Today's task targets (per TM) + team board |
| 17:00 | Progress update (closed vs open since 11 AM) + team board |
| 20:00 | Task closure (achieved / missed, carry-forward) + team board |

The team board is one mail to you with all TMs in CC. Times, the talk-time target and on/off switches are on the **Schedule** page.

Tasks covered: onboarding, negative feedback, concerns, talk time, IC2 booked, eval booked, chapter planning missing, pending approvals.

- `team.json`: TM names, emails, photos (`public/photos`)
- `lib/lighthouse.js`: read-only Lighthouse fetches · `lib/model.js`: statuses, hints, scores · `lib/emails.js`: email HTML
- Login + email password live in `../.env` (shared with the old portal); set them on the **Settings** page.

## Sign in with Google (sending mail)

The hub sends mail through the Gmail API after you sign in with Google. Only
`@uprio.com` accounts are accepted, and the only permission asked for is
"send email on your behalf".

One-time setup, done while signed in to Google as your uprio.com account:

1. Open https://console.cloud.google.com/ and create a project (e.g. "TM Hub").
2. APIs & Services → Library → search "Gmail API" → Enable.
3. APIs & Services → OAuth consent screen → User type **Internal** → fill the
   app name and your email → Save.
4. APIs & Services → Credentials → Create credentials → OAuth client ID →
   Application type **Web application** → under "Authorised redirect URIs" add
   `http://localhost:3100/auth/google/callback` → Create.
5. Copy the Client ID and Client secret into the hub: Settings → Email →
   "Google sign-in client" → Save client.
6. Press **Sign in with Google** and pick your uprio.com account.

The sign-in is kept in `data/google.json`; "Sign out" in Settings removes it.

## Animation libraries

Three libraries are bundled into `public/bits.js` (styles in `public/bits.css` and `public/magic.css`) by `npm run build:bits`:

- React Bits (`../react-bits`): Aurora, BlurText, ShinyText, GradientText, TiltedCard, SpotlightCard.
- Magic UI (`../magicui`): BorderBeam, Marquee, ShineBorder. Their Tailwind classes are compiled from `bits/magic.css`.
- GSAP + ScrollTrigger (npm `gsap`): scroll progress bar, reveal-on-scroll and banner parallax, in `scrollFx()` in `public/app.js`.

To add another component, import it in `bits/entry.jsx`, add its file to `bits/magic.css` if it is from Magic UI, and rebuild.
