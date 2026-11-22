import { app, BrowserWindow } from 'electron';
import { EmushApi } from '../api/EmushApi';
import { statusLine } from '../background/events';
import { GameSnapshot, PreviewLatestMessage, TakeGameSnapshot } from '../background/GameSnapshot';
import { GameWatcher } from '../background/GameWatcher';
import { SettingsService } from '../background/settings';
import { ShellNavigator } from '../shell/ShellNavigator';
import { ElectronNotifier } from './ElectronNotifier';
import { TrayController } from './TrayController';

export type BackgroundDependencies = {
    window: BrowserWindow;
    api: EmushApi;
    navigator: ShellNavigator;
    settings: SettingsService;
    icons: { tray: string; badge: string; notification: string };
    /** Logs every check (development builds). */
    trace: boolean;
};

export type Background = {
    quit(): void;
    testNotification(): void;
};

/**
 * Keeps eMush alive in the background: notification-area icon, close/minimize to the tray,
 * and the game watch that raises Windows notifications for cycles, days, alerts and chat messages.
 */
export function installBackground({ window, api, navigator, settings, icons, trace }: BackgroundDependencies): Background {
    let quitting = false;

    const openWindow = (): void => {
        if (window.isDestroyed()) {
            return;
        }
        if (window.isMinimized()) {
            window.restore();
        }
        window.show();
        window.focus();
    };
    const resumeGame = (): void => {
        openWindow();
        navigator.go({ page: 'game' });
    };
    const quit = (): void => {
        quitting = true;
        app.quit();
    };

    const notifier = new ElectronNotifier(icons.notification, () => {
        if (watcher.lastSnapshot?.state === 'alive') {
            resumeGame();
        } else {
            openWindow();
        }
    });
    const testNotification = (): void => notifier.notify({
        title: 'Notifications eMush actives',
        body: 'Tu seras prévenu des nouveaux cycles, des nouveaux jours, des alertes et des messages.',
    });

    const tray = new TrayController(window, settings, { tray: icons.tray, badge: icons.badge }, {
        openWindow,
        resumeGame,
        openSettings: () => {
            openWindow();
            navigator.go({ page: 'settings' });
        },
        testNotification,
        quit,
    });

    const status = {
        update: (snapshot: GameSnapshot) => {
            if (trace) {
                console.info(`[watch] ${statusLine(snapshot)}`);
            }
            tray.update(snapshot);
        },
        attention: () => tray.attention(),
    };

    const previews = new PreviewLatestMessage(api);
    const watcher = new GameWatcher({
        takeSnapshot: () => new TakeGameSnapshot(api).execute(),
        previewMessage: (channelIds) => previews.execute(channelIds),
        notifier,
        status,
        settings: () => settings.get(),
        isPlayerLooking: () => window.isVisible() && !window.isMinimized() && window.isFocused(),
        schedule: (callback, delay) => {
            const timer = setTimeout(callback, delay);
            return () => clearTimeout(timer);
        },
        now: () => new Date(),
    });

    const hideToTray = (): void => {
        window.hide();
        if (!settings.get().trayHintShown) {
            settings.update({ trayHintShown: true });
            notifier.notify({
                title: 'eMush continue en arrière-plan',
                body: 'Tu seras prévenu des nouveaux cycles et messages. Clique sur l\'icône eMush près de l\'horloge pour revenir.',
            });
        }
    };

    app.on('before-quit', () => {
        quitting = true;
        watcher.stop();
    });
    window.on('close', (event) => {
        if (!quitting && settings.get().closeToTray) {
            event.preventDefault();
            hideToTray();
        }
    });
    window.on('minimize', () => {
        if (settings.get().minimizeToTray) {
            hideToTray();
        }
    });
    window.on('show', () => watcher.checkNow());
    window.on('restore', () => watcher.checkNow());
    window.on('closed', () => tray.destroy());
    settings.onChange(() => watcher.checkNow());

    watcher.start();

    return { quit, testNotification };
}
