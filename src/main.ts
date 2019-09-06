import { logger } from "./logger";

export const sum = (a: number, b: number) => {
  logger.info("Hello from the sum function");
  return a + b;
};
