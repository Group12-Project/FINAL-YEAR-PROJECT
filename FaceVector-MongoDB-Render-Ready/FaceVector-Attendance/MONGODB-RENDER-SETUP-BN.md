# FaceVector: MongoDB Atlas + Render + GitHub Pages (বাংলা গাইড)

এই প্রজেক্টে Express/Mongoose API আগে থেকেই আছে। এই সেটআপে MongoDB Atlas-এ ডেটা থাকবে, Render-এ Node API চলবে, আর GitHub Pages-এ ওয়েবসাইট থাকবে। এই ZIP-এ কোনো আসল MongoDB password/API secret রাখা হয়নি।

## ১) MongoDB Atlas তৈরি
1. https://www.mongodb.com/cloud/atlas/register এ account খুলুন।
2. একটি Free cluster তৈরি করুন এবং Database User-এর username/password সেট করুন।
3. Network Access-এ Render-এর outbound IP allowlist করুন। Render Free-এর IP স্থির নাও হতে পারে; দ্রুত পরীক্ষার জন্য `0.0.0.0/0` ব্যবহার করলে শক্তিশালী DB password বাধ্যতামূলক এবং production security review দরকার। সম্ভব হলে নির্দিষ্ট IP allowlist করুন।
4. Database → Connect → Drivers → Node.js থেকে connection string কপি করুন। Database নাম `FaceVector` ব্যবহার করতে পারেন। URI-তে username/password বসান; password-এ `@`, `#`, `/`, `%` ইত্যাদি থাকলে URL-encode করতে হবে।

## ২) GitHub-এ Source push
এই ফোল্ডারের ভিতর থেকে repository-তে project files push করুন (ফোল্ডারটিকেই repository root করুন):

```bash
git init -b main
git add .
git commit -m "Prepare FaceVector MongoDB deployment"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

আগে থেকেই Git repository থাকলে `git init` করবেন না।

## ৩) Render-এ API deploy
1. https://render.com/ খুলে GitHub দিয়ে sign in করুন।
2. **New → Blueprint** নির্বাচন করে FaceVector repository connect করুন।
3. Render root-এ `render.yaml` পেলে `facevector-api` Web Service তৈরি করার প্রস্তাব দেখাবে। Apply করুন।
4. Environment-এ `MONGODB_URI`-তে Atlas connection string দিন।
5. `CLIENT_ORIGIN`-এ GitHub Pages-এর exact origin দিন, যেমন `https://YOUR-USERNAME.github.io` (repository path বা শেষে slash দেবেন না)। Custom domain হলে সেই origin-ও দিন।
6. `JWT_SECRET` Render Blueprint নিজে generate করবে। এটি কখনো GitHub source-এ রাখবেন না।
7. Deploy শেষ হলে Render-এর service URL কপি করুন, যেমন `https://facevector-api.onrender.com`।

`ALLOW_TEACHER_SIGNUP=false` ডিফল্ট রাখা হয়েছে যাতে যে কেউ Teacher account খুলতে না পারে। Admin dashboard/CLI দিয়ে Teacher তৈরি করুন।

## ৪) GitHub Pages-এ API URL সেট
1. GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**।
2. Name: `FV_SERVER_URL`
3. Value: Render API base URL, যেমন `https://facevector-api.onrender.com`। `/api` যোগ করবেন না।
4. Save করুন। এরপর **Actions → Deploy website to GitHub Pages → Run workflow** চালান, অথবা `main`-এ নতুন commit push করুন।

এই URL public API endpoint, তাই এটি secret-এ রাখা workflow configuration-এর সুবিধা; MongoDB URI/JWT secret কখনো browser-এ প্রকাশ করবেন না।

## ৫) Health check
Browser-এ `https://YOUR-RENDER-SERVICE.onrender.com/api/health` খুলুন। `database: "connected"` দেখা উচিত। `disconnected` হলে Render-এর `MONGODB_URI`, Atlas Database User, password URL-encoding এবং Atlas Network Access পরীক্ষা করুন।

## ৬) প্রথম Admin account
Local computer-এ Node.js 18+ install করে project folder-এ `.env` তৈরি করুন (`.env.example` copy করে)। সেখানে production Atlas `MONGODB_URI` এবং Render-এর `JWT_SECRET` বসান, তারপর:

```bash
npm install
npm run create-user
```

Role `admin` নির্বাচন করুন। Password কমপক্ষে ১২ অক্ষরের দিন। CLI-তে password টাইপ করার সময় সেটি screen-এ দেখাবে না। Account তৈরি হয়ে গেলে `.env` local-এ নিরাপদে রাখুন; commit/push করবেন না। বিকল্পভাবে Admin bootstrap API ব্যবহার করা যায়, কিন্তু CLI পদ্ধতিই সুপারিশ করা হচ্ছে।

## ৭) জরুরি নিরাপত্তা
- `.env` commit করবেন না; `.gitignore`-এ ইতিমধ্যে উপেক্ষা করা আছে।
- Student face descriptor ও attendance data ব্যক্তিগত/সংবেদনশীল। শিক্ষার্থী/অভিভাবকের উপযুক্ত সম্মতি, সীমিত access, retention/deletion policy এবং backup রাখুন।
- Face recognition বা GPS-কে একমাত্র শাস্তিমূলক/উচ্চ-ঝুঁকির সিদ্ধান্তের ভিত্তি করবেন না। GPS spoof হতে পারে।
- Render Free service idle হলে sleep করতে পারে; প্রথম request ধীর হতে পারে। Production school deployment-এর আগে uptime, backup, monitoring ও paid hosting বিবেচনা করুন।
- GitHub Pages-এ browser-এর config-এ শুধু API base URL যাবে; MongoDB credentials নয়।

## Local check

```bash
npm run check:api-config
npm test
```
