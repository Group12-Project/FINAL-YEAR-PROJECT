# Fix: FaceVector API on GitHub Pages

## Why the message appears

GitHub Pages serves static HTML/CSS/JavaScript only. It does not run `server.js`, Express, Socket.IO, or MongoDB. Teacher/Admin login, teacher registration, server roster sync, live server attendance, GPS verification, and GUARDGEN server alerts therefore need a separately hosted Node.js API and MongoDB database.

This source package now checks the GitHub Pages deployment configuration. The GitHub Actions build intentionally stops with a clear error when `FV_SERVER_URL` is missing, rather than publishing a site whose sign-in points at a nonexistent `/api` route.

## Required deployment steps

1. Deploy this repository's Node.js application to a Node-compatible host (for example, Render or Railway). The service root must be the `FaceVector-Attendance` project folder; build/install command: `npm install`; start command: `npm start`.
2. Provision MongoDB (for example, MongoDB Atlas) and copy its connection string.
3. Set these environment variables on the API host:
   - `NODE_ENV=production`
   - `MONGODB_URI=<your MongoDB connection string>`
   - `JWT_SECRET=<a cryptographically random secret of at least 32 characters>`
   - `CLIENT_ORIGIN=https://<your-github-username>.github.io` (use the exact origin; no trailing slash or repository path)
   - `ALLOW_TEACHER_SIGNUP=true` if teacher self-registration is wanted; otherwise set `false`.
   - `PORT` is normally supplied by the hosting provider; do not hard-code it.
4. Confirm the API health endpoint works: `https://<your-api-host>/api/health`. It should return JSON and report the database connection status.
5. In GitHub, open the repository: **Settings → Secrets and variables → Actions → New repository secret**. Name it exactly `FV_SERVER_URL`; value: the API base URL, e.g. `https://your-facevector-api.onrender.com` (no `/api` suffix).
6. Push the updated source to the `main` branch or manually run **Actions → Deploy website to GitHub Pages → Run workflow**. The workflow builds the website with the API URL embedded.
7. Open the GitHub Pages website and test teacher registration/login. The browser's Network panel should show requests going to `https://<your-api-host>/api/...`, not to `https://<username>.github.io/.../api/...`.

## Important

- Do not put MongoDB credentials, JWT secrets, or other private credentials in `FV_SERVER_URL`, HTML, JavaScript, or GitHub Pages files. `FV_SERVER_URL` is a public API address, not a secret credential.
- The API host must allow the exact GitHub Pages origin through `CLIENT_ORIGIN` and support HTTPS and WebSockets for live notifications.
- GitHub Pages cannot make server-side registration or attendance work by itself. If you only want a browser-only static preview, the non-server features can still be viewed, but server-backed authentication and attendance will remain unavailable.
- Create the first administrator using the documented secure CLI process (`npm run create-user`) after connecting the production database. Do not use default credentials.
