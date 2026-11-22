// Copies static files (offline page, shell page) next to the compiled code, with the game's fonts,
// pixel icons and artwork the shell reuses from the web client
// (Motion Twin / eMush assets, CC-BY-NC-SA-4.0, see App/src/assets/LICENSE).
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const webClient = join(root, '..', 'App');
const assets = join(webClient, 'src', 'assets');
const images = join(assets, 'images');
const shell = join(root, 'dist', 'static', 'shell');
const img = join(shell, 'img');

cpSync(join(root, 'static'), join(root, 'dist', 'static'), { recursive: true });
for (const folder of ['characters', 'heads', 'bodies', 'icons', 'ui']) {
    mkdirSync(join(img, folder), { recursive: true });
}
mkdirSync(join(shell, 'fonts'), { recursive: true });

const copy = (from, to) => cpSync(from, to);

// Fonts of the game: Days One (titles), Pixel Square (labels), eKanit (text).
for (const font of ['DaysOne-Regular.ttf', 'Pixel_Square.ttf', 'eKanit-Light.ttf', 'eKanit-LightItalic.ttf', 'eKanit-SemiBold.ttf']) {
    copy(join(assets, 'fonts', font), join(shell, 'fonts', font));
}

copy(join(webClient, 'public', 'emush-logo.png'), join(img, 'logo.png'));

// Notification area icon, taskbar badge (unread messages) and notification icon.
const appIcons = join(root, 'dist', 'static', 'icons');
mkdirSync(appIcons, { recursive: true });
copy(join(webClient, 'public', 'pwa-64x64.png'), join(appIcons, 'tray.png'));
copy(join(images, 'ui_icons', 'point.png'), join(appIcons, 'badge.png'));
copy(join(webClient, 'public', 'pwa-192x192.png'), join(appIcons, 'notification.png'));
copy(join(images, 'bg.jpg'), join(img, 'bg.jpg'));
copy(join(images, 'daedalus_home.png'), join(img, 'daedalus.png'));

// Interface pieces: tooltip frame corners, tooltip title icon, character pedestal, list bullet.
copy(join(images, 'ToolTip-corners.gif'), join(img, 'ui', 'tooltip-corners.gif'));
copy(join(images, 'notes.gif'), join(img, 'ui', 'notes.gif'));
copy(join(images, 'figure.png'), join(img, 'ui', 'figure.png'));
copy(join(images, 'ui_icons', 'point.png'), join(img, 'ui', 'point.png'));

// 16 px pixel icons.
const icons = {
    triumph: 'ui_icons/player_variables/triumph.png',
    triumph_mush: 'ui_icons/player_variables/triumph_mush.png',
    sol: 'ui_icons/sol.png',
    dead: 'ui_icons/dead.png',
    planet: 'ui_icons/planet.png',
    xp: 'xp.png',
    pa: 'ui_icons/player_variables/pa.png',
    pm: 'ui_icons/player_variables/pm.png',
    hp: 'ui_icons/player_variables/hp.png',
    moral: 'ui_icons/player_variables/moral.png',
};
for (const [name, file] of Object.entries(icons)) {
    copy(join(images, file), join(img, 'icons', `${name}.png`));
}

// Characters, by API key: portrait (painted), head (16 px) and body sprite (pixel art).
const portraits = {
    andie: 'andie_graham', chao: 'Wang_chao', chun: 'Zhong_chun', derek: 'derek_hogan',
    eleesha: 'Eleesha_williams', finola: 'Finola_keegan', frieda: 'Frieda_bergmann', gioele: 'Gioele_rinaldo',
    hua: 'Jiang_hua', ian: 'Ian_soulton', janice: 'Janice_kent', jin_su: 'Kim_jin_su',
    kuan_ti: 'Lai_kuan_ti', paola: 'Paola_rinaldo', raluca: 'Raluca_tomescu', roland: 'Roland_zuccali',
    stephen: 'Stephen_seagull', terrence: 'Terrence_archer',
};
for (const [key, file] of Object.entries(portraits)) {
    copy(join(images, 'char', 'portrait', `${file}_portrait.jpg`), join(img, 'characters', `${key}.jpg`));
    copy(join(images, 'char', 'head', `${key}.png`), join(img, 'heads', `${key}.png`));
    copy(join(images, 'char', 'body', `${key}.png`), join(img, 'bodies', `${key}.png`));
}
