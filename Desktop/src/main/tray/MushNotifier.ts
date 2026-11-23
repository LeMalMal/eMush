import { BrowserWindow, ipcMain, IpcMainEvent, Rectangle, screen } from 'electron';
import { NotificationText } from '../background/events';
import { Notifier } from '../background/GameWatcher';
import { toastView, ToastView } from './toastView';

export const TOAST_WIDTH = 360;
const SCREEN_MARGIN = 12;
/** More would cover the screen: the oldest notifications leave first. */
const MAX_TOASTS = 3;
const MAX_HEIGHT = 900;

export type MushNotifierDependencies = {
    /** The toast page (static/toast/index.html) and its preload. */
    file: string;
    preload: string;
    devTools: boolean;
    /** A notification clicked: what it is about is opened (the game, a message, the epitaph...). */
    onClick(text: NotificationText): void;
    /** A window the notifications must not cover (the mini panel when it is shown). */
    avoid(): Rectangle | null;
    /** The sound played with a new notification (a file URL), or null for none. */
    chime(): string | null;
    trace: boolean;
};

/**
 * Where the notifications go: the bottom-right corner of the screen, just above the clock, or next to
 * the window to avoid when it is there.
 */
export function toastBounds(workArea: Rectangle, height: number, avoid: Rectangle | null = null): Rectangle {
    const fitted = Math.min(height, workArea.height - 2 * SCREEN_MARGIN);
    const corner = { x: workArea.x + workArea.width - TOAST_WIDTH - SCREEN_MARGIN, y: workArea.y + workArea.height - fitted - SCREEN_MARGIN, width: TOAST_WIDTH, height: fitted };
    if (avoid === null || !overlaps(corner, avoid)) {
        return corner;
    }

    return { ...corner, x: Math.max(workArea.x + SCREEN_MARGIN, avoid.x - TOAST_WIDTH - SCREEN_MARGIN) };
}

function overlaps(a: Rectangle, b: Rectangle): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Notifications in the game's own look (cycles, days, alerts, messages, death) instead of the Windows
 * ones: a small frameless window next to the clock that never takes the focus. Each notification
 * leaves after a few seconds (later while the mouse is over them), or when clicked or closed.
 */
export class MushNotifier implements Notifier {
    private readonly toasts: { view: ToastView; text: NotificationText }[] = [];
    private window: BrowserWindow | null = null;
    private pageReady = false;
    private chimePending = false;
    private nextId = 1;

    constructor(private readonly deps: MushNotifierDependencies) {
        ipcMain.on('toast:click', (event, id: unknown) => {
            const toast = this.fromToasts(event) ? this.take(id) : null;
            if (toast !== null) {
                this.deps.onClick(toast.text);
            }
        });
        ipcMain.on('toast:dismiss', (event, id: unknown) => {
            if (this.fromToasts(event)) {
                this.take(id);
            }
        });
        ipcMain.on('toast:height', (event, height: unknown) => {
            if (this.fromToasts(event) && typeof height === 'number' && Number.isFinite(height) && height > 0 && height <= MAX_HEIGHT) {
                this.place(Math.ceil(height));
            }
        });
    }

    notify(text: NotificationText): void {
        this.toasts.push({ view: toastView(this.nextId++, text), text });
        this.toasts.splice(0, Math.max(0, this.toasts.length - MAX_TOASTS));
        this.publish(true);
        this.log(`shown: ${text.title}`);
    }

    private publish(chime: boolean): void {
        if (this.toasts.length === 0) {
            this.window?.hide();
            return;
        }
        const window = this.window ?? this.create();
        if (!this.pageReady) {
            this.chimePending ||= chime;
            return;
        }
        window.webContents.send('toast:show', { toasts: this.toasts.map((toast) => toast.view), chime: chime ? this.deps.chime() : null });
    }

    /** Removes a notification (clicked or gone) and returns it; null for an unknown id. */
    private take(id: unknown): { view: ToastView; text: NotificationText } | null {
        const index = this.toasts.findIndex((toast) => toast.view.id === id);
        if (index < 0) {
            return null;
        }
        const [toast] = this.toasts.splice(index, 1);
        this.publish(false);

        return toast;
    }

    /** The page measured its notifications: the window takes their height, in its corner. */
    private place(height: number): void {
        const window = this.window;
        if (window === null || this.toasts.length === 0) {
            return;
        }
        window.setBounds(toastBounds(screen.getPrimaryDisplay().workArea, height, this.deps.avoid()));
        if (!window.isVisible()) {
            window.showInactive(); // Never takes the focus from what the player is doing.
        }
    }

    private create(): BrowserWindow {
        const window = new BrowserWindow({
            width: TOAST_WIDTH,
            height: 120,
            show: false,
            frame: false,
            transparent: true,
            hasShadow: false,
            resizable: false,
            movable: false,
            maximizable: false,
            minimizable: false,
            fullscreenable: false,
            focusable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            title: 'eMush',
            webPreferences: {
                preload: this.deps.preload,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                webviewTag: false,
                spellcheck: false,
                // The page counts each notification down while the window may still be hidden.
                backgroundThrottling: false,
                devTools: this.deps.devTools,
            },
        });
        window.setAlwaysOnTop(true, 'pop-up-menu');
        window.webContents.on('will-navigate', (event) => event.preventDefault());
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.webContents.once('did-finish-load', () => {
            this.pageReady = true;
            const chime = this.chimePending;
            this.chimePending = false;
            this.publish(chime);
        });
        window.on('closed', () => {
            this.window = null;
            this.pageReady = false;
        });
        window.loadFile(this.deps.file).catch((error) => console.error('[notify] Could not load the notifications page:', error));
        this.window = window;

        return window;
    }

    private fromToasts(event: IpcMainEvent): boolean {
        return this.window !== null && event.sender === this.window.webContents;
    }

    private log(message: string): void {
        if (this.deps.trace) {
            console.info(`[notify] ${message}`);
        }
    }
}
