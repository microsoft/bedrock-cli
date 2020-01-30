import * as azure from "azure-storage";
import uuid from "uuid/v4";
import { logger } from "../../logger";
/**
 * Deployment Table interface to hold necessary information about a table for deployments
 */
export interface IDeploymentTable {
  accountName: string;
  accountKey: string;
  tableName: string;
  partitionKey: string;
}

/**
 * Adds a new deployment in storage for SRC to ACR pipeline
 * @param tableInfo table info interface containing information about the storage for deployments
 * @param pipelineId Identifier of the first pipeline
 * @param imageTag image tag name
 * @param serviceName service name
 * @param commitId commit identifier
 */
export const addSrcToACRPipeline = (
  tableInfo: IDeploymentTable,
  pipelineId: string,
  imageTag: string,
  serviceName: string,
  commitId: string
): Promise<any> => {
  const entry: any = {};
  entry.RowKey = getRowKey();
  entry.p1 = pipelineId;
  entry.imageTag = imageTag;
  entry.service = serviceName;
  entry.commitId = commitId;
  entry.PartitionKey = tableInfo.partitionKey;
  return new Promise(resolve => {
    insertToTable(tableInfo, entry)
      .then(() => {
        logger.info("Added first pipeline details to the database");
        resolve(entry);
      })
      .catch(err => {
        logger.error(err);
      });
  });
};

/**
 * Updates the ACR to HLD pipeline in the storage by finding its corresponding SRC to ACR pipeline
 * @param tableInfo table info interface containing information about the storage for deployments
 * @param pipelineId identifier for the ACR to HLD pipeline
 * @param imageTag image tag name
 * @param hldCommitId commit identifier into HLD
 * @param env environment name, such as Dev, Staging etc.
 */
export const updateACRToHLDPipeline = (
  tableInfo: IDeploymentTable,
  pipelineId: string,
  imageTag: string,
  hldCommitId: string,
  env: string,
  pr?: string
): Promise<any> => {
  return new Promise(resolve => {
    findMatchingDeployments(tableInfo, "imageTag", imageTag).then(entries => {
      let entryToInsert: any;
      for (const entry of entries) {
        entryToInsert = entry;
        if (
          (entry.p2 ? entry.p2._ === pipelineId : true) &&
          (entry.hldCommitId ? entry.hldCommitId._ === hldCommitId : true) &&
          (entry.env ? entry.env._ === env : true)
        ) {
          entry.p2 = pipelineId.toLowerCase();
          entry.hldCommitId = hldCommitId.toLowerCase();
          entry.env = env.toLowerCase();
          if (pr) {
            entry.pr = pr.toLowerCase();
          }
          updateEntryInTable(tableInfo, entry)
            .then(() => {
              logger.info(
                "Updated image tag release details for its corresponding pipeline"
              );
              resolve(entry);
            })
            .catch(err => {
              logger.error(err);
            });
          return;
        }
      }
      if (entryToInsert) {
        entryToInsert.p2 = pipelineId.toLowerCase();
        entryToInsert.hldCommitId = hldCommitId.toLowerCase();
        entryToInsert.env = env.toLowerCase();
        entryToInsert.RowKey = getRowKey();
        entryToInsert.p3 = undefined;
        entryToInsert.manifestCommitId = undefined;
        if (pr) {
          entryToInsert.pr = pr.toLowerCase();
        }
        insertToTable(tableInfo, entryToInsert)
          .then(() => {
            logger.info(
              `Added new p2 entry for imageTag ${imageTag} by finding a similar entry`
            );
            resolve(entryToInsert);
          })
          .catch(err => {
            logger.error(err);
          });
        return;
      }
      // Ideally we should not be getting here, because there should always be a p1 for any p2 being created.
      const newEntry: any = {};
      newEntry.PartitionKey = tableInfo.partitionKey;
      newEntry.RowKey = getRowKey();
      newEntry.p2 = pipelineId.toLowerCase();
      newEntry.env = env.toLowerCase();
      newEntry.hldCommitId = hldCommitId.toLowerCase();
      newEntry.imageTag = imageTag.toLowerCase();
      if (pr) {
        newEntry.pr = pr.toLowerCase();
      }
      insertToTable(tableInfo, newEntry)
        .then(() => {
          logger.info(
            `Added new p2 entry for imageTag ${imageTag} - no matching entry was found.`
          );
          resolve(newEntry);
        })
        .catch(err => {
          logger.error(err);
        });
      return;
    });
  });
};

/**
 * Updates the HLD to manifest pipeline in storage by finding its corresponding SRC to ACR and ACR to HLD pipelines
 * Depending on whether PR is specified or not, it performs a lookup on commit Id and PR to link it to the previous release.
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a filter to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const updateHLDToManifestPipeline = async (
  tableInfo: IDeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string
): Promise<any> => {
  const entries = await findMatchingDeployments(
    tableInfo,
    "hldCommitId",
    hldCommitId
  );
  if ((!entries || entries.length === 0) && pr) {
    const entriesArray = await findMatchingDeployments(tableInfo, "pr", pr);
    return updateHLDtoManifestHelper(
      entriesArray,
      tableInfo,
      hldCommitId,
      pipelineId,
      manifestCommitId,
      pr
    );
  }
  return updateHLDtoManifestHelper(
    entries,
    tableInfo,
    hldCommitId,
    pipelineId,
    manifestCommitId,
    pr
  );
};

/**
 * Updates HLD to Manifest pipeline in storage by going through entries that could be a possible match in the storage.
 * @param entries list of entries that this build could be linked to
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a filter to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const updateHLDtoManifestHelper = (
  entries: any,
  tableInfo: IDeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string
): Promise<any> => {
  return new Promise(resolve => {
    let entryToInsert: any;
    for (const entry of entries) {
      entryToInsert = entry;
      if (
        (entry.p3 ? entry.p3._ === pipelineId : true) &&
        (entry.manifestCommitId
          ? entry.manifestCommitId._ === manifestCommitId
          : true)
      ) {
        entry.p3 = pipelineId.toLowerCase();
        if (manifestCommitId) {
          entry.manifestCommitId = manifestCommitId.toLowerCase();
        }
        updateEntryInTable(tableInfo, entry)
          .then(() => {
            logger.info(
              "Updated third pipeline details for its corresponding pipeline"
            );
            resolve(entry);
          })
          .catch(err => {
            logger.error(err);
          });
        return;
      }
    }
    if (entryToInsert) {
      entryToInsert.p3 = pipelineId.toLowerCase();
      if (manifestCommitId) {
        entryToInsert.manifestCommitId = manifestCommitId.toLowerCase();
      }
      if (pr) {
        entryToInsert.pr = pr.toLowerCase();
      }
      entryToInsert.hldCommitId = hldCommitId.toLowerCase();
      entryToInsert.RowKey = getRowKey();
      insertToTable(tableInfo, entryToInsert)
        .then(() => {
          logger.info(
            `Added new p3 entry for hldCommitId ${hldCommitId} by finding a similar entry`
          );
          resolve(entryToInsert);
        })
        .catch(err => {
          logger.error(err);
        });
      return;
    }

    const newEntry: any = {};
    newEntry.PartitionKey = tableInfo.partitionKey;
    newEntry.RowKey = getRowKey();
    newEntry.p3 = pipelineId.toLowerCase();
    newEntry.hldCommitId = hldCommitId.toLowerCase();
    if (manifestCommitId) {
      newEntry.manifestCommitId = manifestCommitId.toLowerCase();
    }
    if (pr) {
      newEntry.pr = pr.toLowerCase();
    }
    insertToTable(tableInfo, newEntry)
      .then(() => {
        logger.info(
          `Added new p3 entry for hldCommitId ${hldCommitId} - no matching entry was found.`
        );
        resolve(newEntry);
      })
      .catch(err => {
        logger.error(err);
      });
    return;
  });
};

/**
 * Updates manifest commit identifier in the storage for a pipeline identifier in HLD to manifest pipeline
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param pipelineId identifier of the HLD to manifest pipeline, used as a filter to find the deployment
 * @param manifestCommitId manifest commit identifier to be updated
 */
export const updateManifestCommitId = (
  tableInfo: IDeploymentTable,
  pipelineId: string,
  manifestCommitId: string
): Promise<any> => {
  return new Promise(resolve => {
    findMatchingDeployments(tableInfo, "p3", pipelineId).then(entries => {
      // Ideally there should only be one entry for every pipeline id
      if (entries.length > 0) {
        const entry = entries[0];
        entry.manifestCommitId = manifestCommitId;
        updateEntryInTable(tableInfo, entry)
          .then(() => {
            logger.info(
              `Update manifest commit Id ${manifestCommitId} for pipeline Id ${pipelineId}`
            );
            resolve(entry);
          })
          .catch(err => {
            logger.error(err);
          });
      } else {
        logger.error(
          `No manifest generation found to update manifest commit ${manifestCommitId}`
        );
      }
    });
  });
};

/**
 * Finds matching deployments for a filter name and filter value in the storage
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param filterName name of the filter, such as `imageTag`
 * @param filterValue value of the filter, such as `hello-spk-master-1234`
 */
export const findMatchingDeployments = (
  tableInfo: IDeploymentTable,
  filterName: string,
  filterValue: string
): Promise<any> => {
  const tableService = azure.createTableService(
    tableInfo.accountName,
    tableInfo.accountKey
  );
  const query: azure.TableQuery = new azure.TableQuery().where(
    "PartitionKey eq '" + tableInfo.partitionKey + "'"
  );
  query.and(filterName + " eq '" + filterValue + "'");

  // To get around issue https://github.com/Azure/azure-storage-node/issues/545, set below to null
  const nextContinuationToken: azure.TableService.TableContinuationToken = null as any;

  return new Promise((resolve, reject) => {
    tableService.queryEntities(
      tableInfo.tableName,
      query,
      nextContinuationToken,
      (error, result) => {
        if (!error) {
          resolve(result.entries);
        } else {
          reject(error);
        }
      }
    );
  });
};

/**
 * Inserts a new entry into the table
 * @param accountName Name of the storage account
 * @param accountKey Access key to the storage account
 * @param tableName Table name for the deployments table in storage account
 * @param entry The new entry to be inserted into the table
 * @param callback Callback handler for the post insert function
 */
export const insertToTable = (
  tableInfo: IDeploymentTable,
  entry: any
): Promise<any> => {
  const tableService = azure.createTableService(
    tableInfo.accountName,
    tableInfo.accountKey
  );
  return new Promise((resolve, reject) => {
    tableService.insertEntity(
      tableInfo.tableName,
      entry,
      (err, result, response) => {
        if (!err) {
          resolve(entry);
        } else {
          reject(err);
        }
      }
    );
  });
};

export const deleteFromTable = (
  tableInfo: IDeploymentTable,
  entry: any
): Promise<any> => {
  const tableService = azure.createTableService(
    tableInfo.accountName,
    tableInfo.accountKey
  );

  return new Promise((resolve, reject) => {
    tableService.deleteEntity(tableInfo.tableName, entry, {}, (err, result) => {
      if (!err) {
        resolve(entry);
      } else {
        reject(err);
      }
    });
  });
};

/**
 * Updates an entry in the table
 * @param accountName Name of the storage account
 * @param accountKey Access key to the storage account
 * @param tableName Table name for the deployments table in storage account
 * @param entry The new entry to be updated in the table
 * @param callback Callback handler for the post update function
 */
export const updateEntryInTable = (
  tableInfo: IDeploymentTable,
  entry: any
): Promise<any> => {
  const tableService = azure.createTableService(
    tableInfo.accountName,
    tableInfo.accountKey
  );
  return new Promise((resolve, reject) => {
    tableService.replaceEntity(
      tableInfo.tableName,
      entry,
      (err, result, response) => {
        if (!err) {
          resolve(entry);
        } else {
          reject(err);
        }
      }
    );
  });
};

/**
 * Generates a RowKey GUID 12 characters long
 */
export const getRowKey = (): string => {
  return uuid()
    .replace("-", "")
    .substring(0, 12);
};
