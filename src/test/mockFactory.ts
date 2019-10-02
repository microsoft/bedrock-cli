import yaml from "js-yaml";
import { IBedrockFile, IHelmConfig, IMaintainersFile } from "../types";

export const createTestMaintainersYaml = (
  asString = true
): IMaintainersFile | string => {
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
};

export const createTestBedrockYaml = (
  asString = true
): IBedrockFile | string => {
  const service1HelmConfig: IHelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      path: ""
    }
  };

  const service2HelmConfig: IHelmConfig = {
    chart: {
      branch: "master",
      git: "https://github.com/catalystcode/spk-demo-repo.git",
      path: "/service1"
    }
  };

  const zookeeperHelmConfig: IHelmConfig = {
    chart: {
      chart: "zookeeper",
      repository: "https://kubernetes-charts-incubator.storage.googleapis.com/"
    }
  };

  const data: IBedrockFile = {
    services: {
      "./": {
        helm: service1HelmConfig
      },
      "./packages/service1": {
        helm: service2HelmConfig
      },
      "./zookeeper": {
        helm: zookeeperHelmConfig
      }
    }
  };

  return asString ? yaml.dump(data) : data;
};
