# FaceVector portal updates

## Updated portals

- Teacher sign-in: improved accessible sign-in form, password visibility control, validation and feedback.
- Teacher dashboard: loads the authenticated teacher's assigned students, classes, attendance stats, open sessions and today's server attendance. Class selection is restricted to the teacher's assigned classes.
- Administrator sign-in and dashboard: refreshed sign-in experience; existing dashboard supports student roster management, staff account creation/activation, campus geofence settings, attendance and audit history.
- Guard sign-in and GUARDGEN dashboard: refreshed sign-in experience, recent security alerts, browser notification permission and links to live camera, GPS and full alert monitoring.
- Role access: dashboard and monitoring pages continue to require a valid authenticated role. Sign-in routes users to the correct role dashboard; logout clears the local session token.

## Important setup notes

- There are no default accounts or passwords. Create the first administrator with `npm run create-user` (or the one-time `/api/auth/bootstrap-admin` endpoint described in `README.md`).
- Teachers sign in once per device; the session renews automatically (see `TEACHER_JWT_EXPIRES_IN`).
- The administrator creates teacher and guard accounts from the Admin Dashboard. Teacher class assignments must be set before the teacher can start a class session.
- Server-backed portals require the Node server, a configured MongoDB connection and a strong JWT secret. See `.env.example` and `README.md`.
- Face attendance, GPS and live camera features still require browser permissions and the required hardware/network access. A static file server alone does not provide the authenticated server API.

## Verification

`npm test` passes: project checks, 20 automated tests and the static security scan. The scanner reports four existing third-party script integrity warnings for Face API and Leaflet CDN scripts; the security scan is static and is not a security guarantee.
