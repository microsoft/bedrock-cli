import { createLogger, format, transports } from "winston";

// tslint:disable:object-literal-sort-keys
// visit https://github.com/winstonjs/logform for format options
export const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true })),
  defaultMeta: { service: "spk" },
  transports: [
    new transports.File({
      filename: "spk.log",
      format: format.simple()
    }),
    new transports.Console({
      format: format.cli()
    })
  ]
});

export const enableVerboseLogging = () => {
  logger.info("Enabling verbose logging");
  logger.level = "silly";
};

export const disableVerboseLogging = () => {
  logger.info("Disabling verbose logging");
  logger.level = "info";
};
