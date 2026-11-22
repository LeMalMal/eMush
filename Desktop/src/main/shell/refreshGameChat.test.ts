import { describe, expect, it } from 'vitest';
import { FocusRefreshThrottle, REFRESH_GAME_CHAT } from './refreshGameChat';

type Field = { value?: string; textContent?: string };

/** Handwritten fake of the web game page: its Vuex store (recording dispatches) and its text fields. */
function fakeGamePage(options: { gameStatus?: string | null; fields?: Field[]; withStore?: boolean } = {}) {
    const dispatched: string[] = [];
    const store = {
        getters: { 'player/player': options.gameStatus === null ? null : { gameStatus: options.gameStatus ?? 'in_game' } },
        dispatch: (action: string) => { dispatched.push(action); },
    };
    const root = options.withStore === false ? {} : { __vue_app__: { config: { globalProperties: { $store: store } } } };
    const document = {
        querySelector: (selector: string) => (selector === '#app' ? root : null),
        querySelectorAll: () => options.fields ?? [],
    };
    const run = (): string => new Function('document', `return ${REFRESH_GAME_CHAT};`)(document);

    return { run, dispatched };
}

describe('REFRESH_GAME_CHAT', () => {
    it('reloads the channels with the game\'s own store action', () => {
        const page = fakeGamePage({ fields: [{ value: '' }, { textContent: ' ' }] });

        expect(page.run()).toBe('refreshed');
        expect(page.dispatched).toEqual(['communication/loadAlivePlayerChannels']);
    });

    it('waits while the player is writing a message or a reply', () => {
        const page = fakeGamePage({ fields: [{ value: '' }, { value: 'Je répare la porte' }] });

        expect(page.run()).toBe('writing');
        expect(page.dispatched).toEqual([]);
    });

    it('does nothing for a dead character or when the page is not the game client', () => {
        expect(fakeGamePage({ gameStatus: 'finished' }).run()).toBe('not-playing');
        expect(fakeGamePage({ gameStatus: null }).run()).toBe('not-playing');
        expect(fakeGamePage({ withStore: false }).run()).toBe('unavailable');
    });
});

describe('FocusRefreshThrottle', () => {
    it('lets one refresh through, then waits before the next', () => {
        const throttle = new FocusRefreshThrottle(15_000);

        expect([throttle.execute(0), throttle.execute(5_000), throttle.execute(15_000), throttle.execute(20_000)]).toEqual([true, false, true, false]);
    });
});
