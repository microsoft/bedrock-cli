import { createLogger, format, transports } from "winston";
import { CLI_LOG_FILENAME } from "../lib/constants";

// visit https://github.com/winstonjs/logform for format options
export const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true })),
  defaultMeta: { service: "spk" },
  transports: [
    new transports.File({
      filename: CLI_LOG_FILENAME,
      format: format.simple(),
    }),
    new transports.Console({
      format: format.cli(),
    }),
  ],
});

export const enableVerboseLogging = (): void => {
  logger.info("Enabling verbose logging");
  logger.level = "silly";
};

export const disableVerboseLogging = (): void => {
  logger.info("Disabling verbose logging");
  logger.level = "info";
};
