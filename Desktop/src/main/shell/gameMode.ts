import { DARK_CHAT_CSS, LARGE_CHAT_CSS } from './chatTheme';

/**
 * "Game mode": the web game page (`/game`) has a fixed layout of about 1080 × 600 px. On a big
 * window the client zooms it to fill the space, in 25 % steps, and hides the site footer.
 */

/** Natural size of the game page with the footer hidden (box-container + margins). */
export const GAME_PAGE_SIZE = { width: 1100, height: 620 };

export const GAME_ZOOM_STEP = 0.25;
export const MIN_GAME_ZOOM = 1;
export const MAX_GAME_ZOOM = 3;

/** CSS applied on the game page only: no footer, tight margins, crisp pixel art when zoomed. */
export const GAME_MODE_CSS = [
    'footer { display: none !important; }',
    '.main-container > div > div > div > .box-container { margin-top: 8px !important; margin-bottom: 8px !important; }',
    'canvas, .char-card img, .inventory img { image-rendering: pixelated; }',
].join('\n');

/** Game mode CSS plus the chat styles the player chose. */
export function gamePageCss(chat: { darkChat: boolean; largeChat: boolean }): string {
    return [GAME_MODE_CSS, chat.darkChat ? DARK_CHAT_CSS : '', chat.largeChat ? LARGE_CHAT_CSS : ''].filter((css) => css !== '').join('\n');
}

export function isGamePage(rawUrl: string, serverOrigin: string): boolean {
    try {
        const url = new URL(rawUrl);
        return url.origin === serverOrigin && url.pathname.replace(/\/+$/, '') === '/game';
    } catch {
        return false;
    }
}

/** Largest 25 % step that fits the game page in the view, plus the player's own adjustment. */
export function fitGameZoom(view: { width: number; height: number }, playerOffset = 0): number {
    const fit = Math.min(view.width / GAME_PAGE_SIZE.width, view.height / GAME_PAGE_SIZE.height);
    const stepped = Math.floor(fit / GAME_ZOOM_STEP) * GAME_ZOOM_STEP;

    return clamp(stepped + playerOffset, MIN_GAME_ZOOM, MAX_GAME_ZOOM);
}

/** Zoom when the automatic fit is off: natural size plus the player's adjustment. */
export function manualGameZoom(playerOffset: number): number {
    return clamp(1 + playerOffset, 0.5, MAX_GAME_ZOOM);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
