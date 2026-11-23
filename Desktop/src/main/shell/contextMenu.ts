/**
 * Right-click menu of the window's pages (the shell and the web game). Electron shows none by default,
 * so without it a player could not copy a message, paste in the chat, or fix a misspelled word.
 */

/** What Electron tells about the right-clicked spot (a subset of `ContextMenuParams`). */
export type ContextMenuInput = {
    isEditable: boolean;
    selectionText: string;
    linkURL: string;
    misspelledWord: string;
    dictionarySuggestions: string[];
    editFlags: { canUndo: boolean; canRedo: boolean; canCut: boolean; canCopy: boolean; canPaste: boolean; canSelectAll: boolean };
};

export type ContextCommand =
    | { kind: 'replace'; word: string }
    | { kind: 'learn'; word: string }
    | { kind: 'copyLink'; url: string }
    | { kind: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll' };

export type ContextMenuEntry = { label: string; command: ContextCommand | null; enabled: boolean } | { separator: true };

const MAX_SUGGESTIONS = 5;
const COPYABLE_LINK = /^(https?:|mailto:)/i;

/** The entries for a right-click, in the usual order; empty when there is nothing to offer. */
export function contextMenuEntries(input: ContextMenuInput): ContextMenuEntry[] {
    const groups = [spellingEntries(input), input.isEditable ? editingEntries(input) : copyEntries(input), linkEntries(input)];

    return groups.filter((group) => group.length > 0).flatMap((group, index) => (index === 0 ? group : [{ separator: true } as const, ...group]));
}

function spellingEntries({ isEditable, misspelledWord, dictionarySuggestions }: ContextMenuInput): ContextMenuEntry[] {
    if (!isEditable || misspelledWord === '') {
        return [];
    }
    const suggestions = dictionarySuggestions.slice(0, MAX_SUGGESTIONS).map((word) => item(word, { kind: 'replace', word }));

    return [
        ...(suggestions.length > 0 ? suggestions : [{ label: 'Aucune suggestion', command: null, enabled: false }]),
        item(`Ajouter « ${misspelledWord} » au dictionnaire`, { kind: 'learn', word: misspelledWord }),
    ];
}

function editingEntries({ editFlags }: ContextMenuInput): ContextMenuEntry[] {
    return [
        item('Annuler', { kind: 'undo' }, editFlags.canUndo),
        item('Rétablir', { kind: 'redo' }, editFlags.canRedo),
        { separator: true },
        item('Couper', { kind: 'cut' }, editFlags.canCut),
        item('Copier', { kind: 'copy' }, editFlags.canCopy),
        item('Coller', { kind: 'paste' }, editFlags.canPaste),
        { separator: true },
        item('Tout sélectionner', { kind: 'selectAll' }, editFlags.canSelectAll),
    ];
}

function copyEntries({ selectionText }: ContextMenuInput): ContextMenuEntry[] {
    return selectionText.trim() === '' ? [] : [item('Copier', { kind: 'copy' })];
}

function linkEntries({ linkURL }: ContextMenuInput): ContextMenuEntry[] {
    return COPYABLE_LINK.test(linkURL) ? [item('Copier l\'adresse du lien', { kind: 'copyLink', url: linkURL })] : [];
}

function item(label: string, command: ContextCommand, enabled = true): ContextMenuEntry {
    return { label, command, enabled };
}
