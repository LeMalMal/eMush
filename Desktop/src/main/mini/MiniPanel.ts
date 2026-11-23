import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent, screen } from 'electron';
import type { ChatTarget } from '../background/events';
import { LoadMiniPanel, parseChatTarget } from '../pages/mini';
import { SendChatMessage } from '../pages/sendMessage';

/** Tall enough for the chat and its message field; smaller screens get the height they have. */
export const MINI_SIZE = { width: 360, height: 720 };
const SCREEN_MARGIN = 12;
const MINI_COMMANDS = ['open-game', 'open-window', 'open-death', 'pin', 'unpin', 'close'] as const;
type MiniCommand = typeof MINI_COMMANDS[number];

export type MiniPanelDependencies = {
    file: string;
    preload: string;
    iconPath: string;
    loadView: LoadMiniPanel;
    /** Writes in the chat from the panel (checked again with the server). */
    sendMessage: SendChatMessage;
    /** A message was sent from the panel: the game's own chat shows it too. */
    onMessageSent(): void;
    /** A message clicked in the panel: shown in the game (its channel, scrolled to it). */
    showMessage(target: ChatTarget): void;
    openGame(): void;
    openWindow(): void;
    /** The death page, where the epitaph is written. */
    openDeath(): void;
    devTools: boolean;
};

/** Bottom-right corner of the screen's work area, just above the clock, never taller than the screen. */
export function panelBounds(workArea: { x: number; y: number; width: number; height: number }, size = MINI_SIZE): { x: number; y: number; width: number; height: number } {
    const height = Math.min(size.height, workArea.height - 2 * SCREEN_MARGIN);

    return {
        x: workArea.x + workArea.width - size.width - SCREEN_MARGIN,
        y: workArea.y + workArea.height - height - SCREEN_MARGIN,
        width: size.width,
        height,
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
        ipcMain.handle('mini:load', (event, channelChoice: unknown) => {
            if (!this.isFromPanel(event)) {
                return { ok: false, message: 'Requête refusée.' };
            }
            return deps.loadView.execute(channelChoice);
        });
        ipcMain.on('mini:show-message', (event, value: unknown) => {
            const target = parseChatTarget(value);
            if (!this.isFromPanel(event) || target === null) {
                console.warn('[mini] Rejected message to show', value);
                return;
            }
            this.hideUnlessPinned();
            deps.showMessage(target);
        });
        ipcMain.handle('mini:send', async (event, request: unknown) => {
            if (!this.isFromPanel(event)) {
                console.warn('[mini] Rejected message');
                return { ok: false, message: 'Requête refusée.' };
            }
            const result = await deps.sendMessage.execute(request);
            if (result.ok) {
                deps.onMessageSent();
            }

            return result;
        });
        ipcMain.on('mini:command', (event, command: unknown) => {
            if (!this.isFromPanel(event) || !(MINI_COMMANDS as readonly unknown[]).includes(command)) {
                console.warn('[mini] Rejected command', command);
                return;
            }
            this.run(command as MiniCommand);
        });
    }

    /** New messages arrived: an open panel shows them now (it waits if the player is writing). */
    refresh(): void {
        if (this.window?.isVisible()) {
            this.window.webContents.send('mini:refresh');
        }
    }

    /** Where the panel is while it is shown (the notifications go next to it). */
    get visibleBounds(): Electron.Rectangle | null {
        return this.window?.isVisible() ? this.window.getBounds() : null;
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
            window.setBounds(panelBounds(display.workArea));
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
                spellcheck: true, // The reply field (the client's spellchecker setting applies).
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
            case 'open-death':
                this.hideUnlessPinned();
                this.deps.openDeath();
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
