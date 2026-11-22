import { BrowserWindow, WebContentsView } from 'electron';
import path from 'node:path';
import { installNavigationGuards } from '../navigation/installNavigationGuards';
import { NavigationPolicy } from '../navigation/NavigationPolicy';
import { SettingsService } from '../background/settings';
import { fitGameZoom, GAME_MODE_CSS, GAME_ZOOM_STEP, isGamePage, manualGameZoom } from './gameMode';
import { ChatRefreshResult, REFRESH_GAME_CHAT } from './refreshGameChat';
import { WebViewPort } from './ShellNavigator';

/** Height of the shell's navigation bar, in CSS pixels (must match --nav-height in shell.css). */
export const NAV_HEIGHT = 64;

/** The web client's own navigation (Eternaltwin bar, banner menu, and the room kept for the bar) is replaced by the shell's. */
const HIDE_WEB_NAVIGATION = '#topBar, .main-container > .banner { display: none !important; } .main-container { padding-top: 0 !important; }';

/** Clicks the web client's login button, so its OAuth flow and CSRF state are used unchanged. */
const CLICK_WEB_LOGIN_BUTTON = `new Promise((resolve) => {
    let tries = 0;
    const timer = setInterval(() => {
        const button = document.querySelector('button.connect');
        if (button) { clearInterval(timer); button.click(); resolve(true); }
        else if (++tries > 50) { clearInterval(timer); resolve(false); }
    }, 100);
})`;

const LOAD_TIMEOUT_MS = 15_000;
const MIN_ZOOM_LEVEL = -3;
const MAX_ZOOM_LEVEL = 3;

export type GameViewOptions = {
    preload: string;
    navigationPolicy: NavigationPolicy;
    staticDir: string;
    serverOrigin: string;
    devTools: boolean;
    /** Game zoom preferences (automatic fit, player adjustment). */
    settings: SettingsService;
};

/**
 * The web game, shown in the window under the shell's navigation bar. Hidden while a native
 * page is shown, but kept alive so returning to the game is instant.
 */
export class GameView implements WebViewPort {
    private readonly view: WebContentsView;
    private visible = false;
    private navigationListener: (url: string) => void = () => undefined;
    /** Key of the game-mode CSS while it is inserted (only on the game page). */
    private gameModeCssKey: string | null = null;
    /** Plain zoom of the other web pages (the game page zoom lives in the settings). */
    private pageZoomLevel = 0;

    constructor(private readonly window: BrowserWindow, private readonly options: GameViewOptions) {
        this.view = new WebContentsView({
            webPreferences: {
                preload: options.preload,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                webviewTag: false,
                spellcheck: false,
                devTools: options.devTools,
            },
        });
        this.view.setBackgroundColor('#070a26');
        this.view.setVisible(false);
        window.contentView.addChildView(this.view);

        const contents = this.view.webContents;
        installNavigationGuards(contents, options.navigationPolicy);
        contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
            const ABORTED = -3; // Replaced by another navigation: not an error.
            if (!isMainFrame || errorCode === ABORTED) {
                return;
            }
            console.warn(`[game-view] Failed to load ${validatedUrl}: ${errorDescription} (${errorCode})`);
            contents.loadFile(path.join(options.staticDir, 'offline.html'), { query: { retry: validatedUrl, error: errorDescription } })
                .catch(() => undefined);
        });
        contents.on('dom-ready', () => {
            this.gameModeCssKey = null; // A new document: previously inserted CSS is gone.
            if (this.isOnGameServer()) {
                contents.insertCSS(HIDE_WEB_NAVIGATION).catch(() => undefined);
            }
            void this.applyPageMode();
        });
        contents.on('did-navigate', (_event, url) => {
            this.trace('navigate', url);
            this.navigationListener(url);
        });
        contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
            if (isMainFrame) {
                this.trace('route', url);
                void this.applyPageMode();
                this.navigationListener(url);
            }
        });
        contents.on('zoom-changed', (_event, direction) => this.zoom(direction === 'in' ? 1 : -1));

        options.settings.onChange((next, previous) => {
            if (next.gameAutoZoom !== previous.gameAutoZoom || next.gameZoomOffset !== previous.gameZoomOffset) {
                this.applyZoom();
            }
        });

        for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const) {
            window.on(event as 'resize', () => this.layout());
        }
    }

    get webContents(): Electron.WebContents {
        return this.view.webContents;
    }

    get isVisible(): boolean {
        return this.visible;
    }

    onNavigation(listener: (url: string) => void): void {
        this.navigationListener = listener;
    }

    open(url: string): void {
        this.trace('open', url);
        this.show();
        if (withoutHash(this.webContents.getURL()) === withoutHash(url)) {
            return;
        }
        this.webContents.loadURL(url).catch(() => undefined); // Failures show the offline page.
    }

    hide(): void {
        if (this.visible) {
            this.trace('hide', this.webContents.getURL());
        }
        this.visible = false;
        this.view.setVisible(false);
        this.window.webContents.focus();
    }

    async clickLogin(): Promise<boolean> {
        if (this.webContents.isLoading()) {
            const loaded = await new Promise<boolean>((resolve) => {
                const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
                this.webContents.once('did-finish-load', () => {
                    clearTimeout(timer);
                    resolve(true);
                });
            });
            if (!loaded) {
                return false;
            }
        }
        if (!this.isOnGameServer()) {
            return false;
        }

        return this.webContents.executeJavaScript(CLICK_WEB_LOGIN_BUTTON).then((clicked) => clicked === true, () => false);
    }

    /** True while the player has the game page itself on screen (not a native page, not the forum). */
    get isShowingGame(): boolean {
        return this.visible && this.isOnGamePage();
    }

    /** Asks the web game to reload its chat (see refreshGameChat.ts). Does nothing off the game page. */
    async refreshChat(): Promise<ChatRefreshResult | 'off-game'> {
        if (!this.isOnGamePage() || this.webContents.isLoading()) {
            return 'off-game';
        }
        const result = await this.webContents.executeJavaScript(REFRESH_GAME_CHAT).catch(() => 'unavailable') as ChatRefreshResult;
        this.trace(`chat ${result}`, this.webContents.getURL());

        return result;
    }

    /** Forgets the page (after logout), so no state of the previous session stays visible. */
    clear(): void {
        this.webContents.loadURL('about:blank').catch(() => undefined);
    }

    reload(): void {
        this.webContents.reload();
    }

    /** One zoom step in or out (direction +1 / -1): 25 % steps over the automatic fit on the game page. */
    zoom(direction: number): void {
        if (this.isOnGamePage()) {
            const offset = this.options.settings.get().gameZoomOffset;
            this.options.settings.update({ gameZoomOffset: offset + Math.sign(direction) * GAME_ZOOM_STEP });
            return;
        } else {
            this.pageZoomLevel = Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, this.pageZoomLevel + Math.sign(direction) * 0.5));
        }
        this.applyZoom();
    }

    resetZoom(): void {
        this.pageZoomLevel = 0;
        this.options.settings.update({ gameZoomOffset: 0 });
        this.applyZoom();
    }

    /** Game mode on the game page (bigger, no footer), normal display elsewhere. */
    private async applyPageMode(): Promise<void> {
        const onGame = this.isOnGamePage();
        if (onGame && this.gameModeCssKey === null) {
            this.gameModeCssKey = await this.webContents.insertCSS(GAME_MODE_CSS).catch(() => null);
        } else if (!onGame && this.gameModeCssKey !== null) {
            const key = this.gameModeCssKey;
            this.gameModeCssKey = null;
            await this.webContents.removeInsertedCSS(key).catch(() => undefined);
        }
        this.applyZoom();
    }

    private applyZoom(): void {
        if (this.isOnGamePage()) {
            const { width, height } = this.view.getBounds();
            const { gameAutoZoom, gameZoomOffset } = this.options.settings.get();
            this.webContents.setZoomFactor(gameAutoZoom ? fitGameZoom({ width, height }, gameZoomOffset) : manualGameZoom(gameZoomOffset));
        } else {
            this.webContents.setZoomLevel(this.pageZoomLevel);
        }
    }

    private isOnGamePage(): boolean {
        return isGamePage(this.webContents.getURL(), this.options.serverOrigin);
    }

    private show(): void {
        this.visible = true;
        this.layout();
        this.view.setVisible(true);
        this.webContents.focus();
    }

    private layout(): void {
        const { width, height } = this.window.getContentBounds();
        this.view.setBounds({ x: 0, y: NAV_HEIGHT, width, height: Math.max(0, height - NAV_HEIGHT) });
        this.applyZoom();
    }

    /** Navigation log in development builds, to understand the web client's redirects. */
    private trace(kind: string, url: string): void {
        if (this.options.devTools) {
            console.info(`[game-view] ${kind} ${url}${this.visible ? '' : ' (hidden)'}`);
        }
    }

    private isOnGameServer(): boolean {
        try {
            return new URL(this.webContents.getURL()).origin === this.options.serverOrigin;
        } catch {
            return false;
        }
    }
}

function withoutHash(url: string): string {
    return url.split('#')[0];
}
