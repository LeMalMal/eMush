import { describe, expect, it } from 'vitest';
import { findInPageArguments, MAX_FIND_LENGTH, parseFindRequest } from './findInPage';

describe('parseFindRequest', () => {
    it('accepts a search from the shell\'s search bar', () => {
        expect(parseFindRequest({ text: 'Hua', forward: true, again: false })).toEqual({ text: 'Hua', forward: true, again: false });
    });

    it('refuses anything else', () => {
        expect(parseFindRequest(null)).toBeNull();
        expect(parseFindRequest({ text: 42, forward: true, again: false })).toBeNull();
        expect(parseFindRequest({ text: 'Hua', forward: 'yes', again: false })).toBeNull();
        expect(parseFindRequest({ text: 'x'.repeat(MAX_FIND_LENGTH + 1), forward: true, again: false })).toBeNull();
    });
});

describe('findInPageArguments', () => {
    it('starts a new search for a new text, and moves between matches for the same one', () => {
        expect(findInPageArguments({ text: 'porte', forward: true, again: false })).toEqual({ text: 'porte', options: { forward: true, findNext: true } });
        expect(findInPageArguments({ text: 'porte', forward: false, again: true })).toEqual({ text: 'porte', options: { forward: false, findNext: false } });
    });

    it('clears the highlights for an empty search', () => {
        expect(findInPageArguments({ text: '  ', forward: true, again: false })).toBeNull();
    });
});
