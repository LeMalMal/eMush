import { contextBridge, ipcRenderer } from 'electron';

/** Preload of the notifications page: receives the notifications, sends back clicks, closings and its height. */
contextBridge.exposeInMainWorld('emushToasts', Object.freeze({
    onShow: (listener: (payload: unknown) => void) => {
        ipcRenderer.on('toast:show', (_event, payload) => listener(payload));
    },
    click: (id: number) => ipcRenderer.send('toast:click', id),
    dismiss: (id: number) => ipcRenderer.send('toast:dismiss', id),
    height: (pixels: number) => ipcRenderer.send('toast:height', pixels),
}));
