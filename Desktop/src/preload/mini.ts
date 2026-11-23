import { contextBridge, ipcRenderer } from 'electron';

/** Preload of the small panel next to the clock: read its data, send a few named commands. */
contextBridge.exposeInMainWorld('emushMini', Object.freeze({
    load: (channelId?: unknown) => ipcRenderer.invoke('mini:load', channelId ?? null),
    showMessage: (target: unknown) => ipcRenderer.send('mini:show-message', target),
    send: (request: unknown) => ipcRenderer.invoke('mini:send', request),
    command: (command: string) => ipcRenderer.send('mini:command', command),
    onRefresh: (listener: () => void) => {
        ipcRenderer.on('mini:refresh', () => listener());
    },
    onPinned: (listener: (pinned: boolean) => void) => {
        ipcRenderer.on('mini:pinned', (_event, pinned) => listener(pinned === true));
    },
}));
