import { Notification } from 'electron';
import { NotificationText } from '../background/events';
import { Notifier } from '../background/GameWatcher';

/** Windows notifications (toasts). Clicking one brings the game back. */
export class ElectronNotifier implements Notifier {
    constructor(private readonly iconPath: string, private readonly onClick: () => void) {}

    notify({ title, body }: NotificationText): void {
        if (!Notification.isSupported()) {
            return;
        }
        const notification = new Notification({ title, body, icon: this.iconPath, silent: false });
        notification.on('click', () => this.onClick());
        notification.show();
    }
}
