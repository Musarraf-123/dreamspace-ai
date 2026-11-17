# DreamSpace AI — deployment guide

This project deploys as **one Node service** that serves:

- `/api/*` — Express API
- the built React app from `client/dist`
- `/api/public/projects/:token` — view-only shared project links

All application data is stored in **MongoDB Atlas**:

| Collection | Contents |
| --- | --- |
| `users` | accounts, roles, Google identity |
| `projects` | designs, measurements, estimates, rooms, share tokens |
| `designassets` | original, generated and reference images (binary in MongoDB) |
| `sessions` | server-side login sessions |
| `notifications` | in-app notifications |
| `plantasks` | renovation planner tasks |
| `feedbacks` | in-app feedback |
| `enquiries` | contractor enquiries |
| `passwordresets` | hashed, single-use reset tokens |
| `materials`, `ratecards` | seeded material catalogue and dated rate cards |

No application data is written to the container filesystem, so the service can restart or redeploy without losing data.

---

## 1. Create MongoDB Atlas

1. Sign in at <https://cloud.mongodb.com> and create a free **M0** cluster.
2. Choose a region close to your hosting region.
3. **Database Access → Add New Database User**
   - Authentication: password
   - Role: `Read and write to any database`
4. **Network Access → Add IP Address**
   - Render / Railway / Fly run from dynamic IPs. For these, add `0.0.0.0/0` and rely on the database password plus Atlas TLS.
   - If your host offers static outbound IPs, allow only those.
5. **Connect → Drivers** and copy the `mongodb+srv://...` string. Replace `<password>` with the database user password and add the database name:

```
mongodb+srv://dreamspace_user:PASSWORD@cluster0.xxxxx.mongodb.net/dreamspace_ai?retryWrites=true&w=majority
```

Store this only in your hosting provider's environment settings. Never commit it.

The app creates collections and indexes automatically on first use. It also seeds the material catalogue and dated rate cards at startup.

---

## 2. Deploy to Render

The repository includes `render.yaml` and a multi-stage `Dockerfile`.

1. Push the repository to GitHub. Confirm `.env` is not committed.
2. In Render: **New → Blueprint** and select the repository.
3. Render reads `render.yaml` and creates a Docker web service on the free plan.
4. Fill the values marked `sync: false`:

| Variable | Value |
| --- | --- |
| `CLIENT_ORIGIN` | Exact app origin, e.g. `https://dreamspace-ai.onrender.com` |
| `APP_BASE_URL` | Same app origin (used in password-reset emails) |
| `MONGODB_URI` | Atlas connection string |
| `ADMIN_EMAILS` | Your admin email address (comma-separate more) |
| `GOOGLE_CLIENT_ID` | Optional Web OAuth client ID |
| `OPENAI_API_KEY` | Server-side OpenAI key for AI generation |
| `RESEND_API_KEY` | Optional Resend API key for reset emails |
| `EMAIL_FROM` | Verified sender, e.g. `DreamSpace AI <no-reply@yourdomain.com>` |

`SESSION_SECRET` is generated automatically. `NODE_ENV=production`, `PORT=5000`, `COOKIE_SAME_SITE=lax` and the OpenAI vision model are preset.

5. Deploy. The health check is `GET /api/health`.
6. Open the service URL. The built React app is served from the same origin, so the API needs no CORS entry for itself beyond `CLIENT_ORIGIN`.

### Custom domain

1. Add the domain in Render and complete DNS.
2. Update `CLIENT_ORIGIN` and `APP_BASE_URL` to the custom HTTPS origin and redeploy.
3. Add the new origin to the Google OAuth client (see below).

---

## 3. Deploy with Docker anywhere

```bash
docker build -t dreamspace-ai .
docker run --rm -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e CLIENT_ORIGIN=https://your-domain.example \
  -e APP_BASE_URL=https://your-domain.example \
  -e MONGODB_URI='mongodb+srv://...' \
  -e SESSION_SECRET='a-random-secret-at-least-32-characters' \
  -e ADMIN_EMAILS='you@example.com' \
  -e OPENAI_API_KEY='...' \
  dreamspace-ai
```

Production cookies are `Secure`, so logins require HTTPS. For a local HTTP smoke test only, run the image with `NODE_ENV=development` and `SERVE_CLIENT=true` (the production security checks and secure cookies are relaxed in development).

Do not use `docker run -v .env` or bake `.env` into the image.

---

## 4. Environment variables

Server-only variables are defined in `.env.example`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas connection string |
| `SESSION_SECRET` | production | 32+ character cookie/session secret |
| `CLIENT_ORIGIN` | production | Exact HTTPS origin(s), comma-separated |
| `APP_BASE_URL` | recommended | Public app URL for reset links |
| `PORT` | no | Defaults to `5000` |
| `NODE_ENV` | yes | `production` on the host |
| `COOKIE_SAME_SITE` | no | `lax` for one domain, `none` for a native app calling a separate API |
| `ADMIN_EMAILS` | recommended | Comma-separated administrator emails |
| `GOOGLE_CLIENT_ID` | optional | Server-side Google token audience; also served to the client via `/api/config` |
| `OPENAI_API_KEY` | optional | AI image editing; without it generation returns a clear 503 |
| `OPENAI_VISION_MODEL` | no | Defaults to `gpt-4.1-mini` |
| `RESEND_API_KEY` | optional | Sends password-reset email |
| `EMAIL_FROM` | optional | Verified Resend sender |
| `SERVE_CLIENT` | local only | `true` serves `client/dist` outside production |

Never put secrets in `client/.env`, `VITE_*` variables, or the Docker image. `VITE_*` values are compiled into the browser bundle.

---

## 5. Google sign-in (optional)

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
2. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://your-domain.example`
3. No redirect URI is required; the app uses Google Identity Services.
4. Put the **client ID** in the server's `GOOGLE_CLIENT_ID`. The client fetches it from `/api/config` at runtime, so no rebuild is needed.
5. There is no client secret in this flow. Keep it that way.

---

## 6. Password-reset email (optional)

Without email configuration, the reset flow still works in development: the API returns a `resetUrl` only when `NODE_ENV !== 'production'` and email is not configured. In production the response never includes the token.

To send real email with [Resend](https://resend.com):

1. Add and verify your sending domain.
2. Create an API key.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` (`DreamSpace AI <no-reply@yourdomain.com>`).
4. Links use `APP_BASE_URL/?reset=...` and expire after 30 minutes. Reset tokens are stored as SHA-256 hashes, are single-use, and invalidate all existing sessions.

---

## 7. Administrator access

1. Set `ADMIN_EMAILS` in the server environment before or after creating the account.
2. At startup, matching users are promoted to `role: admin`; the middleware also checks `ADMIN_EMAILS` on every request.
3. Sign in and open **Admin dashboard** in the sidebar.
4. Administrators can view users, promote/demote roles, update enquiry status, and review feedback. Accounts listed in `ADMIN_EMAILS` cannot be demoted from the dashboard; remove them from the variable instead.

---

## 8. Operational notes

- **Backups:** Atlas M0 does not include automated backups. Upgrade the cluster or schedule `mongodump`; test restores.
- **Image storage:** design images live in MongoDB (`designassets.data`). M0 has a 512 MB storage limit. Move image blobs to object storage if you expect volume.
- **Rate limits:** `express-rate-limit` uses in-memory storage. Run one instance per container, or add a shared store (e.g. Redis) before scaling horizontally.
- **Sessions:** persisted in MongoDB, so redeploys do not sign everyone out. `rolling: true` refreshes active sessions.
- **Security headers:** Helmet with a Google-aware CSP; CORS + exact-origin checks; private images require the owning session; shared images require a valid share token.
- **Account deletion:** removes the user, projects, images, assets, notifications, planner tasks, feedback, enquiries, reset tokens and stored sessions.

### Post-deploy checklist

- [ ] `GET /api/health` returns OK.
- [ ] Sign up with email, reload, and confirm the session persists.
- [ ] Generate a design (or confirm the clear 503 when `OPENAI_API_KEY` is absent).
- [ ] Save a renovation estimate; confirm it appears in **My Projects**.
- [ ] Duplicate, archive and restore a project.
- [ ] Create a share link and open it in a private window; turn it off and confirm 404.
- [ ] Add planner tasks and reload.
- [ ] Request a password reset and complete the flow.
- [ ] Sign in as an admin and load the dashboard.
- [ ] Confirm `CLIENT_ORIGIN` matches the browser origin exactly (login fails otherwise).
