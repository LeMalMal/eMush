import { GameLanguage } from '../background/settingsModel';

/** Dictionaries that fit each game language, most fitting first (codes of `availableSpellCheckerLanguages`). */
const DICTIONARIES: Record<GameLanguage, readonly string[]> = {
    fr: ['fr', 'fr-FR'],
    en: ['en-US', 'en-GB', 'en'],
    es: ['es', 'es-ES', 'es-419', 'es-MX'],
};

/**
 * Spellchecker language for the chat: the game's language, as players write in their ship's language.
 * Empty when Electron has no dictionary for it (the spellchecker then keeps its own default).
 */
export function spellcheckLanguages(language: GameLanguage, available: readonly string[]): string[] {
    const dictionary = DICTIONARIES[language].find((code) => available.includes(code));

    return dictionary === undefined ? [] : [dictionary];
}
