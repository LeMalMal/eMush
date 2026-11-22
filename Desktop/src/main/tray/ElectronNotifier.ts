import { Notification } from 'electron';
import { NotificationText } from '../background/events';
import { Notifier } from '../background/GameWatcher';

/** Windows notifications (toasts). Clicking one brings the game back. */
export class ElectronNotifier implements Notifier {
    /** Shown notifications are kept referenced: a collected Notification may never appear (or lose its click). */
    private readonly alive = new Set<Notification>();

    constructor(private readonly iconPath: string, private readonly onClick: () => void, private readonly trace = false) {}

    notify({ title, body }: NotificationText): void {
        if (!Notification.isSupported()) {
            console.warn('[notify] Notifications are not supported on this system.');
            return;
        }
        const notification = new Notification({ title, body, icon: this.iconPath, silent: false });
        const release = (): void => {
            this.alive.delete(notification);
        };
        this.alive.add(notification);
        notification.on('show', () => this.log(`shown: ${title}`));
        notification.on('click', () => {
            release();
            this.onClick();
        });
        notification.on('close', release);
        notification.on('failed', (_event, error) => {
            release();
            console.warn(`[notify] Windows refused the notification "${title}": ${error}`);
        });
        notification.show();
        this.log(`requested: ${title}`);
    }

    private log(message: string): void {
        if (this.trace) {
            console.info(`[notify] ${message}`);
        }
    }
}
