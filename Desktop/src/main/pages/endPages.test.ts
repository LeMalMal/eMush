import { describe, expect, it } from 'vitest';
import { EmushApi } from '../api/EmushApi';
import {
    ACCOUNT_UUID, FakeGameServer, SAMPLE_ACCOUNT, SAMPLE_CLOSED_CREW, SAMPLE_CLOSED_SHIP, SAMPLE_DEAD_PLAYER, SAMPLE_PLAYER_IN_GAME,
} from '../api/FakeGameServer';
import { EndAdventure, EPITAPH_MAX_LENGTH, LoadDeath } from './death';
import { awardFor, LoadShipEnd } from './shipEnd';

const server = new URL('https://emush.eternaltwin.org');
const api = (fake: FakeGameServer) => new EmushApi(server, fake);

function deadServer(): FakeGameServer {
    return new FakeGameServer()
        .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
        .respond('player/812', 200, SAMPLE_DEAD_PLAYER);
}

describe('LoadDeath', () => {
    it('shows the character, the end cause, the history and the crew to like', async () => {
        const result = await new LoadDeath(api(deadServer())).execute();

        expect(result).toMatchObject({
            ok: true,
            view: {
                status: 'dead',
                playerId: 812,
                character: { key: 'jin_su', name: 'Kim Jin-Su' },
                triumph: '47',
                endCause: { title: 'Assassiné par un équipier', good: false },
                maxLength: EPITAPH_MAX_LENGTH,
                crew: [
                    { playerId: 813, name: 'Jiang Hua', death: '7.4', cause: 'Dépression', likes: 2 },
                    { playerId: 814, name: 'Zhong Chun', death: '—', cause: 'Encore en vie', likes: 0 },
                ],
            },
        });
        if (result.ok && result.view.status === 'dead') {
            expect(result.view.highlights[0]).toEqual([{ text: 'Vous avez réparé la ' }, { text: 'Porte', strong: true }, { text: ' du Pont.' }]);
        }
    });

    it('says when there is nothing to close', async () => {
        const alive = new FakeGameServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, SAMPLE_PLAYER_IN_GAME);

        expect(await new LoadDeath(api(alive)).execute()).toEqual({ ok: true, view: { status: 'alive' } });
        expect(await new LoadDeath(api(new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT))).execute()).toEqual({ ok: true, view: { status: 'no-character' } });
        expect(await new LoadDeath(api(new FakeGameServer().respond('users/me', 401))).execute()).toEqual({ ok: true, view: { status: 'signed-out' } });
    });
});

describe('EndAdventure', () => {
    it('sends the epitaph and the likes once the server confirms the character is dead', async () => {
        const fake = deadServer().respondToPost('player/812/end', 200);

        const result = await new EndAdventure(api(fake)).execute({ playerId: 812, message: '  Adieu, équipage.  ', likedPlayers: [813, 813] });

        expect(result).toEqual({ ok: true });
        expect(fake.posts).toEqual([{ path: 'player/812/end', body: { message: 'Adieu, équipage.', likedPlayers: [813] } }]);
    });

    it.each([
        [{ playerId: 812, message: 'x'.repeat(EPITAPH_MAX_LENGTH + 1), likedPlayers: [] }, 'ne doit pas dépasser'],
        [{ playerId: 999, message: 'Adieu', likedPlayers: [] }, 'n\'est plus le tien'],
        [{ playerId: 812, message: 'Adieu', likedPlayers: [4242] }, 'n\'était pas à bord'],
        [{ playerId: 812, message: 'Adieu', likedPlayers: ['813'] }, 'Demande invalide'],
    ])('refuses %j without calling the server', async (request, reason) => {
        const fake = deadServer();

        const result = await new EndAdventure(api(fake)).execute(request);

        expect(result.ok).toBe(false);
        expect(result.ok ? '' : result.message).toContain(reason);
        expect(fake.posts).toEqual([]);
    });

    it('refuses while the character is still alive', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, SAMPLE_PLAYER_IN_GAME);

        expect(await new EndAdventure(api(fake)).execute({ playerId: 812, message: '', likedPlayers: [] })).toMatchObject({ ok: false });
        expect(fake.posts).toEqual([]);
    });
});

describe('LoadShipEnd', () => {
    it('ranks the crew by score, like the web end page', async () => {
        const fake = new FakeGameServer()
            .respond('closed_daedaluses/225', 200, SAMPLE_CLOSED_SHIP)
            .respond('closed_daedaluses/225/players', 200, SAMPLE_CLOSED_CREW);

        const result = await new LoadShipEnd(api(fake)).execute(225);

        expect(result).toMatchObject({
            ok: true,
            view: {
                shipId: 225,
                end: { title: 'Retour sur Sol', image: 'sol' },
                headliner: { name: 'Ian Soulton', score: '210', isMush: true, death: 'Jour 6 · Cycle 2', userId: null, award: { image: 'first' } },
                mainRoles: [{ name: 'Zhong Chun', username: 'lemal', userId: ACCOUNT_UUID, good: true, death: null, epitaph: [{ text: 'Mission accomplie', strong: true }, { text: ' Quel voyage !' }], award: { image: 'second' } }],
                extras: [],
                statistics: { lines: [{ name: 'Hunters abattus', value: '1 203' }, { name: 'Explorations', value: '14' }] },
                titles: [{ title: 'Commandant', characters: [{ key: 'jin_su', name: 'Kim Jin-Su' }] }],
                funFacts: [{ title: 'Le plus gourmand', character: { key: 'chun', name: 'Zhong Chun' } }],
            },
        });
    });

    it('explains when the ship is unknown or still flying', async () => {
        expect(await new LoadShipEnd(api(new FakeGameServer().respond('closed_daedaluses/77', 403))).execute(77)).toMatchObject({ ok: false });
        expect(await new LoadShipEnd(api(new FakeGameServer())).execute('../77')).toEqual({ ok: false, message: 'Vaisseau inconnu.' });
    });

    it('gives the web end page\'s awards by rank', () => {
        expect([0, 1, 2, 3, 4, 6, 7].map((rank) => awardFor(rank).image)).toEqual(['first', 'second', 'third', 'fourth', 'fifth', 'fifth', 'sixth']);
    });
});
