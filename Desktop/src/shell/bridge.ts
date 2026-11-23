import type { JoinResult } from '../main/api/EmushApi';
import type {
    AccountView, ArticleView, CrewView, DeathView, HomeView, Loaded, NewsListView, ProfileView, RankingView, SettingsView, ShellCommand,
    ShipEndView,
} from '../main/pages/view';
import type { FindRequest, FindResult } from '../main/shell/findInPage';
import type { Navigation } from '../main/shell/routes';

export type PageViews = {
    account: AccountView;
    home: HomeView;
    news: NewsListView;
    article: ArticleView;
    ranking: RankingView;
    profile: ProfileView;
    crew: CrewView;
    death: DeathView;
    ship: ShipEndView;
    settings: SettingsView;
};

/** The API exposed by the shell preload (see src/preload/shell.ts). */
export type ShellBridge = {
    load<K extends keyof PageViews>(page: K, params?: unknown): Promise<Loaded<PageViews[K]>>;
    join(request: { shipId: number; characterKey: string }): Promise<JoinResult>;
    endAdventure(request: { playerId: number; message: string; likedPlayers: number[] }): Promise<JoinResult>;
    updateSettings(change: Record<string, boolean | number | string>): Promise<SettingsView | null>;
    navigate(navigation: Navigation): void;
    command(command: ShellCommand): void;
    openLink(url: string): void;
    onPage(listener: (navigation: Navigation) => void): void;
    onReload(listener: () => void): void;
    /** Tells the main process the page is listening; it answers with the page to draw. */
    ready(): void;
    /** Ctrl+F search in the web page shown. */
    find(request: FindRequest): void;
    stopFind(): void;
    onFindOpen(listener: () => void): void;
    onFindResult(listener: (result: FindResult) => void): void;
};

export const bridge = (window as unknown as { emushShell: ShellBridge }).emushShell;
