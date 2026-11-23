import { Menu, MenuItemConstructorOptions } from 'electron';

export type MenuActions = {
    showHome(): void;
    reload(): void;
    zoomIn(): void;
    zoomOut(): void;
    resetZoom(): void;
    toggleDevTools(): void;
    togglePanel(): void;
    find(): void;
};

/**
 * Hidden menu bar (Alt shows it on Windows) that mainly provides keyboard shortcuts:
 * Ctrl+H home, Ctrl+F search in the page, F5/Ctrl+R reload, Ctrl +/-/0 zoom of the game pages, F11 fullscreen, F12 dev tools when enabled.
 */
export function buildApplicationMenu(options: { devTools: boolean; actions: MenuActions }): Menu {
    const { actions } = options;
    const view: MenuItemConstructorOptions[] = [
        { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => actions.reload() },
        { label: 'Recharger', accelerator: 'F5', visible: false, acceleratorWorksWhenHidden: true, click: () => actions.reload() },
        { type: 'separator' },
        { label: 'Taille réelle', accelerator: 'CmdOrCtrl+0', click: () => actions.resetZoom() },
        { label: 'Zoom avant', accelerator: 'CmdOrCtrl+Plus', click: () => actions.zoomIn() },
        { label: 'Zoom avant', accelerator: 'CmdOrCtrl+=', visible: false, acceleratorWorksWhenHidden: true, click: () => actions.zoomIn() },
        { label: 'Zoom arrière', accelerator: 'CmdOrCtrl+-', click: () => actions.zoomOut() },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran', accelerator: 'F11' },
    ];

    if (options.devTools) {
        view.push({ type: 'separator' }, { label: 'Outils de développement', accelerator: 'F12', click: () => actions.toggleDevTools() });
    }

    return Menu.buildFromTemplate([
        {
            label: 'eMush',
            submenu: [
                { label: 'Accueil', accelerator: 'CmdOrCtrl+H', click: () => actions.showHome() },
                { label: 'Mini-panneau', accelerator: 'CmdOrCtrl+Shift+M', click: () => actions.togglePanel() },
                { type: 'separator' },
                { role: 'quit', label: 'Quitter' },
            ],
        },
        { label: 'Édition', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, { type: 'separator' }, { label: 'Rechercher', accelerator: 'CmdOrCtrl+F', click: () => actions.find() }] },
        { label: 'Affichage', submenu: view },
    ]);
}
