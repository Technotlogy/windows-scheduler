# The Cost of Meaning — Life Scheduler PWA

A Progressive Web App (PWA) for shift work life management, with Claude AI and Google Calendar integration.

> **These instructions are written for Windows.**

---

## What you get

- **Installable on your phone** — works like a native app from your home screen
- **Claude AI** (autopopulate, quick-add) via your own API key, securely proxied through Vercel
- **Google Calendar sync** — push shifts, jobs, and tasks to your phone's native calendar
- **Persistent data** — all data saved to browser localStorage, survives PWA restarts
- **$0/month hosting** — Vercel free tier covers everything

---

## Stack

```
Phone (PWA) → Vercel Edge Functions → Anthropic Claude API
                                    → Google Calendar API
```

---

## Step 1: Install prerequisites

You only do this once ever, not per project.

### Node.js
1. Go to [nodejs.org](https://nodejs.org) and download the **LTS** version
2. Run the installer — keep all defaults, click through
3. When done, open **Command Prompt** (press `Win + R`, type `cmd`, hit Enter) and verify:
   ```
   node --version
   ```
   Should print something like `v20.11.0`

### Git
1. Go to [git-scm.com/download/win](https://git-scm.com/download/win) and download
2. Run the installer — keep all defaults
3. Verify in Command Prompt:
   ```
   git --version
   ```

### Accounts you'll need
- [github.com](https://github.com) — free, for storing your code
- [vercel.com](https://vercel.com) — free, for hosting (sign up with your GitHub account)

---

## Step 2: Unzip and open the project

1. Right-click `scheduler-pwa.zip` → **Extract All** → pick a folder like `C:\Users\Ethan\Projects\`
2. Open **Command Prompt**
3. Navigate to the project folder:
   ```
   cd C:\Users\Ethan\Projects\scheduler-pwa
   ```
   (adjust the path to wherever you extracted it)
4. Install dependencies:
   ```
   npm install
   ```
   This downloads packages into a `node_modules` folder. Takes a minute.

---

## Step 3: Create your .env.local file

This file holds your secret API keys. It stays on your computer only — never gets uploaded anywhere.

1. Open **Notepad**
2. Paste this:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
   ```
3. Replace `sk-ant-xxxxxxxxxxxxxxxxxxxx` with your actual key from [console.anthropic.com](https://console.anthropic.com)
4. Save the file as `.env.local` inside the `scheduler-pwa` folder

   **Important:** In Notepad's Save dialog, change "Save as type" to **All Files (*.*)** and type the filename as `.env.local` (with the dot at the start, no `.txt` extension). If you accidentally save it as `.env.local.txt` it won't work.

---

## Step 4: Test it locally (optional but recommended)

In Command Prompt (still in the `scheduler-pwa` folder):

```
npm run dev
```

Open your browser and go to `http://localhost:5173` — you should see the scheduler. The Claude features won't work locally without extra setup (the API key is handled server-side on Vercel), but the UI will be fully functional.

Press `Ctrl + C` in Command Prompt to stop the local server when done.

---

## Step 5: Push to GitHub

### 5a. Create a new GitHub repository
1. Go to [github.com](https://github.com) → click **+** → **New repository**
2. Name it `com-scheduler` (or anything you want)
3. Leave it **Private**
4. Do NOT check "Add a README" — leave it empty
5. Click **Create repository**
6. Copy the repo URL shown — it'll look like `https://github.com/YourName/com-scheduler.git`

### 5b. Push your code
In Command Prompt (in the `scheduler-pwa` folder):

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Technotlogy/life-scheduler-windows
git push -u origin main
```

Replace the URL with yours from step 5a. Git will ask for your GitHub username and password — use your GitHub credentials. (If it asks for a password and fails, GitHub now requires a Personal Access Token instead of your password — go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token, check the `repo` scope, use that as your password.)

---

## Step 6: Deploy to Vercel

### 6a. Import your repo
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Find `com-scheduler` in the list → click **Import**
4. Framework preset should auto-detect as **Vite** — if not, select it
5. Click **Deploy**

It may fail on the first deploy — that's fine, we haven't added the API key yet.

### 6b. Add your API key
1. In your Vercel project dashboard, click **Settings** → **Environment Variables**
2. Add these one at a time:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com |


| `GOOGLE_CLIENT_SECRET` | *(skip for now, add later if setting up Google Calendar)* |
| `GOOGLE_CLIENT_ID` | *(skip for now)* |
| `GOOGLE_REDIRECT_URI` | *(skip for now)* |
| `VITE_GOOGLE_CLIENT_ID` | *(skip for now)* |

3. Go to **Deployments** tab → click the three dots on the latest deployment → **Redeploy**

After redeploy, you'll get a URL like `https://com-scheduler-ethan.vercel.app` — that's your live app.

---

## Step 7: Set up Google Calendar (optional)

Skip this if you don't need Google Calendar sync right now. You can always add it later.

### 7a. Create a Google Cloud project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it "CoM Scheduler" → Create
3. Left menu: **APIs & Services** → **Library** → search "Google Calendar API" → Enable

### 7b. OAuth consent screen
1. **APIs & Services** → **OAuth consent screen**
2. User type: **External** → Create
3. App name: "CoM Scheduler", your Gmail as support email
4. Scopes → **Add or remove scopes** → add `https://www.googleapis.com/auth/calendar`
5. Test users → add your Gmail address
6. Save through all steps

### 7c. Create credentials
1. **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
2. Application type: **Web application**
3. Name: "CoM Scheduler Web"
4. Authorized redirect URIs → Add: `https://YOUR-APP.vercel.app/` (use your actual Vercel URL)
5. Click **Create** → copy the **Client ID** and **Client Secret**

### 7d. Add to Vercel env vars
Go back to Vercel → Settings → Environment Variables and add:

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxx` |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-APP.vercel.app/` |
| `VITE_GOOGLE_CLIENT_ID` | `xxxx.apps.googleusercontent.com` (same as CLIENT_ID) |

Redeploy once more. Then in the app, go to **⋯ Settings** → **Connect Google Calendar**.

---

## Step 8: Install as PWA on your phone

### iPhone (Safari only — must use Safari, not Chrome)
1. Open your Vercel URL in Safari
2. Tap the **Share** button (box with arrow at the bottom)
3. Scroll down → **Add to Home Screen**
4. Tap **Add**

### Android (Chrome)
1. Open your Vercel URL in Chrome
2. Tap **⋮** menu → **Add to Home screen** → **Install**

The app now runs full-screen like a native app, no browser address bar.

---

## Updating the app in the future

Whenever you want to make changes, edit the files on your computer, then in Command Prompt:

```
git add .
git commit -m "describe what you changed"
git push
```

Vercel auto-deploys within about 30 seconds of every push. No further action needed.

---

## Backup your data

All data lives in your phone/browser's localStorage. Before clearing browser data or switching devices, go to **⋯ Settings** → **Export JSON** and save the file somewhere safe. Import it back the same way.

---

## Cost estimate

| Service | Cost |
|---------|------|
| Vercel hosting + Edge Functions | **$0/month** |
| Google Calendar API | **$0** (free quota) |
| Anthropic Claude API | ~$0.50–$2/month typical usage |

---

## Troubleshooting

**"API key not configured"** — Double-check `ANTHROPIC_API_KEY` is in Vercel env vars and you redeployed after adding it.

**npm is not recognized** — Node.js didn't install correctly. Re-run the Node.js installer, restart Command Prompt, try again.

**git push asks for password and fails** — GitHub no longer accepts passwords. Use a Personal Access Token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (check `repo` scope) → use that token as your password.

**Google Calendar not connecting** — Your Vercel URL must be in "Authorized redirect URIs" in Google Cloud Console, including the trailing slash. Must match exactly.

**Data disappeared** — You cleared browser data. Export a backup JSON from Settings regularly.

**PWA not updating after a code push** — Close the app fully and reopen. If still stale: iPhone: Settings → Safari → Clear History and Website Data. Android: long-press app icon → App info → Storage → Clear cache.
