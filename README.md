# Pirate Odyssey (Web Edition)

A browser-playable rebuild of the original Java/Swing desktop game. Pick your pirate,
choose your horizon (Island / Ocean / Sky), and survive an endless runner across three
different game modes. Works on desktop and mobile (touch controls included).

This is plain HTML/CSS/JS — no build step, no server required. That's what makes it
deployable on GitHub Pages.

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `Pirate-Odyssey`), or reuse your existing one.
2. Upload **the entire contents of this folder** (`index.html`, `css/`, `js/`, `assets/`)
   to the **root** of the repository — not inside a subfolder.
   - Easiest way: on the repo page, click **Add file → Upload files**, drag in
     `index.html`, the `css` folder, the `js` folder, and the `assets` folder, then commit.
   - Or via git:
     ```bash
     git clone https://github.com/<your-username>/Pirate-Odyssey.git
     cd Pirate-Odyssey
     # copy index.html, css/, js/, assets/ into this folder
     git add .
     git commit -m "Deploy Pirate Odyssey web build"
     git push
     ```
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Under **Branch**, choose `main` (or `master`) and folder `/ (root)`, then **Save**.
6. Wait 1–2 minutes, then visit the URL GitHub shows you
   (e.g. `https://<your-username>.github.io/Pirate-Odyssey/`).

That's it — no `index.html` 404 this time, because this project *is* a real static website.

## Local testing (optional, before you deploy)

Because the game loads assets via `fetch`/`Image`, opening `index.html` directly with
`file://` will be blocked by the browser. Serve it locally instead:

```bash
cd Pirate-Odyssey
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

## What changed from the original Java version

The original project was a Java Swing **desktop** application — it can only run where a
JVM is installed, and GitHub Pages only serves static web files (HTML/CSS/JS), so it could
never be played directly in a browser. This version reimplements the same gameplay
(character select, horizon select, and all three modes — Island jump-runner, Sky
flappy-balloon, Ocean lane-dodger) natively in the browser using HTML5 Canvas, so it is:

- Playable instantly at a URL, no install
- Fully responsive — works on phones, tablets, and desktops
- Touch-controlled on mobile (tap to jump/flap, swipe or on-screen arrows to switch ocean lanes)

All original artwork and sound effects are reused from `src/game` in the original project.

## Controls

- **Island / Sky:** tap the screen, or press `Space`, to jump / flap.
- **Ocean:** swipe left/right, tap the on-screen ◀ ▶ buttons, or press `A`/`D`/arrow keys
  to switch lanes.
- **Pause:** the ☰ button top-left during a run.

## Project structure

```
index.html          Entry point — all screens
css/style.css        All styling, mobile-first responsive
js/game.js            Game logic: asset loading, menus, canvas engine for all 3 modes
assets/backgrounds/  Menu & horizon background art
assets/characters/   Per-character sprites (standing, running, jumping, ship, balloon, gameover)
assets/sounds/       Music + sound effects (.wav)
```
