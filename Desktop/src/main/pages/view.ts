import { RichBlock } from '../api/gameText';
import { Language, RankingSort } from '../api/models';
import { AppSettings } from '../background/settingsModel';

// View models sent to the shell page over IPC: plain, JSON-serializable, already formatted for display.

export type Tone = 'neutral' | 'ok' | 'alert';
export type Tag = { label: string; tone: Tone };
export type Pager = { page: number; pageCount: number };

/** Every page load either succeeds or explains what went wrong; the shell then offers a retry. */
export type Loaded<T> = { ok: true; view: T } | { ok: false; message: string };

export type ShellCommand = 'play' | 'login' | 'logout' | 'wiki' | 'test-notification';

/** Who is signed in, for the navigation bar. */
export type AccountView = { username: string | null };

export type HomeView = {
    status: 'signed-out' | 'rules' | 'no-character' | 'alive' | 'dead';
    username: string | null;
    ship: { eyebrow: string; title: string; tags: Tag[]; text: string; characterKey: string | null };
    primary: { label: string; command: 'play' | 'login' };
    news: NewsCard[];
    counters: { label: string; value: string }[];
};

export type NewsCard = { id: number; title: string; excerpt: string; date: string | null; pinned: boolean };
export type NewsListView = { items: NewsCard[]; pager: Pager };
export type ArticleView = { id: number; title: string; date: string | null; content: RichBlock[] };

export type RankingRow = {
    rank: number;
    shipId: number;
    endCause: string;
    days: string;
    cycles: string;
    humanTriumph: string;
    bestHumanTriumph: string;
    mushTriumph: string;
};
export type RankingView = { rows: RankingRow[]; pager: Pager; language: Language | null; sort: RankingSort };

export type HistoryRow = {
    shipId: number;
    characterKey: string;
    characterName: string;
    endCause: string;
    death: string;
    triumph: string;
    wasMush: boolean;
};
export type ProfileView = {
    isMe: boolean;
    username: string;
    memberSince: string | null;
    points: number;
    shipsPlayed: number;
    statistics: { name: string; description: string; count: string; isRare: boolean }[];
    achievements: { name: string; description: string; points: number; isRare: boolean }[];
    history: HistoryRow[];
    pager: Pager;
};

export type CrewCharacterView = {
    key: string;
    name: string;
    fullName: string;
    abstract: string;
    level: number | null;
    available: boolean;
    skills: { name: string; description: RichBlock[] }[];
};
export type CrewChoice = { status: 'choose'; language: Language; shipId: number; aboard: number; characters: CrewCharacterView[] };
export type CrewView = { status: 'signed-out' } | { status: 'rules' } | { status: 'aboard' } | CrewChoice;

export type ClientInfo = {
    version: string;
    /** Launching with Windows needs the installed app (a dev build would register Electron itself). */
    canLaunchAtStartup: boolean;
    sourceCodeUrl: string;
};

export type SettingsView = { settings: AppSettings; client: ClientInfo };
