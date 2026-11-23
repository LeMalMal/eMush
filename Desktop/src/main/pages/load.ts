import { ApiUnavailableError } from '../api/EmushApi';
import { Loaded } from './view';

export const SERVER_UNREACHABLE = 'Impossible de joindre le serveur eMush. Vérifie ta connexion, puis réessaie.';

/** A failure the player should read (thrown by loaders, shown by the shell). */
export class PageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PageError';
    }
}

/** Runs a page loader and turns expected failures into a displayable message. Other errors are bugs: rethrown. */
export async function load<T>(loader: () => Promise<T>): Promise<Loaded<T>> {
    try {
        return { ok: true, view: await loader() };
    } catch (error) {
        if (error instanceof ApiUnavailableError) {
            console.warn('[pages]', error.message);
            return { ok: false, message: SERVER_UNREACHABLE };
        }
        if (error instanceof PageError) {
            return { ok: false, message: error.message };
        }
        throw error;
    }
}
