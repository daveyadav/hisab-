# Hisab — Khata Book

A calm, offline-first **khata (ledger) book** for personal and small-business use — built for daily life in Nepal. Record what you buy, what you owe, and what others owe you, with automatic date/time, per-day totals, and per-person running balances.

**100% static:** plain HTML + CSS + vanilla JavaScript. No frameworks, no CDNs, no webfonts, no build step. It works offline and even straight from `file://`.

## Features

- **Device-local logins** — first launch creates an admin account (salted SHA-256 password hashing). The admin can create extra users, grant them the Personal portal, the Business portal, or both, and pause or remove them.
- **Two portals** — Personal khata and Business khata (e.g. a medical shop), switchable from the top bar.
- **Ledger entries** with auto-filled, readable date + time (Asia/Kathmandu, editable):
  - Cash purchase · Bought on due · Gave money · Took money · I paid back · Got money back
- **Dashboard** — today's cash out, today's new dues, total payables ("I owe"), total receivables ("owed to me"), this-month summary, recent entries.
- **Entries view** — per-day grouped list with per-day totals and a grand total, search across items/people/notes, and type filters. Edit or delete any entry.
- **Balances view** — per-person/vendor running balances, split into "I owe" and "Owed to me". Tap a person to see their entries.
- **JSON backup** — one-tap export downloads all records; import restores them. Your safety net, since data lives in the browser.
- **Sample data loader** — explore the app with example entries.
- **Mobile-first UI** — bottom navigation, big touch targets, inline SVG icons, system fonts, NPR formatting (`Rs 1,25,000` lakh/crore grouping).

## Push to GitHub

From this folder, in a terminal:

```bash
git init
git add .
git commit -m "Hisab khata book"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/hisab.git
git push -u origin main
```

(Replace `YOUR-USERNAME` and `hisab` with your GitHub username and repository name. Create the empty repository on GitHub first — do not initialize it with a README, to avoid conflicts.)

## Enable GitHub Pages

1. On GitHub, open your repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and folder to `/ (root)`, then **Save**.
4. After a minute or two, your app is live at `https://YOUR-USERNAME.github.io/hisab/`.

The `.nojekyll` file in this project tells GitHub Pages to serve the files exactly as they are.

## How family members use it

1. Each person opens the Pages link on their own phone's browser.
2. On first launch they **create their own admin account on their device** (username + password).
3. They can add their own family users from **More → Users** if they share that phone.
4. For an app-like feel: browser menu → **Add to Home Screen** (Chrome/Android) or **Share → Add to Home Screen** (Safari/iPhone).

## Honest notes — please read

- **Data lives in each device's browser** (localStorage). It is **per-device and not synced**: entries made on one phone never appear on another. Each family member keeps their own khata on their own phone.
- **Logins are device-local convenience locks**, not bank-grade security. Anyone with access to the browser's stored data could read it. Fine for family use; not for secrets.
- **Clearing browser data erases all records on that device.** Export a backup regularly: **More → Export backup**, and keep the downloaded JSON file somewhere safe (email it to yourself, save it in Drive, etc.). **More → Import backup** restores it.
- Dates and times use the **Asia/Kathmandu** timezone.
- For balances to group correctly, keep person/vendor names spelled consistently (e.g. always "Ramesh").

## Project structure

```
hisab/
├── index.html        # app shell and all views/modals
├── css/
│   └── styles.css    # mobile-first styling, no frameworks
├── js/
│   └── app.js        # all logic: auth, ledger, balances, backup
├── .nojekyll         # tells GitHub Pages to serve files as-is
└── README.md
```

## Local preview

No build needed — just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
