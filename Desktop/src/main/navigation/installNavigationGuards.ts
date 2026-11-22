import { shell, WebContents } from 'electron';
import { NavigationPolicy } from './NavigationPolicy';

/**
 * Keeps the window on trusted origins: links to other sites open in the default browser,
 * popups never create new Electron windows.
 */
export function installNavigationGuards(webContents: WebContents, policy: NavigationPolicy): void {
    webContents.on('will-navigate', (event, url) => {
        const decision = policy.execute(url);
        if (decision === 'allow') {
            return;
        }

        event.preventDefault();
        openExternallyIfAllowed(url, decision === 'open-external');
    });

    webContents.on('will-redirect', (event, url) => {
        if (policy.execute(url) !== 'allow') {
            event.preventDefault();
            console.warn('[navigation] Blocked redirect to untrusted URL:', url);
        }
    });

    webContents.setWindowOpenHandler(({ url }) => {
        const decision = policy.execute(url);
        if (decision === 'allow') {
            webContents.loadURL(url).catch(() => undefined); // Failures show the offline page.
        } else {
            openExternallyIfAllowed(url, decision === 'open-external');
        }

        return { action: 'deny' };
    });
}

function openExternallyIfAllowed(url: string, allowed: boolean): void {
    if (!allowed) {
        console.warn('[navigation] Blocked URL:', url);
        return;
    }

    void shell.openExternal(url);
}
