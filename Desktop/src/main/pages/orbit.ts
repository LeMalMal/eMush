import { ShipPosition } from '../api/models';

/** Planet pictures shipped with the client (`img/planets/`, from App/src/assets/images/astro). 2048: event planet. */
export const PLANET_IMAGE_IDS: readonly number[] = [0, 1, 2, 3, 4, 2048];

/**
 * Where the Daedalus is, for the mini panel and the home page. The game shows the orbited planet only
 * through the ship's windows, and gives its name only at the Astro terminal (or during an expedition),
 * on purpose: the client shows its picture and points to the terminal, never the name.
 */
export type OrbitView = { title: string; hint: string; image: string | null };

export function orbitView(position: ShipPosition): OrbitView | null {
    switch (position.state) {
    case 'orbit':
        return { title: 'En orbite', hint: 'Nom et secteurs au Terminal Astro, sur le Pont.', image: planetImage(position.planetImageId) };
    case 'travelling':
        return { title: 'En déplacement', hint: 'Le Daedalus se déplace dans l\'espace.', image: null };
    default:
        return null;
    }
}

function planetImage(imageId: number | null): string {
    return imageId !== null && PLANET_IMAGE_IDS.includes(imageId) ? `img/planets/${imageId}.png` : 'img/planets/unknown.png';
}
