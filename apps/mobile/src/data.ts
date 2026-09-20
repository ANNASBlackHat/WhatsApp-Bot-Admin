/**
 * Shared data-layer singleton for the mobile app.
 *
 * All screens program against `ChatDataSource` (`@app/data`); this file only
 * picks the implementation. Swapping to a mock for tests previews is a
 * one-line change here.
 */
import { NativeChatDataSource } from "@app/data/native";

export const chatSource = new NativeChatDataSource();

/** Chats loaded per page (limit-growth pagination, same as web). */
export const CHATS_PAGE_SIZE = 50;

/** Thread messages loaded per page (limit-growth pagination, same as web). */
export const MESSAGE_PAGE_SIZE = 50;
