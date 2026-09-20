/**
 * `@app/data` — shared data-access layer for the monorepo.
 *
 * UI code programs against `ChatDataSource`; platforms provide the
 * implementation (`WebChatDataSource` today, `NativeChatDataSource` next).
 */
export * from "./chat-source";
export * from "./cache";
export * from "./web-source";
export * from "./native-source";
