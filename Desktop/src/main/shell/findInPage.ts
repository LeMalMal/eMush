/**
 * Search in the web page shown (the game, the forum, the rules), like Ctrl+F in a browser: Electron has
 * the search itself (`findInPage`) but no search bar, so the shell draws one in its navigation bar.
 */

/** A search sent by the shell's search bar. `again`: the next or previous match of the same text. */
export type FindRequest = { text: string; forward: boolean; again: boolean };
export type FindResult = { active: number; matches: number };

export const MAX_FIND_LENGTH = 200;

/** Reads a search request from the shell page (untrusted); null when it is not one. */
export function parseFindRequest(value: unknown): FindRequest | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { text, forward, again } = value as Record<string, unknown>;
    if (typeof text !== 'string' || text.length > MAX_FIND_LENGTH || typeof forward !== 'boolean' || typeof again !== 'boolean') {
        return null;
    }

    return { text, forward, again };
}

/** Electron's `findInPage` arguments; null for an empty search (the highlights are cleared instead). */
export function findInPageArguments(request: FindRequest): { text: string; options: { forward: boolean; findNext: boolean } } | null {
    if (request.text.trim() === '') {
        return null;
    }

    // Electron's `findNext` starts a new search session: true for a new text, false to move between matches.
    return { text: request.text, options: { forward: request.forward, findNext: !request.again } };
}
