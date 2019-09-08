import fs from "fs";
import path from "path";
import uuid from "uuid/v4";
import { enableVerboseLogging, logger, disableVerboseLogging } from ".";

const logFile = path.join(process.cwd(), "spk.log");

test("A new info log gets added to logs", () => {
  const randomString = uuid();

  // should appear in combined log file
  logger.info(randomString, () => {
    expect(fs.readFileSync(logFile, "utf8")).toMatch(
      new RegExp(`.+${randomString}.+`, "s")
    );
  });
});

test("A new error log gets added to logs", () => {
  const randomString = uuid();

  // should appear in error log file
  logger.error(randomString, () => {
    expect(fs.readFileSync(logFile, "utf8")).toMatch(
      new RegExp(`.+${randomString}.+`, "s")
    );
  });
});

test("Set verbose logging", () => {
  const randomString = uuid();

  // debug logs should not appear in logs
  logger.debug(randomString, () => {
    expect(fs.readFileSync(logFile, "utf8")).not.toMatch(
      new RegExp(`.+${randomString}.+`, "s")
    );
  });

  enableVerboseLogging();

  // debug logs should now appear in logs
  logger.debug(randomString, () => {
    expect(fs.readFileSync(logFile, "utf8")).toMatch(
      new RegExp(`.+${randomString}.+`, "s")
    );
  });

  disableVerboseLogging();

  // debug logs should now not appear in logs
  const newRandomString = uuid();
  logger.debug(newRandomString, () => {
    expect(fs.readFileSync(logFile, "utf8")).not.toMatch(
      new RegExp(`.+${newRandomString}.+`, "s")
    );
  });
});
