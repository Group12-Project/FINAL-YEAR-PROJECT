# Publish to GitHub (ZIP, website link, APK)

```bash
unzip FaceVector-Website-Source-GitHub-Ready.zip && cd FaceVector-Attendance
git init -b main && git add . && git commit -m "FaceVector Attendance"
git remote add origin https://github.com/YOUR-USERNAME/FaceVector-Attendance.git
git push -u origin main
```
(Create the empty repo on GitHub first. If the folder already contains `.git`, skip `git init`.)

- **Website link:** Settings → Pages → Source: *GitHub Actions*. After the push the site is at `https://YOUR-USERNAME.github.io/FaceVector-Attendance/`. Static pages and browser-only features work there; sign-in, server attendance and alerts need a deployed Node API. Set the GitHub Actions secret `FV_SERVER_URL` to that API's HTTPS base URL, and configure the API's `CLIENT_ORIGIN` to include the GitHub Pages site origin. The GitHub Actions build now requires the `FV_SERVER_URL` repository secret and fails clearly if it is missing. GitHub Pages cannot run the Node API. Follow [GITHUB-PAGES-API-FIX.md](GITHUB-PAGES-API-FIX.md) to deploy the API, configure `CLIENT_ORIGIN`, add the secret, and redeploy. For local sign-in, run `npm start` and use `http://localhost:3000/`; a static-only server does not provide authentication.
- **APK:** see ANDROID-APK-STATUS.md.
- **Updating:** edit files, `git add . && git commit -m "update" && git push`; both workflows rerun.

Never commit `.env`, secrets, or student biometric data.
