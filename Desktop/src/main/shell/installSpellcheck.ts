import { Session } from 'electron';
import { SettingsService } from '../background/settings';
import { resolveGameLanguage } from './gameLanguage';
import { spellcheckLanguages } from './spellcheck';

/** Turns the spellchecker on or off (setting) and keeps its dictionary on the game's language. `trace`: logs the language. */
export function installSpellcheck(session: Session, settings: SettingsService, systemLanguages: readonly string[], trace = false): void {
    const apply = (): void => {
        const { spellcheck, gameLanguage } = settings.get();
        session.setSpellCheckerEnabled(spellcheck);
        if (!spellcheck) {
            return;
        }
        const languages = spellcheckLanguages(resolveGameLanguage(gameLanguage, systemLanguages), session.availableSpellCheckerLanguages);
        if (languages.length > 0) {
            session.setSpellCheckerLanguages(languages);
        }
        if (trace) {
            console.info(`[spellcheck] ${session.getSpellCheckerLanguages().join(', ') || 'default'}`);
        }
    };

    apply();
    settings.onChange((next, previous) => {
        if (next.spellcheck !== previous.spellcheck || next.gameLanguage !== previous.gameLanguage) {
            apply();
        }
    });
}
