import { BrowserWindow } from 'electron';
import { WindowStateStore } from './WindowState';

const SAVE_DELAY_MS = 500;

/** Saves size, position, maximized and fullscreen state whenever they change. */
export function trackWindowState(window: BrowserWindow, store: WindowStateStore): void {
    let pendingSave: NodeJS.Timeout | undefined;

    const save = (): void => {
        if (window.isDestroyed() || window.isMinimized()) {
            return;
        }

        const bounds = window.getNormalBounds();
        store.save({
            ...bounds,
            isMaximized: window.isMaximized(),
            isFullScreen: window.isFullScreen(),
        });
    };

    const scheduleSave = (): void => {
        clearTimeout(pendingSave);
        pendingSave = setTimeout(save, SAVE_DELAY_MS);
    };

    for (const event of ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const) {
        window.on(event as 'resize', scheduleSave);
    }

    window.on('close', () => {
        clearTimeout(pendingSave);
        save();
    });
}
