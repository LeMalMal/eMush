import { describe, expect, it } from 'vitest';
import { DARK_CHAT_CSS, LARGE_CHAT_CSS } from './chatTheme';
import { fitGameZoom, GAME_MODE_CSS, gamePageCss, isGamePage } from './gameMode';

const origin = 'https://emush.eternaltwin.org';

describe('fitGameZoom', () => {
    it('keeps the natural size in a small window', () => {
        expect(fitGameZoom({ width: 1264, height: 686 })).toBe(1);
    });

    it('fills a 1080p window in 25 % steps', () => {
        expect(fitGameZoom({ width: 1920, height: 1016 })).toBe(1.5);
    });

    it('fills a 1440p window', () => {
        expect(fitGameZoom({ width: 2560, height: 1305 })).toBe(2);
    });

    it('applies the player adjustment within bounds', () => {
        expect(fitGameZoom({ width: 1920, height: 1016 }, -0.25)).toBe(1.25);
        expect(fitGameZoom({ width: 1264, height: 686 }, -2)).toBe(1);
        expect(fitGameZoom({ width: 4000, height: 3000 }, 2)).toBe(3);
    });
});

describe('isGamePage', () => {
    it('recognises the game page only on the game server', () => {
        expect(isGamePage('https://emush.eternaltwin.org/game', origin)).toBe(true);
        expect(isGamePage('https://emush.eternaltwin.org/game/', origin)).toBe(true);
        expect(isGamePage('https://emush.eternaltwin.org/the-end/3', origin)).toBe(false);
        expect(isGamePage('https://evil.example/game', origin)).toBe(false);
        expect(isGamePage('not a url', origin)).toBe(false);
    });
});

describe('gamePageCss', () => {
    it('adds the chat styles the player chose to the game mode', () => {
        expect(gamePageCss({ darkChat: true, largeChat: true })).toBe([GAME_MODE_CSS, DARK_CHAT_CSS, LARGE_CHAT_CSS].join('\n'));
        expect(gamePageCss({ darkChat: true, largeChat: false })).toBe([GAME_MODE_CSS, DARK_CHAT_CSS].join('\n'));
        expect(gamePageCss({ darkChat: false, largeChat: false })).toBe(GAME_MODE_CSS);
    });

    it('only restyles the chat panel, so the rest of the game keeps its look', () => {
        const selectors = DARK_CHAT_CSS.split('}').map((rule) => rule.split('{')[0].trim()).filter((selector) => selector !== '');

        expect(selectors.every((selector) => selector.split(',').every((part) => part.trim().startsWith('.comms-panel')))).toBe(true);
    });
});
