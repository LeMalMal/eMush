import { Session } from 'electron';
import { Http } from './EmushApi';

/** HTTP through the window's session, so requests carry the player's eMush cookies. */
export function sessionHttp(session: Session): Http {
    return {
        get: (url, accept = 'application/json') => session.fetch(url, { credentials: 'include', headers: { Accept: accept } }),
        post: (url, body) => session.fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
    };
}
