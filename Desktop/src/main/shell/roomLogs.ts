/**
 * Room logs that only say someone came in or left (half of a busy room's logs). The game sends them
 * translated, without their key, so they are recognised by their wording, after the character's name
 * written in bold: "est entré·e / sorti·e" (with the French gender forms), "entered / left the room",
 * "ha entrado / salido", optionally followed by the place for trackers ("... dans le Laboratoire.").
 * Self-contained: the chat marking script embeds its source to run it in the game page.
 */
export function isMovementLog(textAfterName: string): boolean {
    return /^\s*(est (entré|sorti)(e|·e)?|entered the room|left the room|ha (entrado|salido))(\s[^.]{1,40})?\.\s*$/iu.test(textAfterName);
}
