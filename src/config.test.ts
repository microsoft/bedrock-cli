import os from "os";
import path from "path";
import shell from "shelljs";
import uuid from "uuid/v4";
import { Bedrock, write } from "./config";
import { IBedrockFile } from "./types";

describe("Bedrock", () => {
  test("valid helm configuration passes", async () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: IBedrockFile = {
      rings: {},
      services: {
        "foo/a": {
          helm: {
            chart: {
              chart: "elastic",
              repository: "some-repo"
            }
          }
        },
        "foo/b": {
          helm: {
            chart: {
              git: "foo",
              path: "some/path",
              sha: "cef8361c62e7a91887625336eb13a8f90dbcf8df"
            }
          }
        }
      }
    };
    write(validBedrockYaml, randomTmpDir);

    let bedrockConfig: IBedrockFile | undefined;
    let error: Error | undefined;
    try {
      bedrockConfig = Bedrock(randomTmpDir);
    } catch (err) {
      error = err;
    }
    expect(bedrockConfig).toBeTruthy();
    expect(error).toBeUndefined();
  });

  test("invalid helm configuration fails", async () => {
    const randomTmpDir = path.join(os.tmpdir(), uuid());
    shell.mkdir("-p", randomTmpDir);
    const validBedrockYaml: IBedrockFile = {
      rings: {},
      services: {
        "foo/a": {
          helm: {
            // Missing 'chart'
            chart: {
              repository: "some-repo"
            }
          }
        },
        "foo/b": {
          helm: {
            // missing 'path'
            chart: {
              git: "foo",
              sha: "cef8361c62e7a91887625336eb13a8f90dbcf8df"
            }
          }
        }
      }
    } as any;
    write(validBedrockYaml, randomTmpDir);

    let bedrockConfig: IBedrockFile | undefined;
    let error: Error | undefined;
    try {
      bedrockConfig = Bedrock(randomTmpDir);
    } catch (err) {
      error = err;
    }
    expect(bedrockConfig).toBeFalsy();
    expect(error).toBeDefined();
  });
});
