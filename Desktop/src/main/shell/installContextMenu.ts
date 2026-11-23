import { BrowserWindow, clipboard, Menu, MenuItemConstructorOptions, WebContents } from 'electron';
import { ContextCommand, contextMenuEntries, ContextMenuEntry } from './contextMenu';

/** Shows the right-click menu (copy, paste, spelling suggestions...) on a page of the window. */
export function installContextMenu(contents: WebContents, window: BrowserWindow): void {
    contents.on('context-menu', (_event, params) => {
        const entries = contextMenuEntries(params);
        if (entries.length > 0 && !window.isDestroyed()) {
            Menu.buildFromTemplate(entries.map((entry) => toMenuItem(entry, contents))).popup({ window });
        }
    });
}

function toMenuItem(entry: ContextMenuEntry, contents: WebContents): MenuItemConstructorOptions {
    if ('separator' in entry) {
        return { type: 'separator' };
    }
    const { command } = entry;

    return { label: entry.label, enabled: entry.enabled, click: command === null ? undefined : () => run(command, contents) };
}

function run(command: ContextCommand, contents: WebContents): void {
    switch (command.kind) {
    case 'replace':
        contents.replaceMisspelling(command.word);
        break;
    case 'learn':
        contents.session.addWordToSpellCheckerDictionary(command.word);
        break;
    case 'copyLink':
        clipboard.writeText(command.url);
        break;
    default:
        contents[command.kind]();
    }
}
