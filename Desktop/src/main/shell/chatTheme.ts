import type { ChatTextSize, MovementLogMode } from '../background/settingsModel';

/**
 * Restyling of the web game's chat (App/src/components/Game/Communications), injected as CSS on the
 * game page: the game's code is not modified, so every feature of its chat keeps working as-is.
 * The web client's chat styles are scoped (`[data-v-…]`), hence the `!important` overrides.
 */

/** Colours of the dark chat, from the game's own palette (`_mixins.scss`) and the shell's frames. */
const INK = '#e8eeff';
const SOFT = '#9fb4f0';
const PANEL = '#0c1452';
const BUBBLE = '#18246f';
const EDGE = '#3965fb';
const RULE = 'rgba(57, 101, 251, .28)';

/** Dark chat: deep blue panel, light text, coloured kinds of logs, in the client's style. */
export const DARK_CHAT_CSS = `
.comms-panel .tab::after { background: #1a2a6c !important; }
.comms-panel .tab:hover::after, .comms-panel .tab.checked::after { background: ${PANEL} !important; box-shadow: inset 0 2px 0 ${EDGE}; }
.comms-panel .tab.pirated::after { background: #6b1f35 !important; }
.comms-panel .tab.pirated.checked::after { background: #a1283f !important; }
.comms-panel .cycle-time { color: ${INK}; }

.comms-panel .chatbox-container {
    background: ${PANEL} !important;
    color: ${INK} !important;
    box-shadow: inset 0 0 0 1px ${EDGE}, inset 0 0 18px rgba(15, 89, 171, .45);
}
.comms-panel .chatbox-container.pirated { border-color: #ff4259 !important; }
.comms-panel .chatbox, .comms-panel .chatbox .loading { color: ${INK} !important; }
.comms-panel .chatbox, .comms-panel .chatbox-container, .comms-panel .input-area {
    --scrollbarBG: #070b33 !important;
    --thumbBG: ${EDGE} !important;
    scrollbar-color: ${EDGE} #070b33 !important;
}
.comms-panel #mush-tab .chatbox-container { background: #1c0f47 !important; box-shadow: inset 0 0 0 1px #7152d9, inset 0 0 18px rgba(113, 82, 217, .45); }

.comms-panel .chatbox-container .banner {
    background: linear-gradient(180deg, #24399a, #1a2a7a) !important;
    color: #c2f3fc;
    box-shadow: inset 0 0 0 1px ${EDGE};
    border-radius: 0 !important;
}

.comms-panel .chatbox .log { border-bottom-color: ${RULE} !important; color: ${INK}; }
.comms-panel .chatbox .log strong, .comms-panel .chatbox .log b { color: #ffffff; }
.comms-panel .chatbox .log em, .comms-panel .chatbox .text em { color: #ff7a8a !important; }
.comms-panel .chatbox .log.private { color: #e7a6f0 !important; }
.comms-panel .chatbox .log.private strong { color: #f6d2fb; }
.comms-panel .chatbox .log.covert, .comms-panel .chatbox .log.secret { background: rgba(1, 195, 223, .14) !important; }
.comms-panel .chatbox .log.revealed { background: rgba(255, 66, 89, .2) !important; border: 1px solid #ff4259 !important; }
.comms-panel .chatbox .log .room { color: ${SOFT}; }
.comms-panel .chatbox a { color: #84e100 !important; }
.comms-panel .timestamp { color: ${SOFT}; opacity: 1 !important; }

.comms-panel .chatbox .unit { border-bottom-color: ${RULE} !important; }
.comms-panel .chatbox .message .text { background: ${BUBBLE} !important; color: ${INK}; box-shadow: inset 0 0 0 1px rgba(57, 101, 251, .35); }
.comms-panel .chatbox .main-message .text::before { border-right-color: ${BUBBLE} !important; }
.comms-panel .chatbox .main-message .text.unread::before { border-right-color: #ea9104 !important; }
.comms-panel .chatbox .child-message .text::before { border-bottom-color: ${BUBBLE} !important; }
.comms-panel .chatbox .child-message::before, .comms-panel .chatbox .child-message::after { border-color: rgba(136, 166, 254, .45) !important; }
.comms-panel .chatbox .author { color: #6cc4ff !important; }
.comms-panel .chatbox .neron .text { background: #0e4f7c !important; color: #dff6ff; }
.comms-panel .chatbox .neron .author { color: #ffffff !important; }
.comms-panel .chatbox .neron.child-message .text::before { border-bottom-color: #0e4f7c !important; }
.comms-panel #private-discussion-tab .unit > .message:nth-of-type(odd) p::before { border-right-color: ${BUBBLE} !important; }
.comms-panel .chatbox .toggle-children { color: #84e100 !important; }

.comms-panel #tips-tab .tip { background: ${BUBBLE} !important; color: ${INK}; box-shadow: none !important; }
.comms-panel #tips-tab .message p { background: ${BUBBLE} !important; color: ${INK}; }
.comms-panel #tips-tab .message p::before { border-right-color: ${BUBBLE} !important; }
.comms-panel #tips-tab .message.new p::before { border-right-color: #ea9104 !important; }
.comms-panel #tips-tab .message .author { color: #6cc4ff !important; }
.comms-panel .chatbox .mission-actions a { color: #ff7a8a !important; }

.comms-panel .input-area {
    background: #070b33 !important;
    color: ${INK} !important;
    border: 1px solid ${EDGE} !important;
    border-radius: 0 !important;
    opacity: 1 !important;
}
.comms-panel .input-area::placeholder { color: ${SOFT}; }
`;

/** The game shows the chat as a column next to the room from this width ($breakpoint-desktop-m + 1). */
const WIDE_LAYOUT_MIN_WIDTH_PX = 961;

/**
 * Marks of markChatMessages.ts: the character's own messages get a green edge and tint, the messages
 * naming the character a pink glow (orange stays the game's "unread" mark). They read on both the
 * game's pale chat and the dark one, hence colours on top of the bubble's own background.
 */
export const MESSAGE_MARKS_CSS = `
.comms-panel .chatbox .message[data-emush-own] > .text {
    box-shadow: inset 4px 0 0 #84e100, inset 0 0 0 1px rgba(132, 225, 0, .55) !important;
    background-image: linear-gradient(rgba(132, 225, 0, .14), rgba(132, 225, 0, .14)) !important;
}
.comms-panel .chatbox .message[data-emush-mention] > .text {
    box-shadow: 0 0 0 2px #ff5fa2, 0 0 12px rgba(255, 95, 162, .65) !important;
}
`;

/** Text size of the chat for each setting, in % of the game's own. */
export const CHAT_TEXT_SCALE: Record<ChatTextSize, number> = { small: 90, normal: 100, large: 115, larger: 130 };

/**
 * Chat text size: the game sizes its chat text in `em`, so scaling the chat box scales messages, logs and
 * times together, while pictures (portraits, icons) keep their crisp pixel size. Nothing for "normal".
 */
export function chatTextSizeCss(size: ChatTextSize): string {
    const scale = CHAT_TEXT_SCALE[size];

    return scale === 100 ? '' : `.comms-panel .chatbox, .comms-panel .chat-input .input-area { font-size: ${scale}% !important; }`;
}

/**
 * The room logs marked as comings and goings (markChatMessages.ts): one tight, small and dimmed line
 * (full again under the mouse), or hidden. Nothing for "normal".
 */
export function movementLogsCss(mode: MovementLogMode): string {
    const movement = '.comms-panel .chatbox .log[data-emush-movement]';
    switch (mode) {
        case 'compact':
            return [
                `${movement} { padding-top: 1px !important; padding-bottom: 1px !important; margin: 0 !important; border-bottom-color: transparent !important; opacity: .55; }`,
                `${movement} .text-log { font-size: .8em !important; }`,
                `${movement}:hover { opacity: 1; }`,
            ].join('\n');
        case 'hidden':
            return `${movement} { display: none !important; }`;
        default:
            return '';
    }
}

/** Widest the game may grow on a wide window: the extra width goes to the chat column. */
export const LARGE_GAME_MAX_WIDTH_PX = 1440;

/** The chat panel filling its column: tabs on top, the messages stretched, the buttons in one row at the bottom. */
const FILLING_CHAT_RULES = `
.game-content .comms-panel-container { display: flex !important; flex-direction: column !important; min-height: 0; }
.game-content .comms-panel {
    flex: 1 1 auto !important; min-height: 0 !important;
    display: grid !important; grid-template-columns: 1fr; grid-auto-columns: auto; grid-template-rows: auto minmax(0, 1fr) auto;
}
.game-content .comms-panel > .comms-panel-banner { grid-row: 1; grid-column: 1 / span 5; }
.game-content .comms-panel > .tab-content { grid-row: 2; grid-column: 1 / span 5; display: flex !important; flex-direction: column !important; min-height: 0 !important; max-height: none !important; }
.game-content .comms-panel > .action-button { grid-row: 3; justify-self: end; float: none !important; margin: 4px 0 0 4px; }
.game-content .comms-panel .chatbox-container { flex: 1 1 0 !important; flex-direction: column !important; min-height: 0 !important; }
.game-content .comms-panel .chatbox { flex: 1 1 0 !important; height: auto !important; min-height: 0 !important; max-height: none !important; }
`;

/**
 * Large chat: the chat column fills the full height of the game (next to the room and the projects)
 * instead of a fixed 436 px box, and the game uses the free width of wide windows for the chat.
 * Narrow windows keep the web client's stacked layout as-is.
 */
export const LARGE_CHAT_CSS = `
@media screen and (min-width: ${WIDE_LAYOUT_MIN_WIDTH_PX}px) {
    .box-container:has(> .game-content) { max-width: ${LARGE_GAME_MAX_WIDTH_PX}px !important; }
${FILLING_CHAT_RULES}
}
`;

