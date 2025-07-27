import { Context, session, SessionFlavor } from "grammy";
import { MenuFlavor } from "@grammyjs/menu";
import { handleEditMessage } from "../utils/convo-handler.ts";

interface SimpleSession {
  lastMenuMessageId?: number;
  editMode?: string;
}

export type MyContext = Context & SessionFlavor<SimpleSession> & MenuFlavor;

const SESSION_KEY = ["admin-session"];

export const withSession = () => 
  session({ 
    initial: (): SimpleSession => ({}),
    getSessionKey: (ctx) => ctx.chat?.id?.toString() || ctx.from?.id?.toString()
  });

export const getSession = async (ctx: MyContext): Promise<SimpleSession> => {
  const kv = await Deno.openKv();
  const key = ctx.chat?.id || ctx.from?.id;
  if (!key) return {};
  const result = await kv.get<SimpleSession>([...SESSION_KEY, key]);
  return result.value || {};
};

export const saveSession = async (ctx: MyContext, data: SimpleSession): Promise<void> => {
  const kv = await Deno.openKv();
  const key = ctx.chat?.id || ctx.from?.id;
  if (!key) return;
  await kv.set([...SESSION_KEY, key], data);
};

export const clearSession = async (ctx: MyContext): Promise<void> => {
  const kv = await Deno.openKv();
  const key = ctx.chat?.id || ctx.from?.id;
  if (!key) return;
  await kv.delete([...SESSION_KEY, key]);
};

export const clearAllPersistentData = async (): Promise<void> => {
  const kv = await Deno.openKv();
  for await (const entry of kv.list({ prefix: [] })) {
    await kv.delete(entry.key);
  }
};

export const editStateRouter = async (ctx: MyContext, next: () => Promise<void>) => {
  const session = await getSession(ctx);
  if (session.editMode) {
    return await handleEditMessage(ctx, session.editMode);
  }
  await next();
};
