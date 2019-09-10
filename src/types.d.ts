export interface IMaintainersFile {
  maintainers: Array<{
    name: string;
    email: string;
    website?: string;
  }>;
}

export interface IBedrockFile {
  helm: {
    chart:
      | {
          repository: string; // repo (eg; https://kubernetes-charts-incubator.storage.googleapis.com/)
          chart: string; // chart name (eg; zookeeper)
        }
      | ({
          git: string; // git url to clone (eg; https://github.com/helm/charts.git)
          path: string; // path in the git repo to the directory containing the Chart.yaml (eg; incubator/zookeeper)
        } & (
          | {
              sha: string; // sha to checkout (eg; 4e61eb234b0ac38956efc1b52a0455a43dba026f)
              tag?: string; // indicate the semantics of the sha (eg; v1.0.2)
            }
          | {
              branch: string; // branch to checkout (eg; master)
            }
        ));
  };
}
