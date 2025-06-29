import { Bot } from "grammy";
import { MyContext } from "../middleware/session.ts";
import { pollStateEvt } from "../events/events.ts";
import * as pollService from "./poll-service.ts";
import { MESSAGES } from "../constants/messages.ts";

let botInstance: Bot<MyContext> | null = null;
let configInstance: {
  botToken: string;
  adminUserIds: number[];
  targetGroupChatId: number;
} | null = null;

export function setBotInstance(
  bot: Bot<MyContext>,
  config: {
    botToken: string;
    adminUserIds: number[];
    targetGroupChatId: number;
  },
) {
  botInstance = bot;
  configInstance = config;
}

export async function updateStatusMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;

  const pollState = pollService.getPollState();
  const { statusMessageId } = pollState;
  if (!statusMessageId) return;

  const statusText = pollService.buildStatusMessage();
  await botInstance.api.editMessageText(
    configInstance.targetGroupChatId,
    statusMessageId,
    statusText,
    { parse_mode: "Markdown" },
  );
}

export async function createStatusMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;
  const statusMessage = await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    pollService.buildStatusMessage(),
    { parse_mode: "Markdown" },
  );
  pollService.setPollState({ statusMessageId: statusMessage.message_id });
}

export async function sendPollCompletionMessage(): Promise<void> {
  if (!botInstance || !configInstance) return;
  await botInstance.api.sendMessage(
    configInstance.targetGroupChatId,
    MESSAGES.POLL_COMPLETION,
  );
}

export async function stopPoll(): Promise<void> {
  if (!botInstance || !configInstance) return;
  const pollState = pollService.getPollState();
  if (pollState.telegramMessageId !== undefined) {
    await botInstance.api.stopPoll(
      configInstance.targetGroupChatId,
      pollState.telegramMessageId,
    );
  }
}

export function initializeEventListeners() {
  pollStateEvt.attach(async (event) => {
    if (event.type === "poll_started") {
      await createStatusMessage();
      return;
    } else if (event.type === "poll_completed") {
      await stopPoll();
      await sendPollCompletionMessage();
    }
    await updateStatusMessage();
  });
}
