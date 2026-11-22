import { describe, expect, it } from 'vitest';
import { orbitView } from './orbit';

describe('orbitView', () => {
    it('shows the orbited planet\'s picture and points to the Astro terminal for its name', () => {
        expect(orbitView({ state: 'orbit', planetImageId: 2048 })).toEqual({
            title: 'En orbite',
            hint: 'Nom et secteurs au Terminal Astro, sur le Pont.',
            image: 'img/planets/2048.png',
        });
    });

    it('falls back to the unknown planet for a picture the client does not have', () => {
        expect(orbitView({ state: 'orbit', planetImageId: 99 })?.image).toBe('img/planets/unknown.png');
        expect(orbitView({ state: 'orbit', planetImageId: null })?.image).toBe('img/planets/unknown.png');
    });

    it('says when the Daedalus is moving, and nothing in open space', () => {
        expect(orbitView({ state: 'travelling' })).toMatchObject({ title: 'En déplacement', image: null });
        expect(orbitView({ state: 'space' })).toBeNull();
    });
});
