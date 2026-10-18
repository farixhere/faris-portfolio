# faris-portfolio

Faris's portfolio — a static site (vanilla HTML/CSS and native ES modules, **no build step, no dependencies**) with a Supabase backend for live content.

## What's in it

- **FARIS Glass** – premium glassmorphism design system. Light by default, dark theme via the toolbar; tokens live in `styles.css`, glass engine visuals in `css/glass.css`.
- **Shatter panels** – every panel marked `data-gp` is an independent object. Click it (or press its Shatter button) and it breaks into fragments built from its own geometry; click again or press Rebuild and it reassembles. Each panel has its own state machine (`intact → exploding → collapsed → rebuilding`), is safe against rapid clicks, ignores clicks on links/buttons/inputs inside it, and falls back to a static "Shattered" state under `prefers-reduced-motion`. Engine: `js/glass.js`.
- **Project showcase** – tilt + reflection cards with expandable details. Only real data from Supabase (with the original three projects as fallback) is shown.
- **XIRAF OS** – a desktop-style rendering of the same portfolio (`js/xiraf/`): boot sequence, menubar, dock, launcher, notifications, draggable/resizable windows (full-screen sheets on mobile) and apps: Portfolio, Projects, Terminal, Arcade, About. The normal page is only made `inert`, not torn down, so scroll position and state are restored on exit.
- **Console** – open with the terminal button or `/`. Commands: `help`, `clear`, `about`, `about xiraf`, `projects`, `theme [light|dark|toggle]`, `boot xiraf`, `exit xiraf`, `games`, `help games`, `game`, `game flappy|snake|memory|pong|2048`. Input is sanitised and matched against a fixed registry (`js/commands.js`); nothing is ever evaluated.
- **Arcade** – five built-in games (`js/arcade/`): Flappy, Snake, Memory, Pong, 2048. Each exposes `create(container) → {destroy, pause, resume, restart}`, handles keyboard/touch, pauses when hidden and releases everything on close.
- **Admin** (`admin.html`) – glass-styled dashboard for the Supabase content. Auth and data logic (`admin.js`) are unchanged.

## Layout

```
index.html        page markup
styles.css        tokens + base + sections
css/glass.css     shatter panels      css/arcade.css   games      css/xiraf.css   XIRAF OS
js/main.js        entry point         js/data.js       Supabase + fallback data
js/glass.js       shatter engine      js/commands.js   command registry     js/console.js  terminal UI
js/arcade/        games + launcher    js/xiraf/        windows, apps, OS shell
admin.html/.css/.js   dashboard
```

## Run locally

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

Any static host works; on GitHub Pages just serve the branch root.

## Security notes

- The Supabase **publishable** key in client code is public by design; access is enforced by Row Level Security (public read, anonymous insert on `messages`, authenticated admin writes).
- No secrets are committed. The admin page only works for the configured admin account.
- Reduced motion is honoured everywhere; heavy effects are tuned down on mobile / coarse pointers rather than removed.

## Accessibility

Keyboard-reachable Shatter/Rebuild buttons on every panel, focus-visible rings, ARIA live announcements for XIRAF and rebuilds, `inert` on hidden/background layers, 40px+ touch targets.
