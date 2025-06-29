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

class FileAdapter<T> implements StorageAdapter<T> {
  constructor(private dirName: string) {}

  async read(key: string): Promise<T | undefined> {
    await Deno.mkdir(this.dirName, { recursive: true });
    return JSON.parse(
      await Deno.readTextFile(
        `${this.dirName}/${this.sanitizeKey(key)}.json`,
      ),
    );
  }

  async write(key: string, value: T): Promise<void> {
    await Deno.mkdir(this.dirName, { recursive: true });
    await Deno.writeTextFile(
      `${this.dirName}/${this.sanitizeKey(key)}.json`,
      JSON.stringify(value, null, 2),
    );
  }

  async delete(key: string): Promise<void> {
    await Deno.remove(`${this.dirName}/${this.sanitizeKey(key)}.json`);
  }

  async cleanupOldSessions(): Promise<void> {
    const sessionsDir = Deno.readDir(this.dirName);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    for await (const entry of sessionsDir) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const filePath = `${this.dirName}/${entry.name}`;
        const stat = await Deno.stat(filePath);
        if (now - stat.mtime!.getTime() > maxAge) {
          await Deno.remove(filePath);
        }
      }
    }
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9\-_]/g, "_");
  }
}

const fileAdapter = new FileAdapter<SessionData>("sessions");

export const withSession = () => session({ initial: (): SessionData => ({}) });

export const cleanupOldSessions = async (): Promise<void> => {
  await fileAdapter.cleanupOldSessions();
};

export const getAdminSession = (ctx: MyContext): AdminSession => {
  if (!ctx.session.adminSession) {
    ctx.session.adminSession = { chatId: ctx.chat!.id };
  }
  return ctx.session.adminSession!;
};

export const resetSession = (ctx: MyContext) => {
  // Reset session to initial state
  ctx.session = {};
};

sessionEvt.attach(({ ctx }) => {
  resetSession(ctx);
});
