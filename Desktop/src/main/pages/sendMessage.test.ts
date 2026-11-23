import { describe, expect, it } from 'vitest';
import { EmushApi } from '../api/EmushApi';
import { FakeGameServer, SAMPLE_ACCOUNT } from '../api/FakeGameServer';
import { gameMessageLength, MESSAGE_MAX_LENGTH, parseSendMessageRequest, SendChatMessage, toGameMessage } from './sendMessage';

const server = new URL('https://emush.eternaltwin.org');

/** A player (812) with a public and a private channel; the public one has a thread (id 3). */
function onlineGame(): FakeGameServer {
    return new FakeGameServer()
        .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
        .respond('channel', 200, [{ id: 89607, scope: 'public', name: 'Discussion', numberOfNewMessages: 0 }, { id: 7, scope: 'private', name: 'Privé', numberOfNewMessages: 0 }])
        .respond('channel/89607/message?timeLimit=24', 200, [{ id: 3, character: { key: 'hua', value: 'Hua' }, message: 'On explore ?', isUnread: false, child: [] }])
        .respondToPost('channel/89607/message', 200, []);
}

describe('SendChatMessage', () => {
    it('posts like the web client, line breaks written "//"', async () => {
        const fake = onlineGame();

        expect(await new SendChatMessage(new EmushApi(server, fake)).execute({ channelId: 89607, text: '  Je viens !\nJ\'arrive en baie  ', parentId: null })).toEqual({ ok: true });
        expect(fake.posts).toEqual([{
            path: 'channel/89607/message',
            body: { message: 'Je viens !//J\'arrive en baie', playerId: 812, parent: null, isPirated: false, timeLimit: 48 },
        }]);
    });

    it('replies to a thread still shown', async () => {
        const fake = onlineGame();

        expect(await new SendChatMessage(new EmushApi(server, fake)).execute({ channelId: 89607, text: 'Oui !', parentId: 3 })).toEqual({ ok: true });
        expect(fake.posts[0].body).toMatchObject({ parent: 3 });
    });

    it('checks again before sending: text, channel, thread, character', async () => {
        const send = (request: unknown, fake = onlineGame()) => new SendChatMessage(new EmushApi(server, fake)).execute(request);

        expect(await send({ channelId: 89607, text: '   ', parentId: null })).toMatchObject({ ok: false, message: 'Écris d’abord ton message.' });
        expect(await send({ channelId: 89607, text: 'x'.repeat(MESSAGE_MAX_LENGTH + 1), parentId: null })).toMatchObject({ ok: false });
        expect(await send({ channelId: 404, text: 'Allô ?', parentId: null })).toMatchObject({ ok: false, message: 'Ce canal n’est plus disponible.' });
        expect(await send({ channelId: 89607, text: 'Allô ?', parentId: 999 })).toMatchObject({ ok: false });
        expect(await send({ channelId: 89607, text: 'Allô ?', parentId: null }, new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT))).toMatchObject({ ok: false, message: 'Tu n’as plus de personnage en jeu.' });
        expect(await send({ channelId: '89607', text: 'Allô ?' })).toMatchObject({ ok: false, message: 'Demande invalide : recharge le panneau.' });
    });

    it('passes the server\'s refusal on', async () => {
        const fake = onlineGame().respondToPost('channel/89607/message', 403, { detail: 'Tu ne peux pas parler dans ce canal.' });

        expect(await new SendChatMessage(new EmushApi(server, fake)).execute({ channelId: 89607, text: 'Allô ?', parentId: null }))
            .toEqual({ ok: false, message: 'Tu ne peux pas parler dans ce canal.' });
    });
});

describe('message helpers', () => {
    it('counts and writes the text as the game does', () => {
        expect(gameMessageLength('a\nb')).toBe(4);
        expect(toGameMessage(' a\r\nb ')).toBe('a//b');
    });

    it('reads only well-formed requests', () => {
        expect(parseSendMessageRequest({ channelId: 7, text: 'Salut', parentId: null })).toEqual({ channelId: 7, text: 'Salut', parentId: null });
        expect(parseSendMessageRequest({ channelId: 7, text: 'Salut', parentId: -2 })).toBeNull();
        expect(parseSendMessageRequest(null)).toBeNull();
    });
});
