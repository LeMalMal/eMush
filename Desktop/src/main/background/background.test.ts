import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EmushApi } from '../api/EmushApi';
import { FakeGameServer, SAMPLE_ACCOUNT, SAMPLE_PLAYER_IN_GAME } from '../api/FakeGameServer';
import { detectEvents, notificationText, shouldNotify, statusLine } from './events';
import { AliveSnapshot, GameSnapshot, PreviewLatestMessage, TakeGameSnapshot } from './GameSnapshot';
import { CHAT_CHECK_INTERVAL_MS, GameWatcher, nextCheckDelay, Notifier, StatusSink } from './GameWatcher';
import { DEFAULT_SETTINGS, JsonFileSettingsStore, NotificationSettings, parseSettings, SettingsService } from './settings';

const server = new URL('https://emush.eternaltwin.org');

function alive(overrides: Partial<AliveSnapshot> = {}): AliveSnapshot {
    return { state: 'alive', character: 'Gioele Rinaldo', day: 2, cycle: 2, nextCycleAt: new Date('2026-11-22T12:00:00Z'), unread: 31, unreadChannels: [89607], alerts: [], ...overrides };
}

describe('TakeGameSnapshot', () => {
    it('reads day, cycle, next cycle and the unread messages of every channel', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, SAMPLE_PLAYER_IN_GAME)
            .respond('channel', 200, [
                { id: 89607, scope: 'public', name: 'Discussion', numberOfNewMessages: 31 },
                { id: 90001, scope: 'private', name: 'Privé', numberOfNewMessages: 2 },
                { id: 'broken' },
            ])
            .respond('alert/77/alerts', 200, [{ prefix: 'Alertes :', key: 'communications_down', name: 'Pas de liaison', description: 'Le Daedalus n’a pas de **liaison** avec Sol !' }]);

        expect(await new TakeGameSnapshot(new EmushApi(server, fake)).execute()).toEqual({
            state: 'alive', character: 'Kim Jin-Su', day: 2, cycle: 3, nextCycleAt: new Date('2026-11-21T23:00:00Z'), unread: 33,
            unreadChannels: [89607, 90001],
            alerts: [{ key: 'communications_down', name: 'Pas de liaison', description: 'Le Daedalus n’a pas de liaison avec Sol !' }],
        });
    });

    it.each([
        ['signed-out', new FakeGameServer().respond('users/me', 401)],
        ['no-character', new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT)],
        ['unreachable', new FakeGameServer().goOffline()],
    ])('reports %s', async (state, fake) => {
        expect((await new TakeGameSnapshot(new EmushApi(server, fake)).execute()).state).toBe(state);
    });

    it('reports a dead character', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, { ...SAMPLE_PLAYER_IN_GAME, gameStatus: 'finished' });

        expect(await new TakeGameSnapshot(new EmushApi(server, fake)).execute()).toEqual({ state: 'dead', character: 'Kim Jin-Su' });
    });
});

describe('detectEvents', () => {
    it('uses the first snapshot as a baseline only', () => {
        expect(detectEvents(null, alive())).toEqual([]);
    });

    it('detects a new cycle and new messages', () => {
        expect(detectEvents(alive(), alive({ cycle: 3, unread: 34 }))).toEqual([
            { kind: 'new-cycle', day: 2, cycle: 3 },
            { kind: 'new-messages', added: 3, total: 34 },
        ]);
    });

    it('reports a new day instead of a new cycle when the day changes', () => {
        expect(detectEvents(alive({ day: 2, cycle: 8 }), alive({ day: 3, cycle: 1 }))).toEqual([{ kind: 'new-day', day: 3, cycle: 1 }]);
    });

    it('stays quiet when messages are read or nothing changed', () => {
        expect(detectEvents(alive({ unread: 31 }), alive({ unread: 0 }))).toEqual([]);
        expect(detectEvents(alive(), alive())).toEqual([]);
    });

    it('detects the death of the character', () => {
        expect(detectEvents(alive(), { state: 'dead', character: 'Gioele Rinaldo' })).toEqual([{ kind: 'death', character: 'Gioele Rinaldo' }]);
    });
});

describe('notification texts and filters', () => {
    it('writes readable French notifications', () => {
        expect(notificationText({ kind: 'new-cycle', day: 2, cycle: 3 })).toEqual({ title: 'Nouveau cycle', body: 'Jour 2 · Cycle 3 : tes points d\'action sont rechargés.' });
        expect(notificationText({ kind: 'new-messages', added: 1, total: 32 }).title).toBe('Nouveau message');
        expect(notificationText({ kind: 'new-messages', added: 3, total: 34 })).toEqual({ title: '3 nouveaux messages', body: 'Tu as 34 messages non lus.' });
        expect(notificationText({ kind: 'new-day', day: 3, cycle: 1 }).title).toBe('Jour 3 à bord du Daedalus');
    });

    it('follows the player settings', () => {
        const quiet: NotificationSettings = { ...DEFAULT_SETTINGS, newCycles: false, newDays: false, messages: false };
        expect(shouldNotify({ kind: 'new-cycle', day: 2, cycle: 3 }, quiet)).toBe(false);
        expect(shouldNotify({ kind: 'new-messages', added: 1, total: 1 }, quiet)).toBe(false);
        expect(shouldNotify({ kind: 'death', character: 'X' }, quiet)).toBe(true);
    });

    it('summarises the situation for the tray', () => {
        expect(statusLine(alive())).toBe('Jour 2 · Cycle 2 · 31 messages non lus');
        expect(statusLine(alive({ unread: 0 }))).toBe('Jour 2 · Cycle 2');
        expect(statusLine({ state: 'no-character' })).toBe('Aucun équipage');
    });
});

describe('nextCheckDelay', () => {
    const now = new Date('2026-11-22T11:59:30Z');

    it('checks right after the next cycle when it is close', () => {
        expect(nextCheckDelay(alive(), now)).toBe(35_000);
    });

    it('checks the chat every minute otherwise', () => {
        expect(nextCheckDelay(alive({ nextCycleAt: new Date('2026-11-22T14:00:00Z') }), now)).toBe(CHAT_CHECK_INTERVAL_MS);
    });

    it('never checks in a tight loop when the cycle is late', () => {
        expect(nextCheckDelay(alive({ nextCycleAt: new Date('2026-11-22T11:00:00Z') }), now)).toBe(5_000);
    });

    it('slows down when there is nothing to watch', () => {
        expect(nextCheckDelay({ state: 'no-character' }, now)).toBe(5 * 60_000);
    });
});

describe('settings', () => {
    it('falls back to defaults for missing or invalid values', () => {
        expect(parseSettings({ messages: false, closeToTray: 'yes' })).toEqual({ ...DEFAULT_SETTINGS, messages: false });
        expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    });

    it('persists to a JSON file', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emush-settings-'));
        try {
            const store = new JsonFileSettingsStore(path.join(dir, 'settings.json'));
            expect(store.load()).toEqual(DEFAULT_SETTINGS);
            store.save({ ...DEFAULT_SETTINGS, minimizeToTray: true });
            expect(new JsonFileSettingsStore(path.join(dir, 'settings.json')).load().minimizeToTray).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

/** Handwritten fakes for the watcher's ports. */
class FakeNotifier implements Notifier {
    readonly sent: { title: string; body: string }[] = [];
    notify(text: { title: string; body: string }): void {
        this.sent.push(text);
    }
}
class FakeStatus implements StatusSink {
    readonly updates: GameSnapshot[] = [];
    attentions = 0;
    update(snapshot: GameSnapshot): void {
        this.updates.push(snapshot);
    }
    attention(): void {
        this.attentions++;
    }
}
class ManualScheduler {
    readonly delays: number[] = [];
    private pending: (() => void) | null = null;
    readonly schedule = (callback: () => void, delay: number) => {
        this.delays.push(delay);
        this.pending = callback;
        return () => { this.pending = null; };
    };
    run(): void {
        const callback = this.pending;
        this.pending = null;
        callback?.();
    }
}

function watcherWith(snapshots: GameSnapshot[], looking = false) {
    const notifier = new FakeNotifier();
    const status = new FakeStatus();
    const scheduler = new ManualScheduler();
    let index = 0;
    const watcher = new GameWatcher({
        takeSnapshot: async () => snapshots[Math.min(index++, snapshots.length - 1)],
        notifier,
        status,
        settings: () => DEFAULT_SETTINGS,
        isPlayerLooking: () => looking,
        schedule: scheduler.schedule,
        now: () => new Date('2026-11-22T11:00:00Z'),
    });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    return { watcher, notifier, status, scheduler, settle };
}

describe('GameWatcher', () => {
    it('notifies a new cycle and new messages after the baseline, and keeps checking', async () => {
        const { watcher, notifier, status, scheduler, settle } = watcherWith([alive(), alive({ cycle: 3, unread: 33 })]);

        watcher.start();
        await settle();
        expect(notifier.sent).toEqual([]);

        scheduler.run();
        await settle();
        expect(notifier.sent.map((n) => n.title)).toEqual(['Nouveau cycle', '2 nouveaux messages']);
        expect(status.attentions).toBe(1);
        expect(scheduler.delays).toHaveLength(2);
        watcher.stop();
    });

    it('stays silent while the player is looking at the game, but keeps the status up to date', async () => {
        const { watcher, notifier, status, scheduler, settle } = watcherWith([alive(), alive({ cycle: 3 })], true);

        watcher.start();
        await settle();
        scheduler.run();
        await settle();

        expect(notifier.sent).toEqual([]);
        expect(status.updates.at(-1)).toMatchObject({ cycle: 3 });
        watcher.stop();
    });

    it('keeps the last known game when the server is briefly unreachable', async () => {
        const { watcher, notifier, status, scheduler, settle } = watcherWith([alive(), { state: 'unreachable' }, alive({ cycle: 3 })]);

        watcher.start();
        await settle();
        scheduler.run();
        await settle();
        expect(status.updates.at(-1)).toMatchObject({ state: 'alive', cycle: 2 });

        scheduler.run();
        await settle();
        expect(notifier.sent.map((n) => n.title)).toEqual(['Nouveau cycle']);
        watcher.stop();
    });
});

describe('ship alerts and message previews', () => {
    const fire = { key: 'fire', name: 'Incendie', description: 'Un incendie fait rage en Cuisine.' };

    it('notifies alerts that appear, not those already known', () => {
        expect(detectEvents(alive({ alerts: [] }), alive({ alerts: [fire] }))).toEqual([{ kind: 'new-alert', alert: fire }]);
        expect(detectEvents(alive({ alerts: [fire] }), alive({ alerts: [fire] }))).toEqual([]);
        expect(notificationText({ kind: 'new-alert', alert: fire })).toEqual({ title: 'Alerte : Incendie', body: 'Un incendie fait rage en Cuisine.' });
        expect(statusLine(alive({ unread: 0, alerts: [fire] }))).toBe('Jour 2 · Cycle 2 · 1 alerte');
    });

    it('names the author of a single new message', () => {
        expect(notificationText({ kind: 'new-messages', added: 1, total: 32 }, { author: 'Jin-Su', text: 'Qui va en baie ?' }))
            .toEqual({ title: 'Message de Jin-Su', body: 'Qui va en baie ?' });
        expect(notificationText({ kind: 'new-messages', added: 3, total: 34 }, { author: 'Jin-Su', text: 'Qui va en baie ?' }))
            .toEqual({ title: '3 nouveaux messages', body: 'Jin-Su : Qui va en baie ?' });
    });

    it('finds the newest unread message, replies included', async () => {
        const fake = new FakeGameServer().respond('channel/89607/message?timeLimit=24', 200, [
            { id: 3, character: { key: 'chun', value: 'Chun' }, message: 'Vieux message', isUnread: false, child: [
                { id: 4, character: { key: 'hua', value: 'Hua' }, message: 'Réponse **lue**', isUnread: false, child: [] },
                { id: 5, character: { key: 'ian', value: 'Ian' }, message: 'Réponse **non lue**', isUnread: true, child: [] },
            ] },
        ]);

        expect(await new PreviewLatestMessage(new EmushApi(server, fake)).execute([89607])).toEqual({ author: 'Ian', text: 'Réponse non lue' });
    });

    it('adds the author to the notification through the watcher', async () => {
        const notifier = new FakeNotifier();
        const scheduler = new ManualScheduler();
        const snapshots: GameSnapshot[] = [alive({ unread: 0 }), alive({ unread: 1 })];
        let index = 0;
        const watcher = new GameWatcher({
            takeSnapshot: async () => snapshots[Math.min(index++, 1)],
            previewMessage: async () => ({ author: 'Hua', text: 'On explore ?' }),
            notifier,
            status: new FakeStatus(),
            settings: () => DEFAULT_SETTINGS,
            isPlayerLooking: () => false,
            schedule: scheduler.schedule,
            now: () => new Date('2026-11-22T11:00:00Z'),
        });

        watcher.start();
        await new Promise((resolve) => setTimeout(resolve, 0));
        scheduler.run();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(notifier.sent).toEqual([{ title: 'Message de Hua', body: 'On explore ?' }]);
        watcher.stop();
    });
});

describe('SettingsService', () => {
    class MemoryStore {
        saved: unknown[] = [];
        constructor(private value = DEFAULT_SETTINGS) {}
        load() { return { ...this.value }; }
        save(settings: typeof DEFAULT_SETTINGS) { this.value = settings; this.saved.push(settings); }
    }

    it('validates changes, saves them and tells listeners', () => {
        const store = new MemoryStore();
        const service = new SettingsService(store);
        const seen: boolean[] = [];
        service.onChange((next) => seen.push(next.alerts));

        service.update({ alerts: false, gameZoomOffset: 9, unknown: 'x' });

        expect(service.get()).toMatchObject({ alerts: false, gameZoomOffset: 2 });
        expect(seen).toEqual([false]);
        expect(store.saved).toHaveLength(1);
    });

    it('ignores changes that change nothing', () => {
        const store = new MemoryStore();
        new SettingsService(store).update({ alerts: true });

        expect(store.saved).toEqual([]);
    });

    it('rounds the zoom adjustment to 25 % steps', () => {
        expect(parseSettings({ gameZoomOffset: 0.3 }).gameZoomOffset).toBe(0.25);
        expect(parseSettings({ gameZoomOffset: -7 }).gameZoomOffset).toBe(-2);
    });
});
