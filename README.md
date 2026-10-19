# faris-portfolio

Faris's portfolio — a static site (vanilla HTML/CSS and native ES modules, **no build step, no dependencies**) with a Supabase backend for live content.

## What's in it

- **Aurora Glass** – a ground-up glass design: animated aurora background, frosted panels with iridescent rims and a cursor-following highlight, floating dock, four accent palettes (`accent violet|cyan|rose|amber|mint`), light/dark. Tokens live in `styles.css`, shatter visuals in `css/glass.css`.
- **Shatter panels** – every panel marked `data-gp` is independent. Tap it three times (within ~2.6s) and it cracks, then breaks into fragments; the first two taps only show cracks. There are no Shatter buttons – a small Rebuild pill appears only while a panel is broken (tapping the debris also works). Console: `shatter` / `rebuild`. Reduced motion gets a static fallback. Engine: `js/glass.js`.
- **Project showcase** – tilt + reflection cards with expandable details. Only real data from Supabase (with the original three projects as fallback) is shown.
- **XIRAF OS** – a desktop-style rendering of the same portfolio (`js/xiraf/`): boot sequence, menubar, dock, launcher, notifications, draggable/resizable windows (full-screen sheets on mobile) and apps: Portfolio, Projects, Terminal, Arcade, About. The normal page is only made `inert`, not torn down, so scroll position and state are restored on exit.
- **Console** – live in the hero, plus a modal (terminal button or `/`) and inside XIRAF. Run `help` for groups: sections (`about`, `projects`, `open <section>`, `cat <project>`, `stack`, `socials`, `contact`), about (`whoami`, `neofetch`, `banner`), play (`matrix`, `confetti`, `coin`, `roll`, `fortune`, `game <name>`), system (`accent`, `theme`, `shatter`, `rebuild`, `sound`, `boot xiraf`, `exit xiraf`, `clear`). Input is sanitised, matched against a fixed registry (`js/commands.js`); nothing is evaluated.
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

Keyboard-reachable Rebuild pill and `shatter`/`rebuild` console commands, focus-visible rings, ARIA live announcements for XIRAF and rebuilds, `inert` on hidden/background layers, 40px+ touch targets.
