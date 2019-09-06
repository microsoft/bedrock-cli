import fs from "fs";
import path from "path";
import { logger } from ".";

test("A new info log gets added to the combined log", () => {
  const randomString = Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substr(0, 5);
  logger.info(randomString, () => {
    expect(
      fs.readFileSync(path.join(process.cwd(), "spk-combined.log"), {
        encoding: "utf8"
      })
    ).toMatch(new RegExp(`.+${randomString}.+`, "s"));
  });
});

test("A new error log gets added to the error log", () => {
  const randomString = Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substr(0, 5);
  logger.error(randomString, () => {
    expect(
      fs.readFileSync(path.join(process.cwd(), "spk-error.log"), {
        encoding: "utf8"
      })
    ).toMatch(new RegExp(`.+${randomString}.+`, "s"));
  });
});
