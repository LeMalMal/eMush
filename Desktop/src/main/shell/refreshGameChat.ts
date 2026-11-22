/**
 * The web game has no live updates: its chat reloads only after an action or a channel switch.
 * The client knows when new messages arrive (background watch), so it asks the game to reload its
 * channels with the game's own store action, exactly what the web client does after an error.
 *
 * Nothing is reloaded while the player is writing (a non-empty text field): the reload remounts the
 * message input and closes an open reply box, which would lose the text.
 */
export type ChatRefreshResult = 'refreshed' | 'writing' | 'not-playing' | 'unavailable';

/** Runs inside the game page (`executeJavaScript`): a self-contained expression, returns a ChatRefreshResult. */
export const REFRESH_GAME_CHAT = `(() => {
    const root = document.querySelector('#app');
    const store = root && root.__vue_app__ && root.__vue_app__.config.globalProperties.$store;
    if (!store || typeof store.dispatch !== 'function') { return 'unavailable'; }
    const player = store.getters['player/player'];
    if (!player || player.gameStatus !== 'in_game') { return 'not-playing'; }
    const fields = Array.from(document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]'));
    const writing = fields.some((field) => String('value' in field ? field.value : field.textContent || '').trim() !== '');
    if (writing) { return 'writing'; }
    store.dispatch('communication/loadAlivePlayerChannels');
    return 'refreshed';
})()`;

/** Coming back to the window refreshes the chat, but not more often than this. */
export const FOCUS_REFRESH_MIN_INTERVAL_MS = 15_000;

/** Decides when coming back to the window is worth a chat reload (pure, for tests). */
export class FocusRefreshThrottle {
    private lastAt = -Infinity;

    constructor(private readonly minIntervalMs = FOCUS_REFRESH_MIN_INTERVAL_MS) {}

    execute(nowMs: number): boolean {
        if (nowMs - this.lastAt < this.minIntervalMs) {
            return false;
        }
        this.lastAt = nowMs;
        return true;
    }
}
