import { describe, expect, it } from 'vitest';
import { GameLanguage } from '../background/settingsModel';
import { applyGameLanguageScript, resolveGameLanguage } from './gameLanguage';

describe('resolveGameLanguage', () => {
    it('follows the first language of Windows the game has', () => {
        expect(resolveGameLanguage('auto', ['fr-FR', 'en-US'])).toBe('fr');
        expect(resolveGameLanguage('auto', ['de-DE', 'ES-es'])).toBe('es');
    });

    it('falls back to the web client\'s English', () => {
        expect(resolveGameLanguage('auto', ['de-DE'])).toBe('en');
        expect(resolveGameLanguage('auto', [])).toBe('en');
    });

    it('keeps a language the player chose', () => {
        expect(resolveGameLanguage('es', ['fr-FR'])).toBe('es');
    });
});

/** Handwritten fake of a game page: its Vuex store (recording dispatches) and its local storage. */
function fakeGamePage(options: { currentLocale?: string; saved?: string | null; started?: boolean } = {}) {
    const dispatched: unknown[][] = [];
    const storage = new Map<string, string>(options.saved ? [['locale', options.saved]] : []);
    const localStorage = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
    };
    const store = {
        getters: { 'locale/currentLocale': options.currentLocale ?? 'en' },
        dispatch: (...args: unknown[]) => { dispatched.push(args); },
    };
    const root = options.started === false ? {} : { __vue_app__: { config: { globalProperties: { $store: store } } } };
    const document = { querySelector: (selector: string) => (selector === '#app' ? root : null) };
    const run = (language: GameLanguage): string =>
        new Function('document', 'localStorage', `return ${applyGameLanguageScript(language)};`)(document, localStorage);

    return { run, dispatched, storage };
}

describe('applyGameLanguageScript', () => {
    it('switches the game with its own store action, which also saves the choice', () => {
        const page = fakeGamePage({ currentLocale: 'en', saved: null });

        expect(page.run('fr')).toBe('applied');
        expect(page.dispatched).toEqual([['locale/updateLocale', 'fr']]);
    });

    it('leaves a game already in that language alone', () => {
        const page = fakeGamePage({ currentLocale: 'fr', saved: 'fr' });

        expect(page.run('fr')).toBe('unchanged');
        expect(page.dispatched).toEqual([]);
    });

    it('saves the language for a game that has not started yet', () => {
        const page = fakeGamePage({ started: false });

        expect(page.run('es')).toBe('saved');
        expect(page.storage.get('locale')).toBe('es');
    });
});
