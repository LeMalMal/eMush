import { describe, expect, it } from 'vitest';
import { TOAST_WIDTH, toastBounds } from './MushNotifier';
import { toastView } from './toastView';

describe('toastView', () => {
    it('shows the author\'s head on a message, and says what a click does', () => {
        expect(toastView(4, { title: 'Message de Hua', body: 'On explore ?', visual: { kind: 'message', characterKey: 'hua' } })).toEqual({
            id: 4, kind: 'message', label: 'Message', title: 'Message de Hua', body: 'On explore ?', image: 'img/heads/hua.png', action: 'Voir le message',
        });
    });

    it('shows the game\'s icon of an alert, and a generic one for an alert it does not know', () => {
        expect(toastView(1, { title: 'Alerte : Incendie', body: '', visual: { kind: 'alert', alertKey: 'fires' } }).image).toBe('img/alerts/fire.png');
        expect(toastView(1, { title: 'Alerte', body: '', visual: { kind: 'alert', alertKey: 'new_alert' } }).image).toBe('img/alerts/infoalert.png');
    });

    it('never builds a picture path from an unexpected character key', () => {
        expect(toastView(1, { title: 'Message', body: '', visual: { kind: 'mention', characterKey: '../../evil' } }).image).toBe('img/toast/chat.png');
    });

    it('labels every kind, a notification without a visual being general news', () => {
        expect(toastView(1, { title: 'Nouveau cycle', body: '', visual: { kind: 'cycle' } })).toMatchObject({ label: 'Nouveau cycle', image: 'img/toast/calendar.png' });
        expect(toastView(1, { title: 'X est tombé', body: '', visual: { kind: 'death' } })).toMatchObject({ label: 'Fin de l’aventure', action: 'Écrire ton épitaphe' });
        expect(toastView(1, { title: 'Test', body: '' })).toMatchObject({ kind: 'info', image: 'img/logo.png' });
    });
});

describe('toastBounds', () => {
    const screen = { x: 0, y: 0, width: 2560, height: 1400 };

    it('sits in the bottom-right corner, just above the clock', () => {
        expect(toastBounds(screen, 300)).toEqual({ x: 2560 - TOAST_WIDTH - 12, y: 1400 - 300 - 12, width: TOAST_WIDTH, height: 300 });
    });

    it('moves next to the mini panel instead of covering it', () => {
        const panel = { x: 2188, y: 668, width: 360, height: 720 };

        expect(toastBounds(screen, 300, panel).x).toBe(2188 - TOAST_WIDTH - 12);
        expect(toastBounds(screen, 300, { x: 0, y: 0, width: 300, height: 300 }).x).toBe(2560 - TOAST_WIDTH - 12); // Elsewhere: no need to move.
    });

    it('never grows taller than the screen', () => {
        expect(toastBounds({ x: 0, y: 0, width: 1366, height: 400 }, 900).height).toBe(400 - 24);
    });
});
