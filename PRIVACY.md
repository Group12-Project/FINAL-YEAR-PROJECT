# FaceVector privacy and biometric notice

This project has two modes. The original browser-only registration and attendance data remain in that browser's `localStorage`. The optional server workflow sends data to the institution's Node/MongoDB deployment.

## Data sent to the server

- Saving a face locally does not automatically upload it. A signed-in Teacher/Admin must select the explicit consent checkbox before the app sends the five 128-number face descriptors to the matching active server student.
- Camera frames/video are processed in the browser and are never sent or recorded by this application.
- Server attendance stores the matched student, class/session, India-local date, timestamp, verification method, match distance, and optional GPS latitude/longitude/accuracy.
- The live GPS page sends coordinates and accuracy to the server while the user has started location sharing. Attendance sends a GPS fix when available; the server can require it and enforce the configured campus circle.
- Login requests send the email and password to the same-origin server over HTTPS in production. Passwords are stored as bcrypt hashes. Bearer tokens are kept in browser local storage until logout or expiry.
- Security alerts, account and roster administration, session changes, face-template sync, attendance actions, and selected configuration changes produce server audit events.
- Deactivating a student retains their past attendance and server template. Admins can separately clear a student's server face templates; browser-local copies must be removed from the Register/backup storage on that device as part of the institution's deletion process.

## Before deployment

The institution must explain the purpose, fields collected, template and log access, retention/deletion schedule, correction process, alternatives for people who decline face processing, and privacy contact; then obtain the legally valid consent or authority required in its jurisdiction.

Do not store raw video unless separately justified and consented. Treat face templates as sensitive biometric data: restrict and audit access, encrypt database volumes and backups, use HTTPS, rotate secrets, limit retention, and provide deletion/export workflows. GPS is approximate and spoofable; use it only as an additional signal. Unknown face means only “not matched to an enrolled template,” never “criminal” or “dangerous.”

This file is a deployment checklist, not legal advice. Obtain institution-specific privacy and security review before use.
