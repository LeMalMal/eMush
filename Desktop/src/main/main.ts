import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import path from 'node:path';
import { EmushApi } from './api/EmushApi';
import { sessionHttp } from './api/sessionHttp';
import { InvalidConfigError, loadAppConfig } from './config/AppConfig';
import { buildApplicationMenu } from './menu/buildApplicationMenu';
import { NavigationPolicy } from './navigation/NavigationPolicy';
import { PermissionPolicy } from './navigation/PermissionPolicy';
import { resolveGameLanguage } from './shell/gameLanguage';
import { GameView } from './shell/GameView';
import { installContextMenu } from './shell/installContextMenu';
import { installSpellcheck } from './shell/installSpellcheck';
import { installShell } from './shell/installShell';
import { connectToSteam } from './steam/connectToSteam';
import { createMainWindow } from './window/createMainWindow';
import { JsonFileWindowStateStore } from './window/JsonFileWindowStateStore';
import { JsonFileSettingsStore, SettingsService } from './background/settings';
import { LoadSettings, UpdateSettings } from './pages/settings';
import { Background, installBackground } from './tray/installBackground';

// Composition root: everything is wired here, the modules themselves stay framework-light.

/** Must match `appId` in electron-builder.yml (used by the installer's Start menu shortcut). */
const APP_USER_MODEL_ID = 'io.github.lemalmal.emush-desktop';
/** Passed by Windows when it starts eMush at login (see applyLaunchAtStartup). */
const STARTED_WITH_WINDOWS_FLAG = '--started-with-windows';
const SOURCE_CODE_URL = 'https://github.com/LeMalMal/eMush/tree/feat/desktop-client/Desktop';

/** Registers (or removes) eMush in the Windows startup apps. Installed builds only. */
function applyLaunchAtStartup(enabled: boolean): void {
    if (app.isPackaged) {
        app.setLoginItemSettings({ openAtLogin: enabled, args: [STARTED_WITH_WINDOWS_FLAG] });
    }
}

function start(): void {
    if (!app.requestSingleInstanceLock()) {
        app.quit();
        return;
    }

    const config = readConfigOrExit();
    if (config === null) {
        return;
    }

    // Steam must be initialised before `ready` so its overlay switches apply to Chromium.
    const steam = connectToSteam(config.steamAppId, { relaunchThroughSteam: app.isPackaged });
    if (steam.status === 'restart-through-steam') {
        app.quit();
        return;
    }
    console.info(`[steam] ${steam.status}${steam.status === 'unavailable' ? `: ${steam.reason}` : ''}`);

    const navigationPolicy = new NavigationPolicy(config.inAppOrigins);
    const permissionPolicy = new PermissionPolicy(config.trustedOrigins);
    let mainWindow: BrowserWindow | null = null;

    app.on('second-instance', () => {
        if (mainWindow === null) {
            return;
        }
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show(); // It may be hidden in the notification area.
        mainWindow.focus();
    });

    if (app.isPackaged) {
        app.setAppUserModelId(APP_USER_MODEL_ID); // Windows notifications are attributed to eMush.
    }

    app.on('window-all-closed', () => app.quit());

    void app.whenReady().then(() => {
        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
            callback(permissionPolicy.execute(permission, webContents.getURL()));
        });
        session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
            return permissionPolicy.execute(permission, requestingOrigin);
        });

        const distDir = path.join(__dirname, '..');
        const staticDir = path.join(distDir, 'static');
        const settings = new SettingsService(new JsonFileSettingsStore(path.join(app.getPath('userData'), 'settings.json')));
        applyLaunchAtStartup(settings.get().launchAtStartup);
        settings.onChange((next, previous) => {
            if (next.launchAtStartup !== previous.launchAtStartup) {
                applyLaunchAtStartup(next.launchAtStartup);
            }
        });
        const startedWithWindows = process.argv.includes(STARTED_WITH_WINDOWS_FLAG);
        const systemLanguages = systemLanguagesOf(app);

        const window = createMainWindow({
            windowStateStore: new JsonFileWindowStateStore(path.join(app.getPath('userData'), 'window-state.json')),
            iconPath: resolveIconPath(),
            shellPreload: path.join(distDir, 'preload', 'shell.js'),
            devTools: config.devTools,
            showOnReady: !(startedWithWindows && settings.get().startMinimized),
        });
        mainWindow = window;
        window.on('closed', () => {
            mainWindow = null;
        });

        const gameView = new GameView(window, {
            preload: path.join(distDir, 'preload', 'web.js'),
            navigationPolicy,
            staticDir,
            serverOrigin: config.serverUrl.origin,
            devTools: config.devTools,
            settings,
            systemLanguages,
        });
        installSpellcheck(session.defaultSession, settings, systemLanguages, config.devTools);
        installContextMenu(window.webContents, window);
        installContextMenu(gameView.webContents, window);
        const api = new EmushApi(config.serverUrl, sessionHttp(session.defaultSession));
        const client = {
            version: app.getVersion(),
            canLaunchAtStartup: app.isPackaged,
            sourceCodeUrl: SOURCE_CODE_URL,
            systemGameLanguage: resolveGameLanguage('auto', systemLanguages),
        };
        let background: Background | null = null;
        const shell = installShell({
            window,
            shellFile: path.join(staticDir, 'shell', 'index.html'),
            gameView,
            serverUrl: config.serverUrl,
            api,
            session: session.defaultSession,
            navigationPolicy,
            settingsPage: { load: new LoadSettings(settings, client), update: new UpdateSettings(settings, client) },
            testNotification: () => background?.testNotification(),
        });

        background = installBackground({
            window,
            api,
            navigator: shell.navigator,
            settings,
            icons: {
                tray: path.join(staticDir, 'icons', 'tray.png'),
                badge: path.join(staticDir, 'icons', 'badge.png'),
                notification: path.join(staticDir, 'icons', 'notification.png'),
            },
            mini: {
                file: path.join(staticDir, 'mini', 'index.html'),
                preload: path.join(distDir, 'preload', 'mini.js'),
                devTools: config.devTools,
            },
            toasts: {
                file: path.join(staticDir, 'toast', 'index.html'),
                preload: path.join(distDir, 'preload', 'toast.js'),
            },
            game: gameView,
            trace: config.devTools,
        });

        Menu.setApplicationMenu(buildApplicationMenu({
            devTools: config.devTools,
            actions: {
                showHome: shell.showHome,
                reload: shell.reload,
                zoomIn: () => gameView.zoom(1),
                zoomOut: () => gameView.zoom(-1),
                resetZoom: () => gameView.resetZoom(),
                toggleDevTools: () => (gameView.isVisible ? gameView.webContents : window.webContents).toggleDevTools(),
                togglePanel: () => background?.togglePanel(),
                find: shell.openFind,
            },
        }));

        steam.gateway.setRichPresence('status', 'En jeu sur eMush');
    });
}

function readConfigOrExit() {
    try {
        return loadAppConfig({ argv: process.argv, env: process.env, isPackaged: app.isPackaged });
    } catch (error) {
        if (!(error instanceof InvalidConfigError)) {
            throw error;
        }
        dialog.showErrorBox('eMush — configuration invalide', error.message);
        app.exit(1);

        return null;
    }
}

/** Languages of Windows, most preferred first (`fr-FR`, `en-US`...). */
function systemLanguagesOf(electronApp: Electron.App): string[] {
    const preferred = electronApp.getPreferredSystemLanguages();
    return preferred.length > 0 ? preferred : [electronApp.getLocale()];
}

function resolveIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(app.getAppPath(), '..', 'App', 'public', 'pwa-512x512.png');
}

start();
