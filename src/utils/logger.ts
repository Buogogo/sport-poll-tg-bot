import {
  ConsoleHandler,
  getLogger,
  setup,
} from "https://deno.land/std@0.224.0/log/mod.ts";
import type { LogRecord } from "https://deno.land/std@0.224.0/log/logger.ts";

setup({
  handlers: {
    console: new ConsoleHandler("DEBUG", {
      formatter: ({ datetime, levelName, msg, args }: LogRecord) => {
        let message = `${datetime.toISOString()} [${levelName}] ${msg}`;
        if (args.length > 0) {
          message += ` ${
            args
              .map((arg) => JSON.stringify(arg, null, 2))
              .join(" ")
          }`;
        }
        return message;
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
