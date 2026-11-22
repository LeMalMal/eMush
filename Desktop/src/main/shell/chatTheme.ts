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

/** Widest the game may grow on a wide window: the extra width goes to the chat column. */
export const LARGE_GAME_MAX_WIDTH_PX = 1440;

/**
 * Large chat: the chat column fills the full height of the game (next to the room and the projects)
 * instead of a fixed 436 px box, and the game uses the free width of wide windows for the chat.
 * Narrow windows keep the web client's stacked layout as-is.
 */
export const LARGE_CHAT_CSS = `
@media screen and (min-width: ${WIDE_LAYOUT_MIN_WIDTH_PX}px) {
    .box-container:has(> .game-content) { max-width: ${LARGE_GAME_MAX_WIDTH_PX}px !important; }
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
}
`;
