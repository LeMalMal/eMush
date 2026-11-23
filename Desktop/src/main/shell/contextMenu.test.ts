import { describe, expect, it } from 'vitest';
import { ContextMenuEntry, contextMenuEntries, ContextMenuInput } from './contextMenu';
import { spellcheckLanguages } from './spellcheck';

const ALL_EDITS = { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canSelectAll: true };
const NO_EDITS = { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: false, canSelectAll: false };

function rightClick(overrides: Partial<ContextMenuInput> = {}): ContextMenuInput {
    return { isEditable: false, selectionText: '', linkURL: '', misspelledWord: '', dictionarySuggestions: [], editFlags: NO_EDITS, ...overrides };
}

/** Labels, with "—" for separators and "(off)" for disabled entries. */
function labels(entries: ContextMenuEntry[]): string[] {
    return entries.map((entry) => ('separator' in entry ? '—' : `${entry.label}${entry.enabled ? '' : ' (off)'}`));
}

describe('contextMenuEntries', () => {
    it('offers the usual editing commands in a text field', () => {
        expect(labels(contextMenuEntries(rightClick({ isEditable: true, editFlags: { ...ALL_EDITS, canRedo: false } })))).toEqual([
            'Annuler', 'Rétablir (off)', '—', 'Couper', 'Copier', 'Coller', '—', 'Tout sélectionner',
        ]);
    });

    it('puts spelling suggestions first, and offers to learn the word', () => {
        const entries = contextMenuEntries(rightClick({ isEditable: true, editFlags: ALL_EDITS, misspelledWord: 'réparé', dictionarySuggestions: ['répare', 'réparer'] }));

        expect(labels(entries).slice(0, 4)).toEqual(['répare', 'réparer', 'Ajouter « réparé » au dictionnaire', '—']);
        expect(entries[0]).toEqual({ label: 'répare', command: { kind: 'replace', word: 'répare' }, enabled: true });
        expect(entries[2]).toMatchObject({ command: { kind: 'learn', word: 'réparé' } });
    });

    it('says when the dictionary has no suggestion', () => {
        expect(labels(contextMenuEntries(rightClick({ isEditable: true, misspelledWord: 'Daedalus' }))).slice(0, 2)).toEqual([
            'Aucune suggestion (off)', 'Ajouter « Daedalus » au dictionnaire',
        ]);
    });

    it('copies a selected message, and the address of a web link', () => {
        expect(labels(contextMenuEntries(rightClick({ selectionText: 'On explore ?' })))).toEqual(['Copier']);
        expect(contextMenuEntries(rightClick({ linkURL: 'https://emush.eternaltwin.org/news' }))).toEqual([
            { label: 'Copier l\'adresse du lien', command: { kind: 'copyLink', url: 'https://emush.eternaltwin.org/news' }, enabled: true },
        ]);
    });

    it('shows nothing where there is nothing to do, and never copies script links', () => {
        expect(contextMenuEntries(rightClick())).toEqual([]);
        expect(contextMenuEntries(rightClick({ selectionText: '   ', linkURL: 'javascript:alert(1)' }))).toEqual([]);
    });
});

describe('spellcheckLanguages', () => {
    it('checks the chat in the game\'s language with the closest dictionary Electron has', () => {
        expect(spellcheckLanguages('fr', ['en-US', 'fr', 'es'])).toEqual(['fr']);
        expect(spellcheckLanguages('en', ['en-GB', 'fr'])).toEqual(['en-GB']);
        expect(spellcheckLanguages('es', ['es-MX'])).toEqual(['es-MX']);
    });

    it('leaves the default when there is no dictionary for that language', () => {
        expect(spellcheckLanguages('es', ['en-US', 'fr'])).toEqual([]);
    });
});
