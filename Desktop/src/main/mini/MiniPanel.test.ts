import { describe, expect, it } from 'vitest';
import { MINI_SIZE, panelBounds } from './MiniPanel';

describe('panelBounds', () => {
    it('sits in the bottom-right corner, just above the clock', () => {
        expect(panelBounds({ x: 0, y: 0, width: 2560, height: 1400 })).toEqual({ x: 2560 - MINI_SIZE.width - 12, y: 1400 - MINI_SIZE.height - 12, width: MINI_SIZE.width, height: MINI_SIZE.height });
    });

    it('never grows taller than a small screen', () => {
        expect(panelBounds({ x: 0, y: 0, width: 1366, height: 728 })).toMatchObject({ y: 12, height: 728 - 24 });
    });
});
