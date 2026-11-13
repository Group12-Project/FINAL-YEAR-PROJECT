# FaceVector Attendance AI

The original eight-page HTML/CSS/JavaScript site remains intact. It still supports browser-only registration and attendance. An optional Express/MongoDB backend adds server-verified face matching, live attendance, role-based Teacher/Admin/GUARDGEN portals, live GPS/geofence checks, audit events, and authenticated Socket.IO notifications.

## Requirements and setup

- Node.js 18 or later
- MongoDB 6 or later
- HTTPS in production; `localhost` is accepted for camera and geolocation during development
- Browser camera permission for face scanning; browser location permission for GPS checks

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Generate a random JWT secret of at least 32 characters and set `JWT_SECRET`.
4. Set `MONGODB_URI` and `CLIENT_ORIGIN` for the server origin(s).
5. Start MongoDB, then run `npm start`.
6. Open `http://localhost:3000/`.

The Express server serves the website and `/api` from the same origin. For a separate static host, configure it to proxy `/api` and `/socket.io` to Node, set `CLIENT_ORIGIN` to the website origin, and use HTTPS.

## Teacher workflow (sign in once, then take attendance)

1. The teacher registers on `teacher-login.html` (small **New teacher? Register** link under the sign-in form: name, email, classes, password) and is signed in immediately. An Admin can still create or edit teacher accounts. Set `ALLOW_TEACHER_SIGNUP=false` to turn self-registration off, or `TEACHER_SIGNUP_CODE` to require a school code. The Admin adds the students (roster) and registers their faces.
2. The teacher signs in **one time** on their phone/laptop at `teacher-login.html`. The device stays signed in (the session lasts `TEACHER_JWT_EXPIRES_IN`, default 30 days, and renews automatically whenever the app is used). Opening the sign-in page again goes straight to the dashboard.
3. On **Attendance**, the teacher picks (or starts) a class session and presses **Start class scan**. The browser asks for **camera** and **location** permission together. Every enrolled face in view is matched on the server and marked present with the GPS fix; duplicates are blocked.
4. **Logout** removes the session from that device.

Camera and location only work on `https://` pages or `localhost`.

## First Admin account

The simplest way (no HTTP calls needed) is the command line, after setting `.env` and starting MongoDB:

```bash
npm run create-user
```

It asks for the role, name, email and a hidden password (12+ characters). Run it again with `--role teacher --classes "10-A,10-B"` to create teachers directly, or create them later in the Admin dashboard.

The alternative one-time API bootstrap is below.

This version supports Admin, Teacher, and Guard accounts. Students are roster entries and do not have login accounts or a student sign-in page.

Initial account setup is deliberately closed by default. For the first Admin only, set `ALLOW_ADMIN_BOOTSTRAP=true` and a long random `BOOTSTRAP_KEY`, restart the server, then make this request:

```http
POST /api/auth/bootstrap-admin
Content-Type: application/json

{"name":"Administrator","email":"admin@example.edu","password":"a-long-unique-password","bootstrapKey":"same-key"}
```

Turn `ALLOW_ADMIN_BOOTSTRAP` off and remove the bootstrap key after creating the account. Use the Admin dashboard to create Teacher and GUARDGEN accounts. There are no default credentials. Teacher class assignments limit student, session, and attendance access.

## Attendance and face data

- The original eight tabs—Home, About, Register, Attendance, Records, 2D Lab, Admin, and Contact—remain available with their browser-local features.
- Face detection still runs in the browser and processes every face in a frame. Raw video is never uploaded or recorded.
- The original local attendance path remains available. When a signed-in Admin or Teacher selects an open server session, each detected face is checked against the server's stored 128-number vectors; the server decides the match and writes attendance to MongoDB.
- Registration saves to this browser as before. Server template sync happens only when a signed-in Admin/Teacher selects the explicit consent checkbox and the roll number matches an active server roster student. An Admin creates roster entries; a Teacher can sync only students in assigned classes.
- Teacher-created sessions support both server-verified face attendance and manual attendance after in-person identity verification. A unique student/session index prevents duplicate marks.
- Server APIs and sockets check the current account role and activation status. JWTs expire after the configured `JWT_EXPIRES_IN` value. Admins can manage staff, students, class assignments, and the campus boundary; they can deactivate a student or permanently clear that student's server face templates while keeping attendance history.

## GPS and GUARDGEN

- GPS monitoring starts only after an authorized user presses **Start live location** and grants browser permission. Coordinates and reported accuracy are sent to the server to check the configured circular campus geofence.
- Admins set the campus name, coordinates, and radius in the Admin dashboard. `REQUIRE_GEOFENCE=true` makes server attendance require a precise fix whose accuracy places it inside the geofence. Otherwise, GPS is stored as an additional signal when provided.
- An unmatched server-side face scan creates a rate-limited **Unverified face requires review** alert for GUARDGEN. It does not label a person a threat. Guards can acknowledge or resolve the alert; authenticated Socket.IO pushes new alerts and status changes to open dashboards. Browser notifications require separate user permission.
- Camera monitoring is an explicit local preview. It does not record or stream camera feeds.

## API overview

- Authentication: `POST /api/auth/login`, one-time `POST /api/auth/bootstrap-admin`, `GET /api/me`
- Admin staff and roster: `/api/users`, `/api/students`, `DELETE /api/students/:id/face-templates`, `/api/audit`, `/api/geofence`
- Teacher sessions and attendance: `/api/sessions`, `/api/attendance`, `/api/attendance/recognize`
- Security: `/api/alerts`, authenticated Socket.IO `security:alert` and `security:update` events
- Health: `GET /api/health`

Face templates are excluded from ordinary student responses. The server compares 128-dimensional vectors with Euclidean distance; defaults match the original browser thresholds (`FACE_MATCH_THRESHOLD=0.5`, `FACE_MATCH_MARGIN=0.06`). Tune against the institution's own camera and consented validation data before relying on biometric matches.

## Tests

- `npm test` checks the original eight pages, portal references, JavaScript syntax, assistant unit tests, backend matching/GPS helpers, and the static security rules.
- `npm run test:e2e` runs the existing Chromium/Playwright suite for the original site and AI assistant.
- MongoDB role flows, geolocation hardware, camera recognition accuracy, and live multi-client Socket.IO delivery require a configured MongoDB instance and manual integration checks listed in [TESTING.md](TESTING.md).

## Limits and deployment notes

GPS can be spoofed and face descriptors can be fooled by presentation attacks; neither should be the only control for a high-stakes decision. Unknown means only “no enrolled template matched.” Provide alternatives, consent, correction, retention, and deletion processes appropriate to the institution. Secure MongoDB volumes/backups, use HTTPS, rotate secrets, monitor audit logs, and obtain institution-specific privacy/security review before deployment. The project does not include liveness detection, refresh-token revocation, automated retention jobs, backup automation, PDF/scheduled reports, or service-worker push notifications.


## Staff portals

The refreshed Teacher, Admin and GUARDGEN sign-in pages and dashboards are documented in [PORTAL-UPDATES.md](PORTAL-UPDATES.md). No default credentials are shipped.

## GitHub Pages and Android APK

For the step-by-step Bengali MongoDB Atlas + Render + GitHub Pages deployment guide, see [MONGODB-RENDER-SETUP-BN.md](MONGODB-RENDER-SETUP-BN.md). Also see [GITHUB-PUBLISH.md](GITHUB-PUBLISH.md), [GITHUB-PAGES-API-FIX.md](GITHUB-PAGES-API-FIX.md), and [ANDROID-APK-STATUS.md](ANDROID-APK-STATUS.md). GitHub Pages requires a separately deployed Node API; configure the `FV_SERVER_URL` Actions secret and the API host’s `CLIENT_ORIGIN` before deployment.

## Quick-start files

See [RUN-LOCALLY.md](RUN-LOCALLY.md) for Windows/macOS/Linux startup instructions and [ANDROID-APK-STATUS.md](ANDROID-APK-STATUS.md) for the Android packaging requirements and current build limitation. On Windows, `RUN-WINDOWS.bat` installs dependencies and creates the initial `.env` file.
