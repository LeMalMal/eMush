import { Inline, RichBlock } from '../api/gameText';
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

/** One line of game text (a highlight, a triumph gain), parsed for DOM rendering. */
export type RichLine = Inline[];

export type DeathCrewRow = { playerId: number; characterKey: string; name: string; death: string; cause: string; likes: number };
export type DeathChoice = {
    status: 'dead';
    playerId: number;
    character: { key: string; name: string };
    isMush: boolean;
    triumph: string;
    endCause: { title: string; description: string; good: boolean };
    highlights: RichLine[];
    triumphGains: RichLine[];
    crew: DeathCrewRow[];
    maxLength: number;
};
/** The death page: epitaph, likes for the crew, then the adventure is closed. */
export type DeathView = { status: 'signed-out' } | { status: 'no-character' } | { status: 'alive' } | DeathChoice;

export type ShipCrewCard = {
    characterKey: string;
    name: string;
    username: string;
    userId: string | null;
    score: string;
    isMush: boolean;
    endCause: string;
    good: boolean;
    death: string | null;
    likes: number;
    epitaph: RichLine | null;
    award: { label: string; image: string };
    highlights: RichLine[];
};
export type ShipEndView = {
    shipId: number;
    end: { title: string; image: string };
    tags: Tag[];
    isCheater: boolean;
    headliner: ShipCrewCard | null;
    mainRoles: ShipCrewCard[];
    extras: ShipCrewCard[];
    statistics: { title: string; lines: { name: string; value: string }[] };
    titles: { title: string; characters: { key: string; name: string }[] }[];
    funFacts: { title: string; description: string; character: { key: string; name: string } }[];
};

export type ClientInfo = {
    version: string;
    /** Launching with Windows needs the installed app (a dev build would register Electron itself). */
    canLaunchAtStartup: boolean;
    sourceCodeUrl: string;
};

export type SettingsView = { settings: AppSettings; client: ClientInfo };
