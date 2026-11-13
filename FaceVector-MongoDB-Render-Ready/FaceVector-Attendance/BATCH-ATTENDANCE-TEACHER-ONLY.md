# Batch attendance and teacher-only access

- The attendance scanner uses `detectAllFaces`, so it processes multiple faces visible in the camera frame during one teacher-operated scan session.
- The teacher must sign in, have an open session assigned to their class, and allow camera and GPS access.
- Each detected face is submitted for server-side matching against the selected class roster. Server-side unique attendance records prevent duplicate check-ins for a student in the same session.
- The attendance page redirects unauthenticated users to teacher login. Non-teacher roles are redirected away.
- The server rejects attendance write requests unless the authenticated role is `teacher`, even if someone tries to call the API directly.
- Student users have no attendance-camera permission or attendance-write endpoint access.

## Run

Configure MongoDB and the environment as described in `README.md`, then run `npm install` and `npm start`. Serve over HTTPS in production for camera and GPS permissions.

## Scope of verification

The automated suite checks the access gate, teacher-only server write routes, and multi-face detection loop. A live camera, real class roster, GPS permission, and GUARDGEN notifications must still be tested in the deployed environment.
