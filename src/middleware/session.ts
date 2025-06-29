import { Context, session, SessionFlavor, StorageAdapter } from "grammy";
import { MenuFlavor } from "@grammyjs/menu";
import { ConversationFlavor } from "@grammyjs/conversations";
import { AdminSession } from "../constants/types.ts";
import { sessionEvt } from "../events/events.ts";

export interface SessionData {
  adminSession?: AdminSession;
  editTarget?: string;
  editContext?: "poll" | "weekly";
  routeState?: string;
  needsRefresh?: boolean;
  lastMenuMessageId?: number;
  lastActiveAt?: number;
}

export type MyContext =
  & Context
  & SessionFlavor<SessionData>
  & MenuFlavor
  & ConversationFlavor;

class DenoKvAdapter<T> implements StorageAdapter<T> {
  private prefix = ["sessions"];

  private key(key: string): Deno.KvKey {
    return [...this.prefix, key];
  }

  async read(key: string): Promise<T | undefined> {
    const kv = await Deno.openKv();
    const res = await kv.get<T>(this.key(key));
    return res.value === null ? undefined : res.value;
  }

  async write(key: string, value: T): Promise<void> {
    const kv = await Deno.openKv();
    await kv.set(this.key(key), value);
  }

  async delete(key: string): Promise<void> {
    const kv = await Deno.openKv();
    await kv.delete(this.key(key));
  }

  // No-op for cleanupOldSessions; Deno KV does not support TTL natively yet
  async cleanupOldSessions(): Promise<void> {}
}

const kvAdapter = new DenoKvAdapter<SessionData>();

export const withSession = () =>
  session({ initial: (): SessionData => ({}), storage: kvAdapter });

export const cleanupOldSessions = async (): Promise<void> => {
  await kvAdapter.cleanupOldSessions();
};

export const getAdminSession = (ctx: MyContext): AdminSession => {
  if (!ctx.session.adminSession) {
    ctx.session.adminSession = { chatId: ctx.chat!.id };
  }
  return ctx.session.adminSession!;
};

export const resetSession = async (ctx: MyContext) => {
  ctx.session = {};
  const kv = await Deno.openKv();
  let key: string | undefined;
  if (ctx.chat?.id) {
    key = String(ctx.chat.id);
  } else if (ctx.from?.id) {
    key = String(ctx.from.id);
  }
  if (key) {
    await kv.delete(["sessions", key]);
  }
};

sessionEvt.attach(async ({ ctx }) => {
  await resetSession(ctx);
});
