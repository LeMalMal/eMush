import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent, screen } from 'electron';
import { LoadMiniPanel } from '../pages/mini';

export const MINI_SIZE = { width: 360, height: 600 };
const SCREEN_MARGIN = 12;
const MINI_COMMANDS = ['open-game', 'open-window', 'pin', 'unpin', 'close'] as const;
type MiniCommand = typeof MINI_COMMANDS[number];

export type MiniPanelDependencies = {
    file: string;
    preload: string;
    iconPath: string;
    loadView: LoadMiniPanel;
    openGame(): void;
    openWindow(): void;
    devTools: boolean;
};

/** Bottom-right corner of the screen's work area, just above the clock. */
export function panelPosition(workArea: { x: number; y: number; width: number; height: number }, size = MINI_SIZE): { x: number; y: number } {
    return {
        x: workArea.x + workArea.width - size.width - SCREEN_MARGIN,
        y: workArea.y + workArea.height - size.height - SCREEN_MARGIN,
    };
}

/**
 * Small eMush panel next to the clock: points, countdown to the next cycle, alerts, chat.
 * It closes when the player clicks elsewhere, unless pinned (then it stays on top and can be moved).
 */
export class MiniPanel {
    private window: BrowserWindow | null = null;
    private pinned = false;

    constructor(private readonly deps: MiniPanelDependencies) {
        ipcMain.handle('mini:load', (event) => {
            if (!this.isFromPanel(event)) {
                return { ok: false, message: 'Requête refusée.' };
            }
            return deps.loadView.execute();
        });
        ipcMain.on('mini:command', (event, command: unknown) => {
            if (!this.isFromPanel(event) || !(MINI_COMMANDS as readonly unknown[]).includes(command)) {
                console.warn('[mini] Rejected command', command);
                return;
            }
            this.run(command as MiniCommand);
        });
    }

    toggle(): void {
        if (this.window?.isVisible() && !this.pinned) {
            this.window.hide();
            return;
        }
        this.show();
    }

    show(): void {
        const window = this.window ?? this.create();
        if (!this.pinned) {
            const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
            const { x, y } = panelPosition(display.workArea);
            window.setBounds({ x, y, ...MINI_SIZE });
        }
        window.show();
        window.focus();
        window.webContents.send('mini:refresh');
    }

    private create(): BrowserWindow {
        const window = new BrowserWindow({
            ...MINI_SIZE,
            show: false,
            frame: false,
            resizable: false,
            maximizable: false,
            minimizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            title: 'eMush',
            icon: this.deps.iconPath,
            backgroundColor: '#070a26',
            webPreferences: {
                preload: this.deps.preload,
                contextIsolation: true,
                sandbox: true,
                nodeIntegration: false,
                webviewTag: false,
                spellcheck: false,
                devTools: this.deps.devTools,
            },
        });
        window.webContents.on('will-navigate', (event) => event.preventDefault());
        window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        window.on('blur', () => {
            if (!this.pinned) {
                window.hide();
            }
        });
        window.on('closed', () => {
            this.window = null;
            this.pinned = false;
        });
        window.loadFile(this.deps.file).catch((error) => console.error('[mini] Could not load the panel:', error));
        this.window = window;

        return window;
    }

    private run(command: MiniCommand): void {
        const window = this.window;
        switch (command) {
            case 'open-game':
                this.hideUnlessPinned();
                this.deps.openGame();
                break;
            case 'open-window':
                this.hideUnlessPinned();
                this.deps.openWindow();
                break;
            case 'pin':
            case 'unpin':
                this.pinned = command === 'pin';
                window?.setAlwaysOnTop(this.pinned, 'floating');
                window?.webContents.send('mini:pinned', this.pinned);
                break;
            case 'close':
                this.pinned = false;
                window?.setAlwaysOnTop(false);
                window?.hide();
                break;
        }
    }

    /** A pinned panel stays on screen whatever happens to the main window; only its × closes it. */
    private hideUnlessPinned(): void {
        if (!this.pinned) {
            this.window?.hide();
        }
    }

    private isFromPanel(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
        return this.window !== null && event.sender === this.window.webContents;
    }
}
