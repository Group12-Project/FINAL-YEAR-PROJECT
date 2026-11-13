# Android APK

The APK is built **automatically by GitHub** (workflow `.github/workflows/android-apk.yml`) every time you push to `main`, or manually via **Actions → Build Android APK → Run workflow**. Download `FaceVector-debug-apk` from the run's Artifacts.

1. Deploy the Node server over HTTPS (the app is only the front end; MongoDB and JWT secrets stay on the server).
2. In GitHub: Settings → Secrets and variables → Actions → New secret `FV_SERVER_URL` = `https://your-server`.
3. On the server set `CLIENT_ORIGIN` to include `https://localhost` (the Android app origin) and your GitHub Pages URL, comma-separated.
4. Push, wait for the workflow, download and install the APK (allow "install unknown apps").

Local build (needs Android Studio/SDK, JDK 17): `npm install && npm run android:add && npm run android:debug`. Add CAMERA and ACCESS_FINE_LOCATION permissions to `AndroidManifest.xml` (the workflow does this automatically).

This produces a **debug** APK. For Play Store or institutional distribution, create a release build signed with your own keystore. The APK was not built or tested in the authoring environment (no Android SDK or network there).
