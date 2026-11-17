# DreamSpace AI release checklist

## Product and content

- [ ] Remove or label illustrative testimonials; use only approved, verifiable customer quotes.
- [ ] Make plan prices and features match implemented billing. The current app has no payment integration.
- [ ] Replace placeholder support details with monitored contacts and a real legal operator identity.
- [ ] Publish counsel-reviewed privacy policy and terms, and link them from account creation, Profile, website, and Play listing.
- [ ] Publish the functional `/delete-account` web flow on the production domain and enter that URL in Play Console's account deletion field; test it without the app installed.
- [ ] Check all feature claims, exterior/3D descriptions, AI limitations, and estimate assumptions.
- [ ] Verify Unsplash/sample image licensing and attribution/terms for intended commercial use.

## Backend and security

- [ ] Set production `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `MONGODB_URI`, `SESSION_SECRET`, `COOKIE_SAME_SITE`, and server-only `OPENAI_API_KEY`.
- [ ] Replace development CORS origins with exact production HTTPS web origin(s) and `https://localhost` for Android and iOS.
- [ ] Configure a shared Redis or equivalent rate-limit store for multiple API replicas.
- [ ] Confirm TLS, proxy headers, secure cookies, database least privilege, backups, restores, monitoring, alerts, log redaction, and incident response.
- [ ] Decide image retention, backup expiration, and object storage plan; verify OpenAI and hosting processor terms and data retention.
- [ ] Verify how OpenAI handles request retention/deletion and configure available data controls; resolve any mismatch with account-deletion and privacy commitments before Play submission.
- [ ] Test account deletion and confirm its behavior with live data and backups.
- [ ] Re-run `npm audit` in network-enabled CI on every release and review any newly reported advisories; production dependencies currently report zero known vulnerabilities, while the Vite development toolchain reports advisories that require an upstream/breaking update.

## Functional and device QA

- [ ] Run `npm ci`, `npm run build`, `npm run test --workspace client`, and `npm run test --workspace server` in CI.
- [ ] Test the landing page and every workspace page at phone (320–430 px), tablet, and desktop sizes; check keyboard, focus, labels, contrast, and screen readers.
- [ ] Exercise signup, duplicate signup, invalid login, successful login, refresh/session persistence, logout, account deletion, guest state, and ownership isolation.
- [ ] Exercise the unauthenticated `/delete-account` web path with valid and invalid credentials, including session invalidation on other devices.
- [ ] Verify upload size/type/invalid image errors, cancellation, retry, rate limit, OpenAI success/error/timeout, save, rename, favourite, delete, and image authorization.
- [ ] Verify cost estimate inputs, edited rates and quantities, low/expected/high totals, project attachment, and PDF image/material pagination.
- [ ] Test Android photo picker, camera handoff, OS permission/cancellation, app restore, hardware back, status bar, offline API, signed-in cookie persistence, download, and long-running generation on real devices.
- [ ] Validate generated PDFs on Android/iOS/desktop readers and test file sharing/download behavior on supported browsers.

## Android and Play

- [ ] Configure production `VITE_API_BASE_URL`, run `npm run build:android`, and complete Android Studio Gradle sync.
- [ ] Create `client/android/keystore.properties`, confirm release signing is picked up, and back up the keystore and passwords securely outside the repository.
- [ ] Confirm app ID `com.dreamspaceai.app`, display name, launcher icon, splash screen, version code/name, target API 36, and release signing.
- [ ] Generate and verify a signed `.aab`; back up the signing key securely.
- [ ] Prepare phone/tablet screenshots using the final, real app build; ensure no fake customer data or placeholder dialogs appear.
- [ ] Complete Play Console app access, content rating, target audience, ads, Data safety, privacy URL, account deletion URL/process, and policy declarations.
- [ ] Upload to internal testing first, install from Play, test upgrades and account deletion, then request production review.
- [ ] Do not describe the app as released until Google Play review and publication are complete.

## iOS and App Store

- [ ] Enroll in the Apple Developer Program, install Xcode, register `com.dreamspaceai.app`, and create the App Store Connect app record.
- [ ] Run `npm run build:ios`, open with `npm run cap:open:ios`, select the signing team, and confirm version/build numbers.
- [ ] Archive and upload to App Store Connect, then test through TestFlight on a real device.
- [ ] Complete App Privacy labels, age rating (including AI questions), review notes, and a working review account.
- [ ] Keep Google sign-in hidden in the iOS build (already the default). If it is enabled later, add Sign in with Apple for guideline 4.8.
- [ ] Capture iPhone 6.9-inch and iPad 13-inch screenshots from the final build.
- [ ] Submit for review and do not describe the app as released until App Store review and publication are complete.

Step-by-step commands for both stores are in [`docs/store-release.md`](store-release.md).
