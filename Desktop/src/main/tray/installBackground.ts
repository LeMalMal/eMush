import { app, BrowserWindow } from 'electron';
import { EmushApi } from '../api/EmushApi';
import { ChatTarget, statusLine } from '../background/events';
import { GameSnapshot, ReadNewMessages, TakeGameSnapshot } from '../background/GameSnapshot';
import { GameWatcher } from '../background/GameWatcher';
import { SettingsService } from '../background/settings';
import { FocusRefreshThrottle } from '../shell/refreshGameChat';
import { ShellNavigator } from '../shell/ShellNavigator';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MushNotifier } from './MushNotifier';
import { TrayController } from './TrayController';
import { MiniPanel } from '../mini/MiniPanel';
import { LoadMiniPanel } from '../pages/mini';
import { SendChatMessage } from '../pages/sendMessage';

export type BackgroundDependencies = {
    window: BrowserWindow;
    api: EmushApi;
    navigator: ShellNavigator;
    settings: SettingsService;
    icons: { tray: string; badge: string; notification: string };
    /** The small panel next to the clock. */
    mini: { file: string; preload: string; devTools: boolean };
    /** The Mush-styled notifications' page and preload. */
    toasts: { file: string; preload: string };
    /** The web game, whose chat is reloaded when new messages arrive (it has no live updates). */
    game: { readonly isShowingGame: boolean; refreshChat(): Promise<unknown>; showMessage(target: ChatTarget): Promise<unknown> };
    /** Logs every check (development builds). */
    trace: boolean;
};

export type Background = {
    quit(): void;
    testNotification(): void;
    togglePanel(): void;
};

/**
 * Keeps eMush alive in the background: notification-area icon, close/minimize to the tray,
 * and the game watch that raises Windows notifications for cycles, days, alerts and chat messages.
 */
export function installBackground({ window, api, navigator, settings, icons, mini, toasts, game, trace }: BackgroundDependencies): Background {
    let quitting = false;
    const focusRefresh = new FocusRefreshThrottle();

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
    const openDeath = (): void => {
        openWindow();
        navigator.go({ page: 'death' });
    };
    const quit = (): void => {
        quitting = true;
        app.quit();
    };

    const chime = windowsNotificationSound();
    const notifier = new MushNotifier({
        file: toasts.file,
        preload: toasts.preload,
        devTools: mini.devTools,
        onClick: (clicked) => {
            const state = watcher.lastSnapshot?.state;
            if (state === 'alive') {
                resumeGame();
                if (clicked.chat !== undefined) {
                    void game.showMessage(clicked.chat); // Its channel, scrolled to the message.
                }
            } else if (state === 'dead') {
                openDeath();
            } else {
                openWindow();
            }
        },
        avoid: () => panel.visibleBounds,
        chime: () => (settings.get().notificationSound ? chime : null),
        trace,
    });
    const testNotification = (): void => notifier.notify({
        title: 'Notifications eMush actives',
        body: 'Tu seras prévenu des nouveaux cycles, des nouveaux jours, des alertes et des messages.',
        visual: { kind: 'info' },
    });

    const panel = new MiniPanel({
        file: mini.file,
        preload: mini.preload,
        devTools: mini.devTools,
        iconPath: icons.notification,
        loadView: new LoadMiniPanel(api),
        sendMessage: new SendChatMessage(api),
        onMessageSent: () => void game.refreshChat(),
        showMessage: (target) => {
            resumeGame();
            void game.showMessage(target);
        },
        openGame: resumeGame,
        openWindow,
        openDeath,
    });

    const tray = new TrayController(window, settings, { tray: icons.tray, badge: icons.badge }, {
        openWindow,
        togglePanel: () => panel.toggle(),
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

    const newMessages = new ReadNewMessages(api);
    const watcher = new GameWatcher({
        takeSnapshot: () => new TakeGameSnapshot(api).execute(),
        newMessages: (channels) => newMessages.execute(channels),
        notifier,
        status,
        settings: () => settings.get(),
        isPlayerLooking: () => window.isVisible() && !window.isMinimized() && window.isFocused(),
        isPlayerPlaying: () => window.isVisible() && !window.isMinimized() && window.isFocused() && game.isShowingGame,
        onEvents: (events) => {
            if (events.some((event) => event.kind === 'new-messages')) {
                void game.refreshChat();
                panel.refresh();
            }
        },
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
    // Back on the game (notification click, taskbar, tray): show what was said meanwhile.
    window.on('focus', () => {
        if (game.isShowingGame && focusRefresh.execute(Date.now())) {
            void game.refreshChat();
        }
    });
    window.on('show', () => watcher.checkNow());
    window.on('restore', () => watcher.checkNow());
    window.on('closed', () => tray.destroy());
    settings.onChange(() => watcher.checkNow());

    watcher.start();

    return { quit, testNotification, togglePanel: () => panel.toggle() };
}

/** Windows' own notification sound, as a file URL (null when Windows has none). */
function windowsNotificationSound(): string | null {
    const file = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Media', 'Windows Notify System Generic.wav');

    return fs.existsSync(file) ? pathToFileURL(file).toString() : null;
}
