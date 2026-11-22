import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import path from 'node:path';
import { EmushApi } from './api/EmushApi';
import { sessionHttp } from './api/sessionHttp';
import { InvalidConfigError, loadAppConfig } from './config/AppConfig';
import { buildApplicationMenu } from './menu/buildApplicationMenu';
import { NavigationPolicy } from './navigation/NavigationPolicy';
import { PermissionPolicy } from './navigation/PermissionPolicy';
import { GameView } from './shell/GameView';
import { installShell } from './shell/installShell';
import { connectToSteam } from './steam/connectToSteam';
import { createMainWindow } from './window/createMainWindow';
import { JsonFileWindowStateStore } from './window/JsonFileWindowStateStore';

// Composition root: everything is wired here, the modules themselves stay framework-light.

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
        mainWindow.focus();
    });

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
        const window = createMainWindow({
            windowStateStore: new JsonFileWindowStateStore(path.join(app.getPath('userData'), 'window-state.json')),
            iconPath: resolveIconPath(),
            shellPreload: path.join(distDir, 'preload', 'shell.js'),
            devTools: config.devTools,
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
        });
        const shell = installShell({
            window,
            shellFile: path.join(staticDir, 'shell', 'index.html'),
            gameView,
            serverUrl: config.serverUrl,
            api: new EmushApi(config.serverUrl, sessionHttp(session.defaultSession)),
            session: session.defaultSession,
            navigationPolicy,
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

function resolveIconPath(): string {
    return app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(app.getAppPath(), '..', 'App', 'public', 'pwa-512x512.png');
}

start();
