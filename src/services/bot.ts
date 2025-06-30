import { Bot, Composer } from "grammy";
import { MyContext, withSession } from "../middleware/session.ts";
import { onlyAdmin } from "../middleware/admin.ts";
import { errorHandler } from "../middleware/error.ts";
import { Config } from "../constants/types.ts";
import { loadEnvs } from "../constants/config.ts";
import {
  handleReboot,
  handleReset,
  handleStart,
} from "../commands/admin-commands.ts";
import { handleGroupText } from "../commands/group-commands.ts";
import { onlyTargetGroup } from "../middleware/group.ts";
import { mainMenu } from "../menus/admin-menu.ts";
import * as pollService from "./poll-service.ts";
import * as persistence from "./persistence.ts";
import * as scheduler from "./scheduler.ts";
import * as statusMessage from "./status-message.ts";
import { createConfigEditHandler } from "../utils/convo-handler.ts";

let botInstance: Bot<MyContext> | null = null;
let configInstance: Config | null = null;

export function initializeBot(): { bot: Bot<MyContext>; config: Config } {
  if (botInstance && configInstance) {
    return { bot: botInstance, config: configInstance };
  }
  configInstance = loadEnvs();
  botInstance = new Bot<MyContext>(configInstance.botToken);
  pollService.setBotInstance(botInstance, configInstance);
  statusMessage.setBotInstance(botInstance, configInstance);
  persistence.initializeEventListeners();
  scheduler.initializeSchedulerEventListeners();
  statusMessage.initializeEventListeners();
  botInstance.catch((e) => errorHandler(e));
  botInstance.chatType("private").use(createAdminComposer().middleware());
  botInstance.chatType("group").use(createGroupComposer().middleware());
  botInstance.use(createPollComposer().middleware());
  return { bot: botInstance, config: configInstance };
}

function createPollComposer() {
  const pollComposer = new Composer<MyContext>();
  pollComposer.on(
    "poll_answer",
    (ctx) => pollService.handleVote(ctx),
  );
  return pollComposer;
}

function createGroupComposer() {
  const groupComposer = new Composer<MyContext>();
  groupComposer.use(onlyTargetGroup());
  groupComposer.on("message:text", handleGroupText);
  return groupComposer;
}

function createAdminComposer() {
  const adminComposer = new Composer<MyContext>();
  adminComposer.use(onlyAdmin());
  adminComposer.use(withSession());

  // Reset edit flag on any menu navigation
  adminComposer.on("callback_query:data", async (ctx, next) => {
    ctx.session.editTarget = undefined;
    ctx.session.editContext = undefined;
    await next();
  });

  // Menu middleware
  adminComposer.use(mainMenu);

  // Config edit handler
  adminComposer.on("message:text", createConfigEditHandler());

  adminComposer.command("start", handleStart);
  adminComposer.command("reset", handleReset);
  adminComposer.command("reboot", handleReboot);
  return adminComposer;
}

export function getBot(): Bot<MyContext> {
  if (!botInstance) throw new Error("Bot not initialized");
  return botInstance;
}

export function getConfig(): Config {
  if (!configInstance) throw new Error("Config not initialized");
  return configInstance;
}
