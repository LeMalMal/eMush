import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent, Session, shell } from 'electron';
import { pathToFileURL } from 'node:url';
import { EmushApi } from '../api/EmushApi';
import { NavigationPolicy } from '../navigation/NavigationPolicy';
import { JoinCrew, LoadCrew } from '../pages/crew';
import { EndAdventure, LoadDeath } from '../pages/death';
import { LoadShipEnd } from '../pages/shipEnd';
import { LoadAccount, LoadHome } from '../pages/home';
import { LoadArticle, LoadNews } from '../pages/news';
import { LoadProfile } from '../pages/profile';
import { LoadRanking } from '../pages/ranking';
import { LoadSettings, UpdateSettings } from '../pages/settings';
import { GameView } from './GameView';
import { EMUSH_WIKI_URL, Navigation, parseNavigation, resolvePlay } from './routes';
import { ShellNavigator } from './ShellNavigator';

export type ShellDependencies = {
    window: BrowserWindow;
    shellFile: string;
    gameView: GameView;
    serverUrl: URL;
    api: EmushApi;
    session: Session;
    navigationPolicy: NavigationPolicy;
    settingsPage: { load: LoadSettings; update: UpdateSettings };
    testNotification(): void;
};

export type Shell = {
    navigator: ShellNavigator;
    /** Reloads what is on screen: the web page, or the native page's data. */
    reload(): void;
    showHome(): void;
};

const SHELL_COMMANDS = ['play', 'login', 'logout', 'wiki', 'test-notification'] as const;

/**
 * Wires the shell page (navigation bar + native pages) to the main process.
 * Every IPC message is checked: it must come from the shell page itself, with a valid payload.
 */
export function installShell({ window, shellFile, gameView, serverUrl, api, session, navigationPolicy, settingsPage, testNotification }: ShellDependencies): Shell {
    const shellUrl = pathToFileURL(shellFile).toString();
    const shellContents = window.webContents;

    const navigator = new ShellNavigator(serverUrl, gameView, {
        showPage: (navigation: Navigation) => shellContents.send('shell:page', navigation),
    });
    gameView.onNavigation((url) => navigator.onWebNavigation(url));

    const loaders = {
        account: new LoadAccount(api),
        home: new LoadHome(api),
        news: new LoadNews(api),
        article: new LoadArticle(api),
        ranking: new LoadRanking(api),
        profile: new LoadProfile(api),
        crew: new LoadCrew(api),
        death: new LoadDeath(api),
        ship: new LoadShipEnd(api),
        settings: settingsPage.load,
    };
    const joinCrew = new JoinCrew(api);
    const endAdventure = new EndAdventure(api);

    const fromShell = (event: IpcMainEvent | IpcMainInvokeEvent): boolean =>
        event.sender === shellContents && event.senderFrame?.url.split(/[?#]/)[0] === shellUrl;

    const reject = (channel: string, payload: unknown): void => {
        console.warn(`[shell] Rejected ${channel}`, payload);
    };

    // The shell page itself never navigates: everything goes through IPC.
    shellContents.on('will-navigate', (event) => event.preventDefault());
    shellContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    shellContents.on('zoom-changed', () => undefined); // No zoom on the shell: its bar height is fixed.

    ipcMain.handle('shell:load', (event, page: unknown, params: unknown) => {
        if (!fromShell(event) || typeof page !== 'string' || !(page in loaders)) {
            reject('shell:load', page);
            return { ok: false, message: 'Page inconnue.' };
        }

        return loaders[page as keyof typeof loaders].execute(params as never);
    });

    ipcMain.handle('shell:join', async (event, request: unknown) => {
        if (!fromShell(event)) {
            reject('shell:join', request);
            return { ok: false, message: 'Requête refusée.' };
        }
        const result = await joinCrew.execute(request);
        if (result.ok) {
            navigator.go({ page: 'game' });
        }

        return result;
    });

    ipcMain.handle('shell:end-adventure', async (event, request: unknown) => {
        if (!fromShell(event)) {
            reject('shell:end-adventure', request);
            return { ok: false, message: 'Requête refusée.' };
        }
        const result = await endAdventure.execute(request);
        if (result.ok) {
            navigator.go({ page: 'home' });
        }

        return result;
    });

    ipcMain.handle('shell:update-settings', (event, change: unknown) => {
        if (!fromShell(event)) {
            reject('shell:update-settings', change);
            return null;
        }

        return settingsPage.update.execute(change);
    });

    ipcMain.on('shell:navigate', (event, request: unknown) => {
        const navigation = parseNavigation(request);
        if (!fromShell(event) || navigation === null) {
            reject('shell:navigate', request);
            return;
        }
        navigator.go(navigation);
    });

    ipcMain.on('shell:open-link', (event, url: unknown) => {
        if (!fromShell(event) || typeof url !== 'string') {
            reject('shell:open-link', url);
            return;
        }
        const decision = navigationPolicy.execute(url);
        if (decision === 'allow') {
            navigator.openWeb(url);
        } else if (decision === 'open-external') {
            void shell.openExternal(url);
        } else {
            reject('shell:open-link', url);
        }
    });

    ipcMain.on('shell:command', (event, command: unknown) => {
        if (!fromShell(event) || !(SHELL_COMMANDS as readonly unknown[]).includes(command)) {
            reject('shell:command', command);
            return;
        }
        switch (command) {
            case 'play':
                void play();
                break;
            case 'login':
                void navigator.startLogin();
                break;
            case 'logout':
                void logout();
                break;
            case 'wiki':
                void shell.openExternal(EMUSH_WIKI_URL);
                break;
            case 'test-notification':
                testNotification();
                break;
        }
    });

    async function play(): Promise<void> {
        const account = await api.me().catch(() => undefined);
        if (account === undefined) {
            navigator.go({ page: 'home' }); // Server unreachable: the home page explains it.
            return;
        }
        const player = account?.playerId ? await api.player(account.playerId).catch(() => null) : null;
        const destination = resolvePlay(account, player);
        if (destination === 'login') {
            await navigator.startLogin();
        } else {
            navigator.go(destination);
        }
    }

    /** Forgets the eMush session on this computer (the Eternaltwin session stays, as with the website). */
    async function logout(): Promise<void> {
        await session.clearStorageData({ origin: serverUrl.origin, storages: ['cookies', 'localstorage'] });
        gameView.clear();
        navigator.go({ page: 'home' });
    }

    // The shell page announces itself once its script runs, and gets the page to draw. It never
    // receives a fixed "home": a navigation made meanwhile (or before a reload) is kept.
    ipcMain.on('shell:ready', (event) => {
        if (fromShell(event)) {
            shellContents.send('shell:page', navigator.currentPage);
        }
    });

    const showHome = (): void => navigator.go({ page: 'home' });

    shellContents.loadFile(shellFile).catch((error) => console.error('[shell] Could not load the shell page:', error));

    return {
        navigator,
        showHome,
        reload: () => {
            if (gameView.isVisible) {
                gameView.reload();
            } else {
                shellContents.send('shell:reload');
            }
        },
    };
}
