import { GAME_LANGUAGES, GameLanguage, GameLanguageSetting } from '../background/settingsModel';

/**
 * Language of the web game's interface. The web client starts in English until a language is chosen
 * with the flags of its top bar, which the client hides: the client sets the language itself instead.
 */

/** The web client's own default (App/src/i18n `defaultLocale`). */
const WEB_DEFAULT_LANGUAGE: GameLanguage = 'en';

/** The chosen language, or for `auto` the first language of Windows the game has (`fr-FR` → `fr`). */
export function resolveGameLanguage(setting: GameLanguageSetting, systemLanguages: readonly string[]): GameLanguage {
    if (setting !== 'auto') {
        return setting;
    }
    const supported = systemLanguages
        .map((language) => language.split('-')[0].toLowerCase())
        .find((language): language is GameLanguage => (GAME_LANGUAGES as readonly string[]).includes(language));

    return supported ?? WEB_DEFAULT_LANGUAGE;
}

/** `applied`: switched live; `saved`: the game was not started yet and will read it; `unchanged`: already in that language. */
export type GameLanguageResult = 'applied' | 'saved' | 'unchanged';

/**
 * Script run in a page of the game: switches the interface with the game's own store action
 * (`locale/updateLocale`, which also saves the choice for the next visits).
 */
export function applyGameLanguageScript(language: GameLanguage): string {
    return `(() => {
    const language = ${JSON.stringify(language)};
    const root = document.querySelector('#app');
    const store = root && root.__vue_app__ && root.__vue_app__.config.globalProperties.$store;
    if (!store || typeof store.dispatch !== 'function') {
        localStorage.setItem('locale', language);
        return 'saved';
    }
    if (store.getters['locale/currentLocale'] === language && localStorage.getItem('locale') === language) {
        return 'unchanged';
    }
    store.dispatch('locale/updateLocale', language);
    return 'applied';
})()`;
}
