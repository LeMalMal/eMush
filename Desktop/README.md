# eMush Desktop

A native desktop client for eMush (Windows first), designed to be distributed on Steam.

The window is an application **shell**: a navigation bar that is always visible, native pages drawn
by the client in one visual style, and, under the bar, the **live web game** for what is not redone
natively (the game itself, the forum, the rules, a ship's end page). Nothing in the eMush code base
is modified.

## Why a shell around the live game?

- **Zero backend change.** Login goes through Eternaltwin OAuth and the session lives in an
  `httpOnly` cookie set by the API. The shell reuses that session to call the game's existing API
  and shows the real site for the game itself, so both keep working as-is.
- **Always up to date.** Each eMush release is live in the desktop app immediately; the
  executable only needs an update when the shell itself changes.
- **One navigation.** The web client's own top bar and menu are hidden in the window: the player
  only ever sees the shell's navigation, and can always go back home (tab, logo, or Ctrl+H).

## Pages

| Entry | Drawn by | Content |
| --- | --- | --- |
| Accueil | client | Adaptive main button (log in / read the rules / find a crew / resume with day, cycle and next-cycle countdown / write your epitaph), latest news, live counters, community shortcuts. |
| ▶ Jouer | client or web | Leads to the right place: login, rules, **crew selection** (client) or the game (web). |
| Trouver un équipage | client | Boarding ship per language (FR/EN/ES), who is aboard (x/16), character cards with level, story and skills. Boarding is always confirmed in a dialog. |
| Actualités | client | Paginated news and full articles, rendered from the game's markup. |
| Classements | client | Ship ranking with language and sort filters; a row opens the ship's end page (web). |
| Profil | client | Own or another player's profile: success points, statistics, achievements, game history (a row opens the ship's end page). Logout. |
| Forum | web | The eMush section of the Eternaltwin forum, in the window. |
| Règles | web | The game's rules page (where new players accept them). |
| Jeu | web | The game itself (`/game`). |

When the web game links to a page the client has redone (news, ranking, a profile), the client shows
its native page instead (`nativeNavigationFor` in `src/main/shell/routes.ts`).

## Visual style

The shell reuses the game's own design language (`App/src/assets/scss`), not a generic app look:

- **Palette** of `_mixins.scss` only: deep blues, cyan, Mush red, green, orange.
- **Shapes**: no rounded corners. Page blocks are `.box` (the web client's `.box-container`: bevel-cut
  corners, inner blue glow); detail panels and dialogs are `.frame` (the in-game tooltip: 2 px
  `#3965fb` edge, glow, pixel corner pieces); counters are `.slot` (inventory slots).
- **Buttons**: the game's `button-style` mixin (banded gradient, 1 px dark edge, small caps), blue
  for actions, Mush red for the main action.
- **Type**: Days One for titles, Pixel Square for labels and tabs (mixed case, like room names:
  the font has no proper uppercase accents), eKanit for text.
- **Pixel art** at integer scales with `image-rendering: pixelated`: 16 px icons (triumph, skull,
  planets), character heads and body sprites on the character-selection pedestal.

## Other desktop features

| Feature | Details |
| --- | --- |
| Native window | Remembers size, position, maximized and fullscreen state (safe if a monitor is unplugged). F11 fullscreen, Ctrl ± zoom of game pages, Ctrl+R / F5 reload, Ctrl+H home. |
| Single instance | Launching it twice focuses the existing window. |
| Offline | Native pages show "server unreachable" with a retry button; web pages show a local offline page. |
| Link handling | The game, Eternaltwin and its login providers (Discord, GitLab) stay in the window; wiki, Discord invites and other sites open in the default browser. |
| Steam | Optional: Steamworks init, overlay (Shift+Tab), rich presence. Achievements are ready on the client side (see roadmap). Without Steam, the app runs normally. |
| Detection | Web pages can check `window.emushDesktop?.isDesktopApp`. |

## How it works

- `BrowserWindow` = the shell page (`static/shell/`, code in `src/shell/`, bundled with esbuild).
  A `WebContentsView` placed under the 64 px bar shows web pages (`src/main/shell/GameView.ts`).
- One navigator decides what is on screen (`src/main/shell/ShellNavigator.ts`): every navigation
  (shell buttons, menu shortcuts, links inside the web game, end of login) goes through it, so the bar
  and the content always agree.
- Native pages get their data from the main process, which calls the game's API with the player's
  session cookies (`session.fetch`). Responses are parsed defensively (`src/main/api/parsers.ts`): the
  API is internal to the game, so an unexpected shape degrades to an empty block or an error with a
  retry, never a crash.
- Boarding sends the same request as the web client (`POST /api/v1/player`), after re-checking the
  account server-side; if the server refuses it, the dialog offers the web character selection instead.
- Logging in clicks the web client's own login button, so its OAuth flow and CSRF state are reused
  as-is. When the flow ends (`/token`, then the next game page), the window returns home.

Known limitations:
- The API does not tell a player whether their ship is still boarding (`starting`) or started, so
  the home page shows "resume" in both cases.
- The Eternaltwin session cookie lasts until the app closes (Eternaltwin's choice): after a restart,
  the forum may ask to log in again. The eMush session lasts 7 days.
- "Sign in with Google" on GitLab will not work: Google refuses logins from embedded browsers.

## Security

- `contextIsolation`, `sandbox`, no `nodeIntegration`, no `<webview>` for both the shell and the web view.
- Web pages get two read-only values and no IPC (`src/preload/web.ts`). The shell bridge
  (`src/preload/shell.ts`) only sends page names, ids and commands; the main process checks the
  sender URL and validates every payload (page names, numeric ids, UUIDs, character keys, filters).
- Server text is never injected as HTML: the game's markup is parsed into data and rendered with DOM
  nodes. The shell page has a strict Content-Security-Policy and can't navigate.
- Navigation of the web view is restricted to the game, Eternaltwin and its login providers
  (`LOGIN_PROVIDER_ORIGINS`). Other `http(s)`/`mailto` links go to the system browser; `file:`,
  `javascript:` and custom protocols are blocked. Popups never open windows.
- Browser permissions are limited to notifications, fullscreen and clipboard write, for trusted origins only.
- Dev tools are disabled in packaged builds (unless started with `--devtools`).

## Development

Requires Node.js 22+. Runs on the host (it opens a window), not in Docker.

```bash
cd Desktop
npm install
npm start           # against https://emush.eternaltwin.org
npm run start:local # against the local Docker stack (http://localhost + Eternaltwin on :50320)
npm test            # unit tests (vitest)
npm run typecheck
```

> If `npm install` skipped install scripts, run `node node_modules/electron/install.js` once to download Electron.

In development builds, the terminal logs every navigation of the web view (`[game-view] ...`).

### Configuration

| Flag | Environment variable | Default |
| --- | --- | --- |
| `--server=<url>` | `EMUSH_SERVER_URL` | `https://emush.eternaltwin.org` |
| `--eternaltwin=<url>` | `EMUSH_ETERNALTWIN_URL` | `https://eternaltwin.org` |
| `--steam-app-id=<id>` | `EMUSH_STEAM_APP_ID` | none (Steam disabled) |
| `--devtools` | | enabled in development only |

To try the Steam integration with Steam running, use Valve's test app: `npx electron . --steam-app-id=480`
(your Steam profile will show "Spacewar" while it runs).

## Packaging

```bash
npm run dist:dir   # release/win-unpacked/  -> the folder to upload with SteamPipe
npm run dist       # also builds an NSIS installer for distribution outside Steam
```

The Steamworks native module is unpacked from the asar archive so Steam can load it.
Code signing is not configured yet.

## Code layout

```
src/main/main.ts              composition root (the only file wiring Electron together)
src/main/config/              flags / env -> AppConfig
src/main/api/                 EmushApi, defensive parsers, game text markup; FakeGameServer for tests
src/main/pages/               one loader per native page (pure view models, French formatting)
src/main/shell/               routes, ShellNavigator, GameView (web view), IPC wiring
src/main/navigation/          NavigationPolicy, PermissionPolicy (pure) + Electron guards
src/main/window/              main window, state persistence (store interface + JSON file)
src/main/steam/               SteamGateway interface, Steamworks and offline implementations
src/preload/shell.ts, web.ts  the two preloads (shell bridge / read-only values)
src/shell/                    shell page: navigation, pages, DOM helpers (bundled to dist/shell/shell.js)
static/shell/, offline.html   shell markup and styles, offline page
```

Infrastructure (HTTP, Steam, file storage, the web view) is behind interfaces; tests use handwritten
fakes (`FakeGameServer`, fake web view) and real temporary files, no mocking library.

## Roadmap before a Steam release

These need the eMush team / Eternaltwin, so they are deliberately not done yet:

1. **Agreement** of the eMush team, Eternaltwin and Motion Twin (the "Mush" name and the
   CC-BY-NC-SA assets). The ideal setup is that they own the Steam page.
2. **Steam App ID** and store page, then put the ID in the build (`EMUSH_STEAM_APP_ID` or a bundled config).
3. **Achievements**: the game would emit events (e.g. a `CustomEvent` the preload listens to,
   or a dedicated API endpoint) that the shell forwards to `SteamGateway.unlockAchievement`.
4. **Notifications**: Web Push (service worker + VAPID) does not work in Electron. Native
   notifications need a small polling or WebSocket channel.
5. **More native pages**: death/epitaph, ship end page, then the game's own panels as the API allows.
6. **Code signing** of the Windows executable, auto-update for builds distributed outside Steam,
   and Linux / Steam Deck builds.

## License

Code: AGPL-3.0-or-later. Motion Twin and eMush assets (including the icon, portraits, pixel icons and
sprites): CC-BY-NC-SA-4.0. Both licenses are shipped in the `resources/` folder of packaged builds.
The fonts come from the web client too (Days One and Kanit are under the SIL Open Font License);
the license of Pixel Square must be confirmed before a Steam release.
