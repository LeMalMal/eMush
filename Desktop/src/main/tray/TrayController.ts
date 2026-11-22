import { BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, NativeImage, Tray } from 'electron';
import { statusLine } from '../background/events';
import { GameSnapshot } from '../background/GameSnapshot';
import { StatusSink } from '../background/GameWatcher';
import { AppSettings, SettingsService } from '../background/settings';

export type TrayActions = {
    openWindow(): void;
    resumeGame(): void;
    openSettings(): void;
    testNotification(): void;
    quit(): void;
};

type BooleanSetting = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];
type SettingToggle = { key: BooleanSetting; label: string };

const NOTIFICATION_TOGGLES: SettingToggle[] = [
    { key: 'newCycles', label: 'Nouveaux cycles' },
    { key: 'newDays', label: 'Nouveaux jours' },
    { key: 'messages', label: 'Nouveaux messages' },
    { key: 'alerts', label: 'Alertes du vaisseau' },
];

const WINDOW_TOGGLES: SettingToggle[] = [
    { key: 'closeToTray', label: 'Fermer la fenêtre garde eMush en arrière-plan' },
    { key: 'minimizeToTray', label: 'Réduire dans la zone de notification' },
];

/**
 * eMush in the Windows notification area (next to the clock), plus the taskbar touches:
 * a badge while chat messages are unread, a flash when a cycle, a day or an alert begins.
 */
export class TrayController implements StatusSink {
    private readonly tray: Tray;
    private readonly badge: NativeImage;
    private snapshot: GameSnapshot | null = null;

    constructor(
        private readonly window: BrowserWindow,
        private readonly settings: SettingsService,
        icons: { tray: string; badge: string },
        private readonly actions: TrayActions,
    ) {
        this.tray = new Tray(nativeImage.createFromPath(icons.tray).resize({ width: 32, height: 32, quality: 'best' }));
        this.badge = nativeImage.createFromPath(icons.badge).resize({ width: 16, height: 16, quality: 'best' });
        this.tray.setToolTip('eMush');
        this.tray.on('click', () => this.actions.openWindow());
        this.tray.on('double-click', () => this.actions.openWindow());
        window.on('focus', () => window.flashFrame(false));
        settings.onChange(() => this.rebuildMenu());
        this.rebuildMenu();
    }

    update(snapshot: GameSnapshot): void {
        this.snapshot = snapshot;
        this.tray.setToolTip(`eMush — ${statusLine(snapshot)}`);
        const unread = snapshot.state === 'alive' ? snapshot.unread : 0;
        if (!this.window.isDestroyed()) {
            this.window.setOverlayIcon(unread > 0 ? this.badge : null, unread > 0 ? `${unread} messages non lus` : '');
        }
        this.rebuildMenu();
    }

    attention(): void {
        if (!this.window.isDestroyed() && !this.window.isFocused()) {
            this.window.flashFrame(true);
        }
    }

    destroy(): void {
        this.tray.destroy();
    }

    private rebuildMenu(): void {
        const settings = this.settings.get();
        const toggle = ({ key, label }: SettingToggle): MenuItemConstructorOptions => ({
            label,
            type: 'checkbox',
            checked: settings[key],
            click: () => this.settings.update({ [key]: !settings[key] }),
        });
        const inGame = this.snapshot?.state === 'alive';

        this.tray.setContextMenu(Menu.buildFromTemplate([
            { label: 'Ouvrir eMush', click: () => this.actions.openWindow() },
            ...(inGame ? [{ label: 'Reprendre la partie', click: () => this.actions.resumeGame() }] : []),
            { type: 'separator' },
            { label: this.snapshot ? statusLine(this.snapshot) : 'Connexion au Daedalus…', enabled: false },
            { type: 'separator' },
            {
                label: 'Notifications',
                submenu: [
                    ...NOTIFICATION_TOGGLES.map(toggle),
                    { type: 'separator' },
                    { label: 'Tester une notification', click: () => this.actions.testNotification() },
                ],
            },
            ...WINDOW_TOGGLES.map(toggle),
            { label: 'Réglages…', click: () => this.actions.openSettings() },
            { type: 'separator' },
            { label: 'Quitter eMush', click: () => this.actions.quit() },
        ]));
    }
}
