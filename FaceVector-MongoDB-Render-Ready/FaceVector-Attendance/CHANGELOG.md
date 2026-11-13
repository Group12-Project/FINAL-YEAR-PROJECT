# Changes in this review

- **Fixed:** `esc` was declared in both `js/main.js` and `public/app.js`, a SyntaxError that stopped `app.js` on all 11 login, dashboard and register/attendance pages (sign-in, dashboards, server attendance and alerts could not work). Removed the duplicate.
- **Fixed (security):** the server served the whole project folder, exposing `server.js`, `package.json`, tests, scripts, docs and `lib/`. It now serves only the HTML pages and `/css`, `/js`, `/public`.
- **Added:** `scripts/check-globals.js` (part of `npm test`) catches duplicate top-level names across page scripts.
- **Added:** `js/config.js` server URL, Capacitor Android wrapper, GitHub Actions for the APK and GitHub Pages.
- **Not verified here:** the Node/MongoDB server (dependencies and MongoDB unavailable), live camera/GPS, and the APK build. Face-api scripts still load without SRI hashes.

## More menu repair — 2026-11-09
- Reorganized the shared More menu into Staff dashboards, Attendance & security, and Management & help.
- Kept every destination linked to an existing project page; removed no attendance or portal functionality.
- Fixed dropdown clipping caused by the horizontally scrolling navigation container.
- Improved phone layout, touch target sizes, keyboard focus, Escape dismissal, outside-click dismissal, and automatic close after selecting a destination.
- Verified JavaScript syntax, project checks, and all 23 core/backend/teacher-access tests.


## Attendance and staff operations upgrade (2026-11-09)
- Teacher class selector is populated from the authenticated account's assigned classes; session creation now validates a selected assigned class.
- Attendance records page now reads authenticated server attendance and active students, supports date/session/search filters, CSV export, and live attendance updates.
- Security alerts page now supports submitting incident reports, live refresh, and role-aware acknowledge/resolve actions (admin/guard only).
- Live monitoring page now shows active server sessions/attendance status for admin/teacher and unresolved security alert count for guards, with an explicit opt-in local camera preview and cleanup.
- Socket alert updates refresh the complete alert list so response controls remain available.
- Verified with `npm test`: 23 tests pass; static security scan reports four existing third-party script SRI warnings.


## Production-ready cleanup — 2026-11-09
- **Removed** all presentation/demo content: `demo-login.html`, `demo-dashboard.html`, `public/demo.js`, demo fallbacks on the sign-in pages, demo links/menu entries and demo styles. Sign-in now only talks to the real API.
- **Added** one-time teacher sign-in: teacher tokens last `TEACHER_JWT_EXPIRES_IN` (default 30d), renew via `POST /api/auth/refresh`, sign-in pages skip the form when already signed in, and `?next=` returns teachers to the attendance page. A network error no longer logs the user out (only a 401 does).
- **Added** one-page attendance: start/end a class session on `attendance.html`; **Start class scan** requests camera and GPS together, keeps retrying GPS after timeouts, and shows live GPS status.
- **Added** `npm run create-user` to create the first admin / teachers from the command line.
