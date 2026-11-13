# FaceVector Attendance — project audit

Audit date: 2026-11-09

## Automated checks performed

- `npm test`: PASS — project structure/reference checks, all-page static audit, 28 Node tests, and static security lint.
- `node scripts/check-globals.js`: PASS — no conflicting top-level declarations across page scripts.
- All 19 top-level HTML pages: PASS — local `href`/`src`/`action` references resolve; no duplicate IDs; in-page anchors resolve.
- JavaScript syntax checks: PASS — included in the project check.
- ZIP integrity: PASS — verified after packaging.

## Security lint warnings

The static security check reports four warnings for third-party CDN scripts without Subresource Integrity (SRI): face-api.js on attendance, lab, and register pages, and Leaflet on GPS monitoring. The scripts are version-pinned, but the warning remains. This lint is not a penetration test or a guarantee of security.

## Checks not completed in this environment

- Browser end-to-end suite: NOT RUN — Playwright is installed but its Chromium executable is not present. Install it with `playwright install chromium` and rerun `npm run test:e2e`.
- Live API/database integration: NOT RUN — MongoDB (`mongod`) and the npm runtime dependencies are not available in this environment. The app needs a configured `.env`, running MongoDB, and `npm install` before registration, login, CRUD, attendance, Socket.IO, and geofence integration can be exercised.
- Real camera, face-model CDN download, GPS hardware/permissions, HTTPS deployment, mobile browser behavior, and Android APK runtime: NOT VERIFIED here.

## Important operational notes

- Use Node.js 18+ and MongoDB 6+; see `RUN-LOCALLY.md`.
- Configure a unique `JWT_SECRET` of at least 32 characters and a correct `MONGODB_URI` in `.env`.
- Create the first administrator using `npm run create-user`; there are no default credentials.
- Camera and GPS require `localhost` or HTTPS. Do not use a plain HTTP LAN address for real device tests.
- Run the manual integration checklist in `TESTING.md` before using the system for official attendance. Face recognition is probabilistic and must not be the sole high-stakes identity control.
