import { describe, expect, it } from 'vitest';
import { EmushApi } from '../api/EmushApi';
import { FakeGameServer, SAMPLE_ACCOUNT, SAMPLE_PLAYER_IN_GAME } from '../api/FakeGameServer';
import { ChatMessage } from '../api/models';
import { flattenMessages, LoadMiniPanel, shipGauges } from './mini';

const server = new URL('https://emush.eternaltwin.org');

function message(id: number, author: string, unread = false, replies: ChatMessage[] = []): ChatMessage {
    return { id, author, authorKey: author.toLowerCase(), text: `msg ${id}`, date: '5 min', unread, replies };
}

describe('flattenMessages', () => {
    it('lists each thread then its replies, newest reply first, within the limit', () => {
        const rows = flattenMessages([message(10, 'Hua', false, [message(11, 'Ian'), message(12, 'Chun', true)]), message(5, 'Andie')], 3);

        expect(rows.map((row) => [row.id, row.reply, row.unread])).toEqual([[10, false, false], [12, true, true], [11, true, false]]);
    });
});

describe('shipGauges', () => {
    it('flags the gauges that are running low, and skips the ones the API did not send', () => {
        const gauges = shipGauges({ oxygen: 6, fuel: null, hull: 25, shield: 30, crewAlive: null, position: { state: 'space' } });

        expect(gauges.map((gauge) => [gauge.icon, gauge.low])).toEqual([['oxygen', true], ['hull', true], ['shield', false]]);
    });
});

describe('LoadMiniPanel', () => {
    it('gathers points, cycle, alerts and the public chat', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, SAMPLE_PLAYER_IN_GAME)
            .respond('channel', 200, [{ id: 7, scope: 'private', name: 'Privé', numberOfNewMessages: 0 }, { id: 89607, scope: 'public', name: 'Discussion', numberOfNewMessages: 2 }])
            .respond('alert/77/alerts', 200, [{ key: 'fire', name: 'Incendie', description: 'En **Cuisine**.' }])
            .respond('channel/89607/message?timeLimit=24', 200, [
                { id: 3, character: { key: 'hua', value: 'Hua' }, message: 'On explore ?', date: '2 min', isUnread: true, child: [] },
            ]);

        const result = await new LoadMiniPanel(new EmushApi(server, fake)).execute();

        expect(result).toEqual({
            ok: true,
            view: {
                status: 'alive',
                character: { key: 'jin_su', name: 'Kim Jin-Su' },
                room: 'Pont',
                when: 'Jour 2 · Cycle 3',
                nextCycleAt: '2026-11-21T23:00:00.000Z',
                points: [{ icon: 'pa', label: 'PA', value: 4, max: 12 }, { icon: 'pm', label: 'PM', value: 10, max: 12 }],
                ship: [
                    { icon: 'oxygen', label: 'Oxygène', value: '24', low: false },
                    { icon: 'fuel', label: 'Fuel', value: '9', low: false },
                    { icon: 'hull', label: 'Coque', value: '87', low: false },
                    { icon: 'shield_off', label: 'Bouclier', value: '0', low: false },
                    { icon: 'crew', label: 'En vie', value: '14', low: false },
                ],
                orbit: { title: 'En orbite', hint: 'Nom et secteurs au Terminal Astro, sur le Pont.', image: 'img/planets/3.png' },
                titles: ['Commandant'],
                diseases: ['Grippe'],
                alerts: [{ name: 'Incendie', description: 'En Cuisine.' }],
                channel: { name: 'Discussion', unread: 2 },
                messages: [{ id: 3, authorKey: 'hua', author: 'Hua', text: 'On explore ?', date: '2 min', unread: true, reply: false }],
            },
        });
    });

    it('explains what to do when there is no game in progress', async () => {
        const result = await new LoadMiniPanel(new EmushApi(server, new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT))).execute();

        expect(result).toMatchObject({ ok: true, view: { status: 'no-character', title: 'Aucun équipage' } });
    });
});
