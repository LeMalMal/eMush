import { ipcMain, IpcMainEvent, WebContents } from 'electron';
import { findInPageArguments, parseFindRequest } from './findInPage';

export type FindInPageDependencies = {
    /** The shell page, which draws the search bar. */
    shellContents: WebContents;
    /** The web view, searched while it is shown. */
    web: { readonly isVisible: boolean; readonly webContents: WebContents };
    fromShell(event: IpcMainEvent): boolean;
    reject(channel: string, payload: unknown): void;
};

/** Ctrl+F: opens the shell's search bar over the web page shown, and runs its searches in that page. */
export function installFindInPage({ shellContents, web, fromShell, reject }: FindInPageDependencies): { open(): void } {
    const webContents = web.webContents;

    webContents.on('found-in-page', (_event, result) => {
        if (result.finalUpdate) {
            shellContents.send('shell:find-result', { active: result.activeMatchOrdinal, matches: result.matches });
        }
    });

    ipcMain.on('shell:find', (event, value: unknown) => {
        const request = parseFindRequest(value);
        if (!fromShell(event) || request === null) {
            reject('shell:find', value);
            return;
        }
        const search = findInPageArguments(request);
        if (search === null || !web.isVisible) {
            webContents.stopFindInPage('clearSelection');
            shellContents.send('shell:find-result', { active: 0, matches: 0 });
            return;
        }
        webContents.findInPage(search.text, search.options);
    });

    ipcMain.on('shell:find-stop', (event) => {
        if (!fromShell(event)) {
            reject('shell:find-stop', null);
            return;
        }
        webContents.stopFindInPage('keepSelection');
        if (web.isVisible) {
            webContents.focus();
        }
    });

    return {
        open: () => {
            if (!web.isVisible) {
                return; // Native pages are short lists: nothing to search there.
            }
            shellContents.focus();
            shellContents.send('shell:find-open');
        },
    };
}
