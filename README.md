# FARIS — Personal Portfolio

> A living portfolio for experiments, interactive ideas, and projects built while learning.

**FARIS** is Faris's personal website: an interactive portfolio that combines a glass-inspired visual design, small playful interactions, a terminal-style command interface, mini-games, and a live project showcase.

<p>
  <a href="https://farixhere.github.io/faris-portfolio/"><img src="https://img.shields.io/badge/Visit-Live_Portfolio-DB6D36?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Visit FARIS portfolio" /></a>
  <a href="https://github.com/farixhere/faris-portfolio"><img src="https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github" alt="FARIS source on GitHub" /></a>
</p>

## Explore the experience

### Aurora Glass
- Frosted-glass panels with animated aurora styling, iridescent edges, and cursor-following highlights.
- Light and dark themes, with multiple accent palettes.
- Independent panel shatter and rebuild interactions.

### Project showcase
- Interactive project cards with tilt and reflection effects.
- Project content loaded from Supabase, with fallback entries when remote content is unavailable.
- Expandable project details.

### XIRAF OS
A desktop-inspired interface inside the portfolio, with a boot sequence, dock, launcher, notifications, and draggable/resizable windows. On mobile, windows adapt into full-screen sheets.

### Terminal and mini-games
- A terminal-style console with help and navigation commands.
- Five built-in arcade games: Flappy, Snake, Memory, Pong, and 2048.
- Keyboard and touch support, plus pause/resume behaviour for games.

### Admin dashboard
The `admin.html` page provides a dashboard for managing the Supabase-backed portfolio content. Access depends on the configured admin account and backend permissions.

## Visit the website

**[Open the live FARIS portfolio](https://farixhere.github.io/faris-portfolio/)**

## Run locally

This is a static website built with vanilla HTML, CSS, and native JavaScript modules. There is no frontend build step or package installation required.

### Option 1: Python

```bash
git clone https://github.com/farixhere/faris-portfolio.git
cd faris-portfolio
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000).

### Option 2: Any static server

Serve the repository root with a local static server or host it on a static web host.

Some live content and admin features require the configured Supabase project.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Main page markup and metadata |
| `styles.css` | Design tokens, layout, and core styles |
| `css/glass.css` | Glass and shatter effects |
| `css/arcade.css` | Arcade game styling |
| `css/xiraf.css` | XIRAF OS interface |
| `js/main.js` | Main application entry |
| `js/data.js` | Supabase integration and fallback content |
| `js/glass.js` | Shatter/rebuild interaction engine |
| `js/commands.js` | Allowed terminal command registry |
| `js/console.js` | Terminal interface |
| `js/arcade/` | Mini-games and launcher |
| `js/xiraf/` | Desktop-style windows and apps |
| `admin.html`, `admin.js` | Content-management dashboard |

## Security and privacy

- The Supabase browser key is a publishable key; access control must be enforced by Supabase Row Level Security policies.
- Never commit service-role keys, database passwords, or other private credentials.
- Admin writes should remain protected by authenticated access and appropriate database policies.
- Terminal input is matched against a fixed command registry rather than evaluated as arbitrary JavaScript.

## Accessibility and responsive design

- Keyboard-visible focus states and keyboard-reachable controls.
- Reduced-motion support.
- Touch-friendly controls and mobile-specific adjustments.
- Background interfaces are made inert when the XIRAF OS layer is active.

## Links

- **Portfolio:** https://farixhere.github.io/faris-portfolio/
- **GitHub:** https://github.com/farixhere
- **Instagram:** https://www.instagram.com/farixhere/

---

Made by Faris — learning by building, and building to learn.