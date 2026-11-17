# DreamSpace AI privacy policy — draft for review

**Status:** Draft only. Replace every bracketed item, verify actual provider settings and retention, and obtain legal review before publication. This draft is not a statement that the service is legally compliant.

**Effective date:** [DATE]  
**Operator:** [LEGAL ENTITY / INDIVIDUAL NAME], [POSTAL ADDRESS], India  
**Privacy contact:** [PRIVACY EMAIL]

## Information we process

- **Account details:** name, email address, and a password hash when you create an account. Passwords are not stored in plain text. Profile city and preferred design style are stored with the account.
- **Project content:** project names, design selections, custom instructions, room measurements, cost estimate inputs, and saved favourites.
- **Photos and generated designs:** photos you choose to upload and the resulting AI-generated images. These are stored with your saved projects in our database. Image metadata is normalized during upload.
- **Session and technical data:** an HttpOnly session cookie, request status and timing logs, and basic technical information necessary to operate and secure the service. The Android app uses cross-origin secure session cookies for its API; the Android WebView accepts third-party cookies. The current server logs do not intentionally record passwords, photos, or request bodies.
- **Guest data:** guest project drafts and profile preferences may be stored in browser local storage on that device. Guest data is not synced to your account or server by the guest workspace.

Do not upload photos or instructions containing information you do not have permission to share. Avoid including people, identity documents, valuables, precise addresses, or other sensitive details in room images.

## How we use information

We use information to authenticate users, provide redesign and project features, create reports, calculate indicative renovation estimates, prevent abuse, secure the service, and respond to support requests. We do not currently process payments or run a notification service in this build.

When you request an AI redesign, the selected image and design instructions are sent from our API to OpenAI for image editing. OpenAI processes that request under the terms and data controls applicable to the configured API account. We need to verify those terms, deletion capabilities, and retention settings before launch; do not assume that provider processing or retention is identical to DreamSpace storage.

## Storage, sharing, and service providers

Account records, sessions, projects, and image bytes are stored in the MongoDB deployment selected by the operator. OpenAI receives the image and prompt necessary to fulfill an AI redesign request. Hosting, database, monitoring, and email/support providers may process data for us; list their legal names, processing locations, and roles here before publication: [PROVIDER LIST AND LOCATIONS].

The landing page currently loads fonts from Google Fonts and sample design imagery from Unsplash; their servers may receive connection information such as IP address and requested asset. Verify the final asset source, terms, cookies, and disclosures before launch. We do not sell personal information. We may disclose information if required by law, to protect users and the service, or as part of a business transfer, subject to applicable law and notice requirements.

## Retention and deletion

We retain account and saved project data until you delete the account or the operator removes it under a published retention schedule. The application provides account deletion in Profile settings; it deletes the account, saved projects, and stored design images from the application database. Backups and third-party processor copies may persist for their documented retention period; publish the actual periods here: [BACKUP AND PROCESSOR RETENTION].

Guest data can be removed by clearing site/app storage on the device. Account deletion does not automatically remove guest drafts stored locally on a device.

## Security

We use password hashing, authenticated project access, private image endpoints, secure session cookies in production, input validation, upload limits, and rate limits. No internet service can guarantee perfect security. The operator must maintain dependency updates, access controls, backups, incident response, and secure production configuration.

## Your choices and requests

You may update your name, city, or preferred style in Profile settings and delete your account there. For access, correction, grievance, withdrawal, or other privacy requests, contact [PRIVACY EMAIL] and provide enough information for us to verify the request. We will respond under applicable law. Add the operator's grievance contact and legally required timelines here after counsel review: [GRIEVANCE CONTACT / PROCESS].

## Children

DreamSpace AI is not designed for children under [MINIMUM AGE]. Do not create an account or upload a child's personal data. Specify the age policy and guardian process after legal and Play Families review.

## Changes and contact

We may update this notice as the product or providers change. We will post the new effective date and provide any notice required by law. Contact [OPERATOR NAME AND PRIVACY EMAIL] at [POSTAL ADDRESS].

## Compliance references for counsel

Review the [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023-1.pdf), the final [Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025%3B), and current [Google Play User Data requirements](https://support.google.com/googleplay/android-developer/answer/10144311). Confirm commencement, applicability, and duties at publication time.
