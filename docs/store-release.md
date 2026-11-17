# Store release guide (Google Play and App Store)

This guide covers building and submitting the DreamSpace AI mobile apps. Publishing is done from your own Play Console, Apple Developer and App Store Connect accounts; no release is submitted by this repository.

## Current readiness

| Item | Status |
| --- | --- |
| Android app (`client/android`) | Ready to build; release signing wiring added |
| iOS app (`client/ios`) | Project added with Swift Package Manager (no CocoaPods), bundle ID and permissions configured |
| App ID / display name | `com.dreamspaceai.app` / DreamSpace AI on both platforms |
| Icons and splash | Shared from `client/assets`, copied into both native projects |
| Version | Android `1` / `1.0`; iOS build `1` / `1.0` |
| Backend | Must be deployed on HTTPS before the mobile build (see below) |
| Privacy policy / terms | Still drafts; must be finalized and published at a public HTTPS URL |
| Google Play Console | Account available; app still needs to be created and the AAB uploaded |
| Apple Developer Program | Not yet active; required before Xcode can upload to App Store Connect |

## Shared prerequisites

1. Deploy the Express API with MongoDB Atlas over HTTPS (see `docs/deployment.md`).
2. Set `VITE_API_BASE_URL` to the deployed API origin in `client/.env.production.local`, for example `https://api.your-domain.example`. This is a public URL, never a secret.
3. On the server set `CLIENT_ORIGIN` to the exact web origin **and** `https://localhost` (the Capacitor app origin), `COOKIE_SAME_SITE=none`, `APP_BASE_URL` to the public site, and secure cookies/TLS.
4. Finalize `docs/privacy-policy-draft.md` and `docs/terms-of-service-draft.md` with the real operator identity and support contact, publish them at public HTTPS URLs, and link them from the app. Store reviews reject draft legal pages and placeholder contacts.
5. Prepare a review test account with some saved projects, and keep its credentials available for the store review forms.
6. Capture screenshots from the final store build, not from a browser or emulator with chrome visible. See `docs/screenshots-checklist.md`.

Rebuild after any config or web change:

```bash
npm run build:mobile   # builds client/dist, then syncs Android and iOS
```

## Android (Google Play)

### 1. Create the upload keystore (once)

Use the JDK bundled with Android Studio if no system Java is installed:

```bash
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -genkeypair -v \
  -keystore client/android/dreamspace-release.jks \
  -alias dreamspace \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep the `.jks` file and both passwords backed up outside the repository. Losing this key prevents updates to the same listing unless Play App Signing key reset is approved.

Create `client/android/keystore.properties` (already git-ignored):

```properties
storeFile=dreamspace-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=dreamspace
keyPassword=YOUR_KEY_PASSWORD
```

### 2. Build a signed AAB

```bash
npm run build:android
cd client/android
./gradlew bundleRelease
```

Output: `client/android/app/build/outputs/bundle/release/app-release.aab`.

With `keystore.properties` present, the release build is signed automatically. Without it, Gradle produces an unsigned AAB that Play rejects, so never upload that artifact.

For direct device testing, use Android Studio or `npm run cap:run --workspace client`.

### 3. Publish in Play Console

1. **Create app**: name, default language, app, free, accept declarations.
2. **Store listing**: name `DreamSpace AI: Home Design`, short/full description from `docs/play-store-listing.md`, app icon, feature graphic, phone and tablet screenshots.
3. **App content**:
   - Privacy policy: public HTTPS URL.
   - App access: provide the review account; mark any login-gated features.
   - Ads: no ads.
   - Content rating: complete the questionnaire; declare AI-generated content where asked.
   - Target audience: adults/general home-design audience, not children.
   - Data safety: account data, photos/prompts, designs and diagnostics as applicable; data encrypted in transit; deletion available in-app and via the web deletion URL. Photos and prompts are sent server-side to OpenAI, so sharing must be declared.
   - Account deletion: public HTTPS `/delete-account` URL on the deployed site.
   - AI-generated content policy: the app creates AI images and users can report problematic output through Feedback; follow the current Play AI-generated content requirements.
4. **Testing**: upload the AAB to internal testing, install from Play, verify login, upload, generation, PDF download, account deletion, and an upgrade from the previous build.
5. **Production**: promote the tested release and submit for review. Do not call the app published until review completes.

### 4. Version updates

In `client/android/app/build.gradle` increase both values for every upload:

```gradle
versionCode 2
versionName "1.0.1"
```

`versionCode` must always increase; Play rejects duplicates.

## iOS (App Store)

The iOS project uses Swift Package Manager (`client/ios/App/CapApp-SPM`), so CocoaPods is not required. It was generated on a machine without Xcode; the first build must be done on a Mac with Xcode installed.

### 1. Prerequisites

1. Enroll in the Apple Developer Program (annual fee, currently 99 USD/year in most regions) and accept the agreements in App Store Connect.
2. Install Xcode from the Mac App Store, open it once, and install an iOS simulator/runtime.
3. Create an App Store Connect app record with bundle ID `com.dreamspaceai.app` (register the identifier in the developer portal first).

### 2. Open and sign the project

```bash
npm run build:ios
npm run cap:open:ios
```

In Xcode select the **App** target → **Signing & Capabilities**:

- Team: your Apple Developer team.
- Bundle Identifier: `com.dreamspaceai.app`.
- Automatically manage signing: on (Xcode creates the provisioning profile).
- Version `1.0`, Build `1`.

The following are already configured:

- Display name `DreamSpace AI`.
- Camera and photo-library usage descriptions.
- `ITSAppUsesNonExemptEncryption=false` (the app only uses standard HTTPS).
- Phone and tablet orientations.

### 3. Archive and upload

1. Select **Any iOS Device (arm64)** as the destination.
2. **Product → Archive**.
3. In Organizer choose **Distribute App → App Store Connect → Upload**.
4. Complete App Store Connect processing, then test with TestFlight on a real device.

### 4. App Store Connect listing

- Name: `DreamSpace AI: Home Design` (30 character limit), subtitle and description from `docs/play-store-listing.md`.
- Support URL and marketing URL: public HTTPS pages.
- Privacy policy URL: public HTTPS page.
- Screenshots: iPhone 6.9-inch and iPad 13-inch sets (the target supports both). See `docs/screenshots-checklist.md`.
- App Privacy: declare contact info, user content (photos/prompts/designs), identifiers and usage data as applicable, linked to the user, encrypted in transit, deletion available in the app.
- Age rating: complete the current questionnaire, including the AI-generated content questions.
- App Review notes: test account, explanation that AI images are concepts and estimates are indicative.

### 5. Sign-in requirement (Apple guideline 4.8)

Google sign-in is already hidden inside native builds (`googleClientId && !Capacitor.isNativePlatform()` in `App.jsx`), so the iOS app currently offers only email/password and guideline 4.8 is not triggered. If Google sign-in is ever enabled on iOS, add **Sign in with Apple** or remove the Google option before submitting.

### 6. Version updates

In Xcode set **Version** (marketing) and **Build** (must increase for every upload). Alternatively set `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `client/ios/App/App.xcodeproj/project.pbxproj`. Upload a new archive the same way.

## Release checklist

- [ ] API deployed on HTTPS, Atlas connected, production env vars set.
- [ ] `VITE_API_BASE_URL` set and `npm run build:mobile` completed.
- [ ] Android `keystore.properties` present, AAB signed, keystore backed up.
- [ ] Version numbers bumped for this release.
- [ ] Privacy policy/terms finalized and live; support contact real.
- [ ] Review account works and is documented in both consoles.
- [ ] Screenshots captured from the final build on real device sizes.
- [ ] Play Data safety, content rating, app access, account deletion URL complete.
- [ ] Apple privacy labels, age rating and review notes complete.
- [ ] Sign in with Apple resolved for iOS.
- [ ] Internal testing/TestFlight passed; production submitted from your accounts.

## Useful commands

```bash
npm run build:android   # web build + Android sync
npm run build:ios       # web build + iOS sync
npm run build:mobile    # web build + sync both platforms
npm run cap:open        # Android Studio
npm run cap:open:ios    # Xcode workspace/project
```
