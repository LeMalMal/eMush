import { describe, expect, it } from 'vitest';
import { isMovementLog } from './roomLogs';

describe('isMovementLog', () => {
    it('recognises the game\'s comings and goings, in French, English and Spanish', () => {
        for (const text of [
            ' est entré.', ' est entrée.', ' est entré·e.', ' est sorti.', ' est sortie.', ' est sorti·e.',
            ' entered the room.', ' left the room.', ' ha entrado.', ' ha salido.',
        ]) {
            expect(isMovementLog(text)).toBe(true);
        }
    });

    it('also with the place, as trackers see it', () => {
        expect(isMovementLog(' est entrée dans le Laboratoire.')).toBe(true);
        expect(isMovementLog(' left the room to the Bridge.')).toBe(true);
    });

    it('leaves every other log alone', () => {
        expect(isMovementLog(' a fouillé la pièce mais n\'a rien découvert.')).toBe(false);
        expect(isMovementLog(' est entré dans une colère noire, il a frappé Chun et la porte du laboratoire.')).toBe(false);
        expect(isMovementLog(' est sortie de son hibernation')).toBe(false);
        expect(isMovementLog(' a lâché un Plan.')).toBe(false);
    });
});
