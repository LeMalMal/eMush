import { detectEvents, NewMessages, notificationText, NotificationText, shouldNotify, WatchEvent } from './events';
import { GameSnapshot } from './GameSnapshot';
import { messageNotification, UnreadMessage } from './messageNotification';
import { NotificationSettings } from './settings';

export const CHAT_CHECK_INTERVAL_MS = 60_000;
/** While the player has the game in front of them, new messages should show up quickly. */
export const PLAYING_CHAT_CHECK_INTERVAL_MS = 30_000;
/** Checks right after the cycle changes, leaving the server a few seconds to compute it. */
export const AFTER_CYCLE_DELAY_MS = 5_000;
const IDLE_INTERVAL_MS = 5 * 60_000;
const RETRY_INTERVAL_MS = 2 * 60_000;

export interface Notifier {
    notify(text: NotificationText): void;
}

/** Where the watch reports the player's situation (tray tooltip, taskbar badge). */
export interface StatusSink {
    update(snapshot: GameSnapshot): void;
    /** Something happened in the game: draw the player's attention (taskbar flash). */
    attention(): void;
}

export type Scheduler = (callback: () => void, delayMs: number) => () => void;

export type GameWatcherPorts = {
    takeSnapshot(): Promise<GameSnapshot>;
    notifier: Notifier;
    status: StatusSink;
    settings(): NotificationSettings;
    /** The unread messages of the channels that got new ones: who wrote, and whether they name the character (optional). */
    newMessages?(channels: NewMessages[]): Promise<UnreadMessage[]>;
    /** True while the player has the window in front of them: no toast then. */
    isPlayerLooking(): boolean;
    /** True while the player has the game page itself in front of them: the chat is checked more often. */
    isPlayerPlaying?(): boolean;
    /** Every change found, whether or not a notification is shown (to refresh the game's chat...). */
    onEvents?(events: WatchEvent[]): void;
    schedule: Scheduler;
    now(): Date;
};

/**
 * When to check again: right after the next cycle, and at least every minute for the chat
 * (every 30 seconds while the player is on the game page).
 */
export function nextCheckDelay(snapshot: GameSnapshot, now: Date, playing = false): number {
    switch (snapshot.state) {
        case 'alive': {
            const chatInterval = playing ? PLAYING_CHAT_CHECK_INTERVAL_MS : CHAT_CHECK_INTERVAL_MS;
            if (snapshot.nextCycleAt === null) {
                return chatInterval;
            }
            const untilCycle = snapshot.nextCycleAt.getTime() - now.getTime() + AFTER_CYCLE_DELAY_MS;
            return Math.max(AFTER_CYCLE_DELAY_MS, Math.min(chatInterval, untilCycle));
        }
        case 'unreachable': return RETRY_INTERVAL_MS;
        default: return IDLE_INTERVAL_MS;
    }
}

/**
 * Background watch of the player's game: new cycles, new days, new chat messages, death.
 * Raises Windows notifications only when the player is not looking at the window.
 */
export class GameWatcher {
    private last: GameSnapshot | null = null;
    private cancelNext: (() => void) | null = null;
    private running = false;
    private checking = false;

    constructor(private readonly ports: GameWatcherPorts) {}

    get lastSnapshot(): GameSnapshot | null {
        return this.last;
    }

    start(): void {
        if (!this.running) {
            this.running = true;
            void this.check();
        }
    }

    stop(): void {
        this.running = false;
        this.cancelNext?.();
        this.cancelNext = null;
    }

    /** Checks now (window shown again, settings changed...) and reschedules. */
    checkNow(): void {
        if (this.running) {
            this.cancelNext?.();
            void this.check();
        }
    }

    private async check(): Promise<void> {
        if (this.checking) {
            return;
        }
        this.checking = true;
        let snapshot: GameSnapshot = { state: 'unreachable' };
        try {
            snapshot = await this.ports.takeSnapshot();
            if (snapshot.state !== 'unreachable') {
                const events = detectEvents(this.last, snapshot);
                this.last = snapshot;
                await this.handle(events, snapshot);
            }
            this.ports.status.update(snapshot.state === 'unreachable' && this.last !== null ? this.last : snapshot);
        } catch (error) {
            console.warn('[watch] Check failed:', error);
        } finally {
            this.checking = false;
            if (this.running) {
                const playing = this.ports.isPlayerPlaying?.() ?? false;
                this.cancelNext = this.ports.schedule(() => void this.check(), nextCheckDelay(snapshot, this.ports.now(), playing));
            }
        }
    }

    private async handle(events: WatchEvent[], snapshot: GameSnapshot): Promise<void> {
        if (events.length === 0) {
            return;
        }
        this.ports.onEvents?.(events);
        if (events.some((event) => event.kind !== 'new-messages')) {
            this.ports.status.attention();
        }
        if (this.ports.isPlayerLooking()) {
            return;
        }
        const settings = this.ports.settings();
        for (const event of events) {
            if (!shouldNotify(event, settings)) {
                continue;
            }
            if (event.kind !== 'new-messages') {
                this.ports.notifier.notify(notificationText(event));
                continue;
            }
            if (snapshot.state !== 'alive') {
                continue;
            }
            const messages = this.ports.newMessages ? await this.ports.newMessages(event.channels).catch(() => []) : [];
            const text = messageNotification(event, messages, settings, snapshot.name);
            if (text !== null) {
                this.ports.notifier.notify(text);
            }
        }
    }
}
