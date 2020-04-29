import { checkoutCommitPushCreatePRLink } from "./gitpr";

import { disableVerboseLogging, enableVerboseLogging } from "../logger";

import {
  isEmptyRepository,
  getCurrentBranch,
  checkoutBranch,
  commitPath,
  pushBranch,
  getOriginUrl,
  getPullRequestLink,
  deleteBranch,
} from "./gitutils";

jest.mock("./gitutils");

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("checkoutCommitPushCreatePRLink", () => {
  it("should log an error if the HLD repository is empty", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(true));

    await checkoutCommitPushCreatePRLink("branch", "some", "paths");

    expect(isEmptyRepository).toHaveBeenCalledTimes(1);

    // We expect to have errored out, so none of these should be called.
    expect(getCurrentBranch).toHaveBeenCalledTimes(0);
    expect(checkoutBranch).toHaveBeenCalledTimes(0);
  });

  it("should throw an error if getCurrentBranch fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);

      expect(checkoutBranch).toHaveBeenCalledTimes(0);
      expect(err).not.toBeUndefined();
    }
  });

  it("should throw an error if checkoutBranch fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(1);

      expect(commitPath).toHaveBeenCalledTimes(0);
      expect(err).toBeDefined();
    }
  });

  it("should throw an error if commitPath fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (commitPath as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(1);
      expect(commitPath).toHaveBeenCalledTimes(1);

      expect(pushBranch).toHaveBeenCalledTimes(0);
      expect(err).toBeDefined();
    }
  });

  it("should throw an error if pushBranch fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (commitPath as jest.Mock).mockImplementation(() => Promise.resolve());

    (pushBranch as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(1);
      expect(commitPath).toHaveBeenCalledTimes(1);
      expect(pushBranch).toHaveBeenCalledTimes(1);

      expect(getOriginUrl).toHaveBeenCalledTimes(0);
      expect(err).toBeDefined();
    }
  });

  it("should throw an error if getOriginUrl fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (commitPath as jest.Mock).mockImplementation(() => Promise.resolve());

    (pushBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (getOriginUrl as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(1);
      expect(commitPath).toHaveBeenCalledTimes(1);
      expect(pushBranch).toHaveBeenCalledTimes(1);
      expect(getOriginUrl).toHaveBeenCalledTimes(1);

      expect(getPullRequestLink).toHaveBeenCalledTimes(0);
      expect(err).toBeDefined();
    }
  });

  it("should throw an error if getPullRequestLink fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (commitPath as jest.Mock).mockImplementation(() => Promise.resolve());

    (pushBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (getOriginUrl as jest.Mock).mockImplementation(() =>
      Promise.resolve("some url")
    );

    (getPullRequestLink as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(1);
      expect(commitPath).toHaveBeenCalledTimes(1);
      expect(pushBranch).toHaveBeenCalledTimes(1);
      expect(getOriginUrl).toHaveBeenCalledTimes(1);
      expect(getPullRequestLink).toHaveBeenCalledTimes(1);

      expect(deleteBranch).toHaveBeenCalledTimes(0);
      expect(err).toBeDefined();
    }
  });

  it("should throw an error if deleteBranch fails", async () => {
    (isEmptyRepository as jest.Mock).mockReturnValue(Promise.resolve(false));

    (getCurrentBranch as jest.Mock).mockImplementation(() =>
      Promise.resolve("some branch")
    );

    (checkoutBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (commitPath as jest.Mock).mockImplementation(() => Promise.resolve());

    (pushBranch as jest.Mock).mockImplementation(() => Promise.resolve());

    (getOriginUrl as jest.Mock).mockImplementation(() =>
      Promise.resolve("some url")
    );

    (getPullRequestLink as jest.Mock).mockImplementation(() =>
      Promise.resolve("some pr link")
    );

    (deleteBranch as jest.Mock).mockImplementation(() =>
      Promise.reject("some reason")
    );

    try {
      await checkoutCommitPushCreatePRLink("branch", "some", "paths");
    } catch (err) {
      expect(isEmptyRepository).toHaveBeenCalledTimes(1);
      expect(getCurrentBranch).toHaveBeenCalledTimes(1);
      expect(checkoutBranch).toHaveBeenCalledTimes(2);
      expect(commitPath).toHaveBeenCalledTimes(1);
      expect(pushBranch).toHaveBeenCalledTimes(1);
      expect(getOriginUrl).toHaveBeenCalledTimes(1);
      expect(getPullRequestLink).toHaveBeenCalledTimes(1);
      expect(deleteBranch).toHaveBeenCalledTimes(1);

      expect(err).toBeDefined();
    }
  });
});
