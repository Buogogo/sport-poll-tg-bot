import { DEFAULT_WEEKLY_CONFIG } from "./config.ts";

export const MESSAGES = {
  // General
  MAIN_MENU_TITLE: "🤖 *Адміністрування SportPoll Bot*\n\nВиберіть опцію:",
  FIELD_NAMES: {
    question: "Питання",
    positiveOption: "Варіант ЗА",
    negativeOption: "Варіант ПРОТИ",
    targetVotes: "Кількість голосів",
    startHour: "Година",
    randomWindowMinutes: "Випадковість",
  } as Record<string, string>,

  // Admin menu actions
  CREATE_POLL: "📊 Створити опитування",
  CLOSE_POLL: "❌ Закрити опитування",
  WEEKLY_SETTINGS: "⚙️ Тижневі налаштування",
  ENTER_FIELD_PROMPT: (fieldName: string) => `✏️ Введіть ${fieldName}:`,

  // Logging/debug/info
  MESSAGE_NOT_MODIFIED: "message is not modified",
  MENU_UPDATE_SKIPPED: "Menu update skipped: message not modified",
  UNKNOWN_CONTEXT: (context: string) => `❓ Unknown context: ${context}`,

  // Poll status
  NO_ACTIVE_POLL: "❌ Немає активного опитування",
  POLL_COMPLETION: "⚽️ Місця на цей тиждень зайняті. Побачимось наступного!",
  POLL_SUCCESS: "✅ Опитування створено!",
  FIELD_SAVED: "✅ Збережено!",
  DAY_SAVED: "✅ День збережено!",

  // Poll control
  POLL_CLOSED_CB: "❌ Опитування закрито",
  NO_ACTIVE_POLLS_CB: "❌ Немає активних опитувань",
  WEEKLY_DISABLED: "⏸️ Тижневі опитування вимкнено",
  WEEKLY_ENABLED: "🟢 Тижневі опитування увімкнено",

  // Validation & errors
  INVALID_COMMAND_PLUS: "❌ Команда повинна починатися з /+",
  INVALID_COMMAND_MINUS: "❌ Команда повинна починатися з /-",
  INVALID_VOTE_COUNT: "❌ Кількість голосів повинна бути від 1 до 20",
  INVALID_VOTE_NUMBER: "❌ Номер голосу повинен бути додатним",
  INVALID_VOTE_NUMBER_FORMAT: "❌ Невірний формат номера голосу",
  VOTE_NUMBER_NOT_PROVIDED: "❌ Номер голосу не вказано",
  EMPTY_NAMES: "❌ Імена не можуть бути порожніми",
  TOO_MANY_NAMES: "❌ Максимум 10 імен за раз",
  NAME_TOO_LONG: "❌ Ім'я занадто довге (максимум 50 символів)",
  INVALID_NAME_CHARS: "❌ Недопустимі символи в імені",
  POLL_VOTE_NUMBER_TOO_LOW: "❌ Номер голосу повинен бути більше 0",
  INVALID_TARGET_VOTES: "❌ Кількість голосів повинна бути від 1 до 9",
  INVALID_START_HOUR: "❌ Година повинна бути від 0 до 23",
  INVALID_RANDOM_WINDOW: "❌ Випадковість повинна бути від 0 до 59 хвилин",
  INVALID_QUESTION_LENGTH: "❌ Питання повинно бути від 3 до 300 символів",
  INVALID_OPTION_LENGTH:
    "❌ Варіант відповіді повинен бути від 1 до 100 символів",
  PERMISSION_DENIED: "❌ Ви можете скасувати лише свої голоси",
  FIELD_REQUIRED_TEXT: "❌ Потрібно ввести текст",
  UNKNOWN_NUMERIC_FIELD: (fieldName: string) =>
    `❓ Unknown numeric field: ${fieldName}`,

  // Success/Info
  VOTE_REVOKED: "✅ Голос скасовано",
  REFRESHED: "♻️ Оновлено!",
  DATA_UP_TO_DATE: "✅ Дані актуальні",

  // Dynamic messages
  TOO_MANY_VOTES: (count: number, remaining: number) =>
    `❌ Неможливо додати ${
      escapeMarkdownV2(count.toString())
    } голосів. Залишилось лише ${
      escapeMarkdownV2(remaining.toString())
    } до досягнення цілі`,
  VOTE_NOT_FOUND: (voteNumber: number) =>
    `❌ Голос з номером ${escapeMarkdownV2(voteNumber.toString())} не знайдено`,
  VOTE_REVOKED_SUCCESS: (voteNumber: number, userName: string) =>
    `✅ Голос ${escapeMarkdownV2(voteNumber.toString())} (${
      escapeMarkdownV2(userName)
    }) відкликано`,
  VOTE_ADDED: (text: string) => `✅ Додано ${escapeMarkdownV2(text)}`,
  NO_VOTES_TO_REVOKE: "❌ Немає голосів для скасування",
  ANONYMOUS_VOTE_SINGLE: "1 анонім",
  ANONYMOUS_VOTES_MULTIPLE: (count: number) =>
    `x${escapeMarkdownV2(count.toString())} аноніми`,
  NAMED_VOTE_SINGLE: (name: string) => `голос за ${escapeMarkdownV2(name)}`,
  NAMED_VOTES_MULTIPLE: (names: string) =>
    `голоси за: ${escapeMarkdownV2(names)}`,
  INVITED: (name: string) => `запросив ${escapeMarkdownV2(name)}`,
  POLL_CLOSED_SUCCESS: "✅ Опитування закрито",
  EDIT_PROMPT: (fieldName: string, currentValue: string) =>
    `✏️ *Редагування: ${escapeMarkdownV2(fieldName)}*\n\nПоточне значення: \`${
      escapeMarkdownV2(currentValue, { code: true })
    }\`\n\nВведіть нове значення:`,
  POLL_CREATE_TEXT: (pollData: {
    question: string;
    positiveOption: string;
    negativeOption: string;
    targetVotes: number;
  }) =>
    `📊 Створення опитування\n\nПитання: ${
      escapeMarkdownV2(pollData.question)
    }\nВаріант ЗА: ${
      escapeMarkdownV2(pollData.positiveOption)
    }\nВаріант ПРОТИ: ${escapeMarkdownV2(pollData.negativeOption)}\nЦіль: ${
      escapeMarkdownV2(pollData.targetVotes.toString())
    } голосів`,
  WEEKLY_SETTINGS_TEXT: (config: {
    question: string;
    positiveOption: string;
    negativeOption: string;
    targetVotes: number;
    dayOfWeek: number;
    startHour: number;
    enabled: boolean;
  }) => {
    const dayName = DAYS[config.dayOfWeek];
    const timeStr = `${config.startHour.toString().padStart(2, "0")}:00`;
    const status = config.enabled ? "✅ Увімкнено" : "❌ Вимкнено";
    return `⚙️ Тижневі налаштування\n\nПитання: ${
      escapeMarkdownV2(config.question)
    }\nВаріант ЗА: ${escapeMarkdownV2(config.positiveOption)}\nВаріант ПРОТИ: ${
      escapeMarkdownV2(config.negativeOption)
    }\nЦіль: ${
      escapeMarkdownV2(config.targetVotes.toString())
    } голосів\nДень: ${escapeMarkdownV2(dayName)}\nЧас: ${
      escapeMarkdownV2(timeStr)
    }\nСтатус: ${escapeMarkdownV2(status)}`;
  },

  // Status message components
  STATUS_HEADER: "📊 *Статус опитування*\n\n",
  STATUS_COMPLETED: "✅ *Опитування завершено!*\n",
  STATUS_ACTIVE: "🗳️ *Опитування активне*\n",
  STATUS_TARGET: (targetVotes: number) =>
    `🎯 Ціль: *${escapeMarkdownV2(targetVotes.toString())}* голосів\n`,
  STATUS_CURRENT: (currentVotes: number) =>
    `📊 Поточний рахунок: *${
      escapeMarkdownV2(currentVotes.toString())
    }* голосів\n`,
  STATUS_REMAINING: (remaining: number) =>
    `⏳ Залишилось: *${
      escapeMarkdownV2(remaining.toString())
    }* голосів\n\n💡 *Як голосувати:*\n`,
  STATUS_INSTRUCTIONS: [
    "• Використовуйте опитування вище для особистого голосу",
    "• Або використовуйте команди:",
    "  `/+` - додати 1 голос ЗА",
    "  `/+ 3` - додати 3 голоси ЗА",
    "  `/+ Петро Іван` - додати голоси від імені людей",
    "  `/- [номер]` - відкликати голос за номером зі списку\n",
  ].join("\n"),
  STATUS_THANKS: "\n⚽️ *Дякуємо всім за участь!*\n\n",
  STATUS_VOTES_LIST: "📋 *Список голосів ЗА:*\n",
  STATUS_VOTE_ITEM: (index: number, userName: string, requesterName?: string) =>
    requesterName
      ? `${escapeMarkdownV2(index.toString())}. ${
        escapeMarkdownV2(userName)
      } (запросив ${escapeMarkdownV2(requesterName)})`
      : `${escapeMarkdownV2(index.toString())}. ${escapeMarkdownV2(userName)}`,

  // Vote revocation errors
  DIRECT_VOTE_REVOKE_ERROR:
    "❌ Цей голос не можна відкликати через команду. Якщо це ваш особистий голос, приберіть його через опитування Telegram.",
  PERMISSION_REVOKE_ERROR:
    "❌ Ви можете відкликати лише ті голоси, які ви додали, або бути адміністратором.",

  // Defaults
  DEFAULTS: {
    POLL_QUESTION: DEFAULT_WEEKLY_CONFIG.question,
    POSITIVE_OPTION: DEFAULT_WEEKLY_CONFIG.positiveOption,
    NEGATIVE_OPTION: DEFAULT_WEEKLY_CONFIG.negativeOption,
    TARGET_VOTES: DEFAULT_WEEKLY_CONFIG.targetVotes,
  },

  // Menu & UI
  INACTIVITY_SESSION_RESET: "⏳ Сесію скинуто через неактивність.",
  ADMIN_INTERFACE_RESET: "✅ Адмін-інтерфейс скинуто.",
  ANONYMOUS_USER: "Анонім",
  MENU_REFRESH: "🔄 Оновити",
  MENU_CREATE: "✅ Створити",
  MENU_BACK: "◀️ Назад",
  MENU_ENABLED: "🟢 Увімкнено",
  MENU_DISABLED: "🔴 Вимкнено",
  MENU_RANDOM_OFF: "вимк",
  MENU_RANDOM_MINUTES: (minutes: number) => `${minutes}хв`,
  MENU_LABEL_QUESTION: (question: string) =>
    `✏️ Питання: ${escapeMarkdownV2(question)}`,
  MENU_LABEL_POSITIVE: (positiveOption: string) =>
    `✅ ЗА: ${escapeMarkdownV2(positiveOption)}`,
  MENU_LABEL_NEGATIVE: (negativeOption: string) =>
    `❌ ПРОТИ: ${escapeMarkdownV2(negativeOption)}`,
  MENU_LABEL_TARGET: (targetVotes: number) =>
    `🎯 Ціль: ${escapeMarkdownV2(targetVotes.toString())}`,
  MENU_LABEL_DAY: (day: string) => `📅 День: ${escapeMarkdownV2(day)}`,
  MENU_LABEL_TIME: (hour: number) =>
    `🕰️ Час: ${escapeMarkdownV2(hour.toString())}:00`,
  REBOOT_SUCCESS: "♻️ Всі дані очищено\. Перезапуск завершено\.",
  CANCELLED: "❌ Скасовано",
  ALREADY_UPDATED: "Вже оновлено!",
  ANONYMOUS_NAME: "Анонім",
  UNKNOWN_DAY: "???",
  DEFAULT_ERROR: "🫠 Упс! Шось не так",
} as const;

export const DAYS: Record<number, string> = {
  0: "Неділя",
  1: "Понеділок",
  2: "Вівторок",
  3: "Середа",
  4: "Четвер",
  5: "П'ятниця",
  6: "Субота",
};

// Utility to escape MarkdownV2 special characters
type EscapeOptions = { code?: boolean };
export function escapeMarkdownV2(
  text: string,
  options: EscapeOptions = {},
): string {
  // Telegram MarkdownV2 special chars
  const chars = options.code
    ? /[`\\]/g // only backtick and backslash in code
    : /[_*\[\]()~`>#+\-=|{}.!\\]/g;
  return text.replace(chars, (c) => `\\${c}`);
}
