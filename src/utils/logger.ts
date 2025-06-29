import {
  ConsoleHandler,
  getLogger,
  setup,
} from "https://deno.land/std@0.224.0/log/mod.ts";
import type { LogRecord } from "https://deno.land/std@0.224.0/log/logger.ts";

setup({
  handlers: {
    console: new ConsoleHandler("DEBUG", {
      formatter: (logRecord: LogRecord) => {
        const { datetime, levelName, msg } = logRecord;
        return `${datetime.toISOString()} [${levelName}] ${msg}`;
      },
    }),
  },
  loggers: {
    default: {
      level: "INFO",
      handlers: ["console"],
    },
    botyanya: {
      level: "DEBUG",
      handlers: ["console"],
    },
  },
});

export const logger = getLogger("botyanya");
