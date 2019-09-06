// Ripped & edited from: https://github.com/winstonjs/winston/blob/master/examples/quick-start.js
import { createLogger, format, transports } from "winston";

// tslint:disable:object-literal-sort-keys
export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "spk" },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new transports.File({ filename: "spk-error.log", level: "error" }),
    new transports.File({ filename: "spk-combined.log" }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple())
    })
  ]
});
