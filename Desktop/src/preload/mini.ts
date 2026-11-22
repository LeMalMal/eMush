import { contextBridge, ipcRenderer } from 'electron';

/** Preload of the small panel next to the clock: read its data, send a few named commands. */
contextBridge.exposeInMainWorld('emushMini', Object.freeze({
    load: () => ipcRenderer.invoke('mini:load'),
    command: (command: string) => ipcRenderer.send('mini:command', command),
    onRefresh: (listener: () => void) => {
        ipcRenderer.on('mini:refresh', () => listener());
    },
    onPinned: (listener: (pinned: boolean) => void) => {
        ipcRenderer.on('mini:pinned', (_event, pinned) => listener(pinned === true));
    },
}));
