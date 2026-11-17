# DreamSpace AI

DreamSpace AI is a responsive home design platform for Indian homeowners. This repository contains a React/Vite client, an Express API and a MongoDB data layer. The client includes a public landing page and workspace screens for interior design, exterior design, 3D Studio, projects, cost estimation and profile settings.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- MongoDB 7+ for persistent users, sessions and projects (the API can start without MongoDB for UI work, but sign-in requires it)

## Quick start

1. Copy `.env.example` to `.env`, set `MONGODB_URI`, and set `SESSION_SECRET` to a random value of at least 32 characters (for example, generate one with `openssl rand -hex 32`).
2. Install dependencies from the repository root: `npm install`.
3. Start the client and API together: `npm run dev`.
4. Open <http://localhost:5173>. The API health endpoint is <http://localhost:5000/api/health>.

Useful commands: `npm run dev:client`, `npm run dev:server`, `npm run build`, and `npm start`.

## Project layout

```text
client/                  React, Vite, responsive app UI
  src/App.jsx            Landing page, dashboard and workspace navigation
  src/RedesignWorkflow.jsx  Photo upload, design choices and before/after generation UI
  src/styles.css         Design system and responsive layouts
  capacitor.config.ts    Android/iOS Capacitor app identity and web output
server/                  Express API and Mongoose persistence
  src/config/            Database connection
  src/models/            User, project and private image asset MongoDB schemas
  src/routes/            Health, authentication, projects, generation and image endpoints
  src/services/          Image normalization and OpenAI image editing
  src/middleware/        Session setup and authenticated-route guard
.env.example             Local server configuration template
```

## API foundation

- `POST /api/auth/signup` creates a user and signs them in. Body: `{ "name": "Ananya Sharma", "email": "ananya@example.com", "password": "secure-home-2026" }`.
- `POST /api/auth/login` signs in with `{ "email": "ananya@example.com", "password": "secure-home-2026" }`.
- `POST /api/auth/forgot-password` sends a single-use reset link (30-minute expiry) when email is configured through `RESEND_API_KEY` and `EMAIL_FROM`. `POST /api/auth/reset-password` stores a new bcrypt password and signs out all existing sessions. Reset tokens are stored as SHA-256 hashes, never in plain text.
- `POST /api/auth/google` verifies a Google Identity Services credential server-side (issuer, audience, verified email) and signs in or links the account. Requires `GOOGLE_CLIENT_ID` on the server; the built client reads the public client ID from `GET /api/config` at runtime. No client secret is used.
- `GET /api/auth/me` returns the current session user; `POST /api/auth/logout` destroys the session and clears its cookie.
- `PATCH /api/auth/profile` saves the signed-in user's name, city, and preferred style. `DELETE /api/auth/account` verifies the password for email accounts, or the typed account email for Google sign-in accounts, and deletes the account, saved projects, images, and sessions. The external `/delete-account` web page submits the same verified deletion request for users who no longer have the app installed.
- `GET /api/projects`, `POST /api/projects`, and `DELETE /api/projects/:id` require a session and operate only on that user's projects.
- `GET /api/projects/:id` and `PATCH /api/projects/:id` are owner-scoped. Patch supports project renaming, favourites, archiving, room measurements, up to 12 additional rooms and an itemized renovation report. `GET /api/projects?archived=1` lists archived projects; `POST /api/projects/:id/duplicate` copies the brief without duplicating image bytes. Deleting a project also removes its private image assets and planner tasks.
- Share links: `POST /api/projects/:id/share` creates a random view-only token, `DELETE /api/projects/:id/share` revokes it, and `GET /api/public/projects/:token` plus `/api/public/projects/:token/assets/:assetId` serve a sanitized project page without exposing the owner's account.
- `POST /api/designs` accepts a multipart photo plus `mode`, `roomType`, `style`, `palette`, `budget`, optional `instructions`, and the space-analysis fields `layout`, `doors` and `windows`. It requires a signed-in user and returns private before/after asset references.
- `POST /api/designs/analyze` accepts a multipart photo and returns a vision-model suggestion for room type, layout and visible door/window openings. The user reviews and edits the suggestion before generating. Set `OPENAI_VISION_MODEL` to override the default model; analysis is rate limited per user.
- `GET /api/catalog?city=Pune&quality=Standard` returns DB-backed, dated material rates and the rate-card categories used by the estimator; it falls back to built-in planning allowances when MongoDB has not been seeded. Seed data is upserted at server start.
- `POST /api/projects/:id/reference` stores an optional private reference photo with the project, and `POST /api/enquiries` records a contractor enquiry for a signed-in user's project (name, phone, city, message) with a per-user rate limit. Live contractor matching is not part of this build.
- `POST /api/projects/:id/save` saves a generated draft. `GET /api/design-assets/:assetId` serves an image only to its owner; add `?download=1` to download it.
- `GET /api/notifications`, `POST /api/notifications/read-all` and `PATCH /api/notifications/:id/read` power the workspace bell. Completed designs and recorded enquiries create notifications.
- `/api/planner` stores a private renovation checklist per user: list, add, update, delete and a standard template. Tasks can be linked to a project.
- `POST /api/feedback` records signed-in user feedback with a rating and topic. `/api/admin/*` (stats, users, roles, enquiries, feedback) requires an administrator account, configured via `ADMIN_EMAILS` or the dashboard.
- `GET /api/config` returns only the public Google client ID, if configured.
- `npm run test --workspace client` tests the pure room renovation estimator formulas and input validation.
- My Projects can generate a downloadable PDF in the browser with `jsPDF`; original, generated and reference images are fetched through the owner-checked asset endpoint before embedding. The report includes measurements, openings, itemized costs, planning assumptions and the material list. The project detail view also offers a Share action (Web Share API when available, download otherwise) and a contractor enquiry form.
- `GET /api/health` reports service and MongoDB connection state.

Passwords are hashed with bcrypt and never returned by the API. Session IDs are regenerated on signup and login, stored in MongoDB, and sent in an HttpOnly, SameSite cookie. Production requires `SESSION_SECRET`, `MONGODB_URI`, and `CLIENT_ORIGIN`; cookies use `Secure` in production. Set `COOKIE_SAME_SITE=none` only when the web client is on a different site from the API, and only over HTTPS. Auth endpoints are rate limited and validate request bodies. Guest projects remain on the current browser and are not sent to MongoDB.

The redesign workflow uses the official OpenAI Images API edit endpoint from the Node server. The OpenAI SDK sends the normalized photo as the `image` multipart upload and receives the edited image as base64. It requests `gpt-image-2.5-sunburst` with high quality, automatic sizing and JPEG output. The prompt asks the model to keep the original camera view, openings and structural layout in place. These model and parameter options are documented in the [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation) and [image edit API reference](https://developers.openai.com/api/reference/resources/images/methods/edit). Set `OPENAI_API_KEY` in the server environment only; it is never sent to the client. MongoDB stores normalized image bytes and project references, so configure a persistent MongoDB deployment and backups for production. The upload route allows JPG, PNG and WebP photos up to 8 MB and applies per-user generation limits. Paid plans still need billing integration. `client/.env.example` contains only the optional public API origin used by production web or Capacitor builds.

3D Studio generates an AI image with a 3D-inspired presentation; it is not an interactive 3D editor or exportable 3D model. Cost rates are editable planning assumptions, not live local market data. The home page story cards are explicitly illustrative, not verified customer testimonials.

## Renovation cost calculator

The Cost Estimator uses a pure, tested calculator in `client/src/lib/renovationCalculator.js`. It derives floor area as `length × width`, gross wall area as `2 × (length + width) × height`, deducts the entered door/window opening area, derives paint quantity from two coats at 100 sq. ft. per litre per coat plus 10% wastage, and tile/flooring quantities with a 10% cutting allowance. Labour is itemized into painter, carpenter, electrician, plumber, installation and transport lines instead of a single contractor line. Kitchen backsplash coverage and bathroom wall-tile coverage are stated assumptions in the UI. Rates come from the dated server catalogue (`/api/catalog`, seeded into MongoDB, effective 2026-11-01) with editable per-category overrides; the built-in allowances remain the fallback when the catalogue is unavailable. Every line quantity and unit rate is editable. Low and high ranges apply category-specific rate factors. Contingency and tax are editable percentage allowances. The tax line is not a GST determination because the tax treatment depends on the goods, services and contract; users should confirm it with their contractor. Measurement checks require length and width between 3–60 ft, height between 7–20 ft, openings between 0–500 sq. ft. and not larger than the wall area, and room area no greater than 2,000 sq. ft. An optional reference photo can be stored privately with the estimate project.

Run the complete integration flow with `npm run test --workspace server`. It starts an ephemeral MongoDB test instance and checks signup, login, logout, session persistence and rotation, password hashing, validation, rate limiting, guest access denial, project ownership, Google credential verification, password reset and session invalidation, project duplicate/archive/share, planner tasks, notifications, feedback, admin authorization and data cascades.

## Web deployment

The repository is ready for a **single-service deployment**: the multi-stage [`Dockerfile`](Dockerfile) builds the React client, and Express serves both `/api/*` and `client/dist` in production. [`render.yaml`](render.yaml) is a Render Blueprint that deploys the image with a health check. MongoDB Atlas stores all accounts, projects, images, sessions, planner tasks and notifications.

1. Create an Atlas cluster and database user, then copy the connection string.
2. Deploy the repository on Render (Blueprint) or run the image with Docker.
3. Set `MONGODB_URI`, `SESSION_SECRET`, `CLIENT_ORIGIN` (the exact HTTPS app origin), `APP_BASE_URL`, `ADMIN_EMAILS` and any optional AI/Google/email keys.

Full instructions, Atlas setup, environment tables, Google OAuth, Resend email, administrator setup and a post-deploy checklist are in [`docs/deployment.md`](docs/deployment.md).

Legal and release preparation is in [`docs/privacy-policy-draft.md`](docs/privacy-policy-draft.md), [`docs/terms-of-service-draft.md`](docs/terms-of-service-draft.md), [`docs/play-store-listing.md`](docs/play-store-listing.md), [`docs/screenshots-checklist.md`](docs/screenshots-checklist.md), [`docs/store-release.md`](docs/store-release.md), and [`docs/release-checklist.md`](docs/release-checklist.md). The published privacy/terms HTML pages are visibly marked as drafts until the operator details and legal review are complete.

## Android with Capacitor

The Android app uses the application ID `com.dreamspaceai.app` and the display name **DreamSpace AI**. Native source lives in `client/android`; generated launcher icons and light/dark splash assets are under `client/android/app/src/main/res`. Capacitor's Camera plugin opens the Android camera/gallery picker and the regular file input remains available for photo selection. Android's system back action returns through app navigation and exits from the landing screen. The native status bar uses dark icons on the app's cream background. The Android manifest includes Internet access for API requests.

### Build and sync

Install Android Studio with its bundled JDK 17 and Android SDK (API 24 or newer), then:

1. Deploy the Express API over HTTPS and set `VITE_API_BASE_URL` to its public origin in `client/.env.production.local` (for example, `https://api.your-domain.example`). This value is a public endpoint, not a secret. Do not put `OPENAI_API_KEY`, session secrets, or database credentials in any `VITE_` variable.
2. Ensure the API allows the Capacitor origin `https://localhost` via `CLIENT_ORIGIN` and serves secure cookies. For a separate API origin, configure `COOKIE_SAME_SITE=none` in production; the session cookie remains HttpOnly and Secure.
3. From the repository root run `npm run build:android`. This builds `client/dist` for production and runs Capacitor sync to copy web assets and plugins into `client/android`.
4. Open the native project with `npm run cap:open` or open `client/android` directly in Android Studio, then wait for Gradle sync.

The app reports a clear API configuration or connection error if the native build has no API origin or the API cannot be reached. A local Vite proxy is only for web development; it is not bundled as an Android API server.

### Create a signed Android App Bundle

In Android Studio, select **Build → Generate Signed Bundle / APK… → Android App Bundle**. Choose the `app` module, create or select a release keystore, enter its key alias and passwords, select the `release` build variant, then finish the wizard. Android Studio writes the signed `.aab` under `client/android/app/release/` (or the output location shown by the wizard). Keep the keystore and passwords backed up securely and out of source control; losing them can prevent updates to the same app identity. Validate the bundle with Android Studio or `bundletool` before distribution. This repository setup does not submit the app to Google Play, and no Play Store release is claimed.

For command-line builds, create `client/android/keystore.properties` with `storeFile`, `storePassword`, `keyAlias` and `keyPassword`; the release build then signs automatically with `:app:bundleRelease`. The properties file and keystore are git-ignored. For local device testing, use Android Studio's Run action or `npm run cap:run --workspace client`.

The public client template is `client/.env.example`. Set `VITE_API_BASE_URL` only in a local production env file or CI environment before the Android production build.

## iOS with Capacitor

The iOS app targets the same application ID `com.dreamspaceai.app` and display name **DreamSpace AI**. Native source lives in `client/ios` and uses Swift Package Manager (`CapApp-SPM`), so CocoaPods is not required. Bundle identifier, camera/photo-library usage descriptions, icon, splash screen, orientations and the non-exempt-encryption declaration are configured. Building and uploading require macOS with Xcode and an active Apple Developer Program membership.

1. Set `VITE_API_BASE_URL` and deploy the API as described above.
2. Run `npm run build:ios` to build the web app and sync `client/dist` plus Capacitor plugins into the Xcode project.
3. Run `npm run cap:open:ios` to open the project, select your team under Signing & Capabilities, then archive and upload through Xcode Organizer.

The App Store also requires a finalized privacy policy, App Privacy answers, screenshots for iPhone and iPad, and either Sign in with Apple or hiding the Google sign-in option. Step-by-step instructions for both stores are in [`docs/store-release.md`](docs/store-release.md).

## Environment variables

See `.env.example`. `OPENAI_API_KEY`, `SESSION_SECRET` and `MONGODB_URI` are read only by the Node server. The client has no API keys or private credentials.
