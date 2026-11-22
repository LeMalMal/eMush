import type { JoinResult } from '../main/api/EmushApi';
import type {
    AccountView, ArticleView, CrewView, HomeView, Loaded, NewsListView, ProfileView, RankingView, ShellCommand,
} from '../main/pages/view';
import type { Navigation } from '../main/shell/routes';

export type PageViews = {
    account: AccountView;
    home: HomeView;
    news: NewsListView;
    article: ArticleView;
    ranking: RankingView;
    profile: ProfileView;
    crew: CrewView;
};

/** The API exposed by the shell preload (see src/preload/shell.ts). */
export type ShellBridge = {
    load<K extends keyof PageViews>(page: K, params?: unknown): Promise<Loaded<PageViews[K]>>;
    join(request: { shipId: number; characterKey: string }): Promise<JoinResult>;
    navigate(navigation: Navigation): void;
    command(command: ShellCommand): void;
    openLink(url: string): void;
    onPage(listener: (navigation: Navigation) => void): void;
    onReload(listener: () => void): void;
    /** Tells the main process the page is listening; it answers with the page to draw. */
    ready(): void;
};

export const bridge = (window as unknown as { emushShell: ShellBridge }).emushShell;
