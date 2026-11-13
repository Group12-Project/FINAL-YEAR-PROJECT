# Verification checklist

## Automated checks

Run from the project directory:

```bash
npm test
```

This validates the original eight HTML pages and navigation, local portal references, all JavaScript syntax, the existing assistant parser/search tests, face-match and GPS/geofence helper tests, and static security rules.

If Chromium and Playwright are installed, also run:

```bash
npm run test:e2e
```

The existing browser suite covers the original eight tabs and assistant workflows. It deliberately blocks third-party CDNs and does not exercise real camera or location APIs.

## Server integration checks

These checks need a running MongoDB, a `.env` with a strong `JWT_SECRET`, and the site open from the Node server over `http://localhost:3000` (or HTTPS in deployment).

- [ ] `GET /api/health` reports `database: connected`.
- [ ] Create the first Admin through the one-time bootstrap endpoint, disable bootstrap, and verify a second bootstrap attempt is rejected.
- [ ] Admin login works; wrong-role login fails. Create a Teacher assigned to one class and a GUARDGEN account.
- [ ] Create a student; confirm duplicate roll numbers fail. Teacher only sees assigned classes and cannot access another teacher's student/session.
- [ ] Deactivate a student and verify matching stops; remove their server face template and confirm attendance history remains.
- [ ] With explicit consent checked while signed in, sync five face samples to the matching roster record. Confirm no sync occurs with the checkbox off, no server login, or an unauthorized class.
- [ ] Start a session and scan a frame with multiple faces. Check each face is boxed; verify matched descriptors create one MongoDB attendance row, unknown/ambiguous faces do not, and repeat scans do not create duplicate attendance.
- [ ] Open two authenticated clients; verify a new attendance event appears live in teacher/admin views.
- [ ] Configure a campus geofence. Test inside, outside, boundary/uncertain, and low-accuracy GPS fixes. Verify `REQUIRE_GEOFENCE=true` rejects missing/outside/uncertain fixes.
- [ ] Create a security alert and confirm GUARDGEN receives it over Socket.IO and shows a browser notification after permission is granted. Acknowledge/resolve it and confirm the update reaches other clients.
- [ ] Disable a Teacher/Guard account and verify its next API and Socket.IO requests are rejected.

## Manual device and privacy checks

- [ ] Test camera permission denial/retry, front/back cameras, camera stop, and weak lighting.
- [ ] Test real geolocation permission, GPS accuracy, device movement, and stopping location sharing.
- [ ] Confirm raw video never leaves the browser; confirm face vectors sync only after explicit opt-in.
- [ ] Test on current Chrome, Edge, Firefox, Safari, iOS Safari, and Android Chrome, then run keyboard and screen-reader checks.

Automated helper tests do not verify a live MongoDB deployment, GPS hardware, face-match accuracy, liveness, or real Socket.IO delivery. Face recognition is probabilistic and must not be the sole high-stakes identity or attendance control.
