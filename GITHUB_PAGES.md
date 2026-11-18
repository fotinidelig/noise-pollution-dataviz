# Deploy to GitHub Pages (manual)

Suggested URL: **https://fotinidelig.github.io/noise-pollution-dataviz/**

## One-time GitHub setup

1. Create an empty public repo named `noise-pollution-dataviz` under your account (no README).
2. In this folder:

```bash
cd ~/Documents/ecal/noise-pollution-dataviz
git remote add origin git@github.com:fotinidelig/noise-pollution-dataviz.git
git push -u origin HEAD:main
```

3. Build with the Pages base path:

```bash
cd app
npm run build:pages
```

4. Publish the `app/dist` folder to a `gh-pages` branch (pick one):

```bash
# easiest if you have npm:
npx --yes gh-pages -d dist --repo git@github.com:fotinidelig/noise-pollution-dataviz.git
```

5. On GitHub: **Settings → Pages → Deploy from a branch → `gh-pages` / root → Save**.

Wait a minute, then open https://fotinidelig.github.io/noise-pollution-dataviz/

Local `npm run dev` is unchanged (`base: /`).
