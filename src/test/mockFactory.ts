import yaml from "js-yaml";
import { IMaintainersFile } from "../types";

export class MockFactory {
  public static createTestMaintainersYaml(
    asString = true
  ): IMaintainersFile | string {
    const data: IMaintainersFile = {
      services: {
        "./": {
          maintainers: [
            {
              email: "somegithubemailg@users.noreply.github.com",
              name: "my name"
            }
          ]
        },
        "./packages/service1": {
          maintainers: [
            {
              email: "hello@users.noreply.github.com",
              name: "testUser"
            }
          ]
        }
      }
    };

    return asString ? yaml.dump(data) : data;
  }
}
