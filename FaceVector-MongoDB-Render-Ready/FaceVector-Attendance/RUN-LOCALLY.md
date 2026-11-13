# Run FaceVector Attendance locally

## Requirements
- Node.js 18 or newer
- MongoDB 6 or newer for server-backed accounts, roster, attendance, and alerts
- Chrome or Edge with camera and location permissions

## Windows quick start
1. Install Node.js and MongoDB Community Server.
2. Extract this ZIP to a normal folder (do not run it from inside the ZIP preview).
3. Double-click `RUN-WINDOWS.bat` once to install dependencies and create `.env`.
4. Edit `.env`: set a unique random `JWT_SECRET` (at least 32 characters) and the correct `MONGODB_URI`.
5. Start MongoDB.
6. In this project folder, open Command Prompt and run `npm start`.
7. Open `http://localhost:3000/` in Chrome or Edge.

### If you use VS Code Live Server (port 5500)
You can still preview the pages at `http://127.0.0.1:5500`, but the Node API and MongoDB must also be running. The website now detects the local preview and sends login/registration requests to `http://127.0.0.1:3000` automatically. The local API allows the standard Live Server origins in development mode. Do not open the HTML file directly with `file://`.

**Teacher registration:** Open `teacher-login.html`, choose **Register**, enter your full name, email, class(es), password and confirmation, then select **Register and sign in**. A successful registration creates a server account and opens the Teacher Dashboard. The account is stored in MongoDB; registration cannot securely work without the API and database.

## macOS / Linux
```bash
npm install
cp .env.example .env
# Edit .env and set JWT_SECRET and MONGODB_URI
npm start
```
Then open `http://localhost:3000/`.

## First administrator
There are intentionally no default usernames or passwords. With MongoDB running and `.env` set, run `npm run create-user` and enter the admin's name, email and password. Then sign in at `admin-login.html`, add classes/teachers/students, and the teacher can sign in once and take attendance from `attendance.html`.

## Camera and GPS
Camera and geolocation require a secure browser context: `localhost` is accepted for local development. For access from phones or other computers, deploy behind HTTPS and configure the server origin and MongoDB securely. A plain LAN HTTP address will generally not grant camera/location access.

## Verification
Run `npm test`. Passing automated tests is not the same as verifying your actual camera, GPS, MongoDB deployment, biometric matching accuracy, or multi-device network setup. Complete the integration checklist in `TESTING.md` before using this for official attendance.
