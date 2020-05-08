import * as azure from "azure-storage";
import uuid from "uuid/v4";
import { logger } from "../../logger";
import { build as buildError } from "../errorBuilder";
import { errorStatusCode } from "../errorStatusCode";
import { OUTPUT_FORMAT } from "../../commands/deployment/get";
import Table from "cli-table";

/**
 * Deployment Table interface to hold necessary information about a table for deployments
 */
export interface DeploymentTable {
  accountName: string;
  accountKey: string;
  tableName: string;
  partitionKey: string;
}

export interface DeploymentEntry {
  RowKey: string;
  PartitionKey: string;
  commitId?: string;
  env?: string;
  imageTag?: string;
  p1?: string;
  service?: string;
  p2?: string;
  hldCommitId?: string;
  p3?: string;
  manifestCommitId?: string;
  sourceRepo?: string;
  hldRepo?: string;
  manifestRepo?: string;
  pr?: string;
}

export interface DeploymentRow {
  status?: string;
  service?: string;
  env?: string;
  author?: string;
  imageTag?: string;
  srcToAcrPipelineId?: string;
  srcToAcrResult?: string;
  srctoAcrCommitId?: string;
  AcrToHldPipelineId?: string;
  AcrToHldResult?: string;
  AcrToHldCommitId?: string;
  HldToManifestPipelineId?: string;
  HldToManifestResult?: string;
  HldToManifestCommitId?: string;
  pr?: string;
  mergedBy?: string;
  duration?: string;
  startTime?: string;
  syncStatus?: string;
}

export interface TableHeader {
  title?: string;
  alignment?: "left" | "middle" | "right";
}

/**
 * Prints deployment table
 * @param outputFormat output format: json, wide, normal
 * @param deployments list of deployments to print
 * @param removeSeparators Whether to remove separators or not
 */
export const printDeploymentTable = (
  outputFormat: OUTPUT_FORMAT,
  deployments: DeploymentRow[],
  removeSeparators?: boolean,
  clusterSyncAvailable?: boolean
): Table => {
  const tableHeaders: Array<TableHeader> = [
    outputFormat === OUTPUT_FORMAT.WIDE ? { title: "Start Time" } : {},
    { title: "Status" },
    { title: "Service" },
    { title: "Ring" },
    outputFormat === OUTPUT_FORMAT.WIDE ? { title: "Author" } : {},
    { title: "Image Tag" },
    !removeSeparators ? { title: "│" } : {},
    { title: "Image Creation", alignment: "right" },
    { title: "Commit" },
    { title: "OK" },
    !removeSeparators ? { title: "│" } : {},
    { title: "Metadata Update", alignment: "right" },
    { title: "Commit" },
    { title: "OK" },
    !removeSeparators ? { title: "│" } : {},
    outputFormat === OUTPUT_FORMAT.WIDE
      ? { title: "Approval PR", alignment: "right" }
      : {},
    outputFormat === OUTPUT_FORMAT.WIDE ? { title: "Merged By" } : {},
    { title: "Ready to Deploy", alignment: "right" },
    { title: "Commit" },
    { title: "OK" },
    !removeSeparators ? { title: "│" } : {},
    { title: "Duration", alignment: "right" },
    outputFormat === OUTPUT_FORMAT.WIDE && clusterSyncAvailable
      ? { title: "Cluster Sync" }
      : {},
  ];

  const columnAlignment: Array<"left" | "middle" | "right"> = [];
  const headers: string[] = [];
  tableHeaders.forEach((header) => {
    if (header.title) {
      headers.push(header.title);
      columnAlignment.push(header.alignment ? header.alignment : "left");
    }
  });
  const table = new Table({
    head: headers,
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    },
    style: { "padding-left": 0, "padding-right": 0 },
    colAligns: columnAlignment,
  });

  deployments.forEach((deployment: DeploymentRow) => {
    const row = [];
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      row.push(deployment.startTime ?? "");
    }
    row.push(deployment.status ?? "");
    row.push(deployment.service ?? "");
    row.push(deployment.env ?? "");
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      row.push(deployment.author ?? "");
    }
    row.push(deployment.imageTag ?? "");

    if (!removeSeparators) row.push("│");
    row.push(deployment.srcToAcrPipelineId ?? "");
    row.push(deployment.srctoAcrCommitId ?? "");
    row.push(deployment.srcToAcrResult ?? "");

    if (!removeSeparators) row.push("│");
    row.push(deployment.AcrToHldPipelineId ?? "");
    row.push(deployment.AcrToHldCommitId ?? "");
    row.push(deployment.AcrToHldResult ?? "");

    if (!removeSeparators) row.push("│");
    if (outputFormat === OUTPUT_FORMAT.WIDE) {
      row.push(deployment.pr ?? "");
      row.push(deployment.mergedBy ?? "");
    }
    row.push(deployment.HldToManifestPipelineId ?? "");
    row.push(deployment.HldToManifestCommitId ?? "");
    row.push(deployment.HldToManifestResult ?? "");

    if (!removeSeparators) row.push("│");
    row.push(deployment.duration ?? "");

    if (outputFormat === OUTPUT_FORMAT.WIDE && clusterSyncAvailable) {
      row.push(deployment.syncStatus ?? "");
    }

    table.push(row);
  });
  console.log(table.toString());
  return table;
};

/**
 * Generates a RowKey GUID 12 characters long
 */
export const getRowKey = (): string => {
  return uuid().replace("-", "").substring(0, 12);
};

/**
 * Gets the azure table service
 * @param tableInfo tableInfo object containing necessary table info
 */
export const getTableService = (
  tableInfo: DeploymentTable
): azure.TableService => {
  return azure.createTableService(tableInfo.accountName, tableInfo.accountKey);
};

/**
 * Finds matching deployments for a filter name and filter value in the storage
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param filterName name of the filter, such as `imageTag`
 * @param filterValue value of the filter, such as `v1.04`
 */
export const findMatchingDeployments = (
  tableInfo: DeploymentTable,
  filterName: string,
  filterValue: string
): Promise<DeploymentEntry[]> => {
  const tableService = getTableService(tableInfo);
  const query: azure.TableQuery = new azure.TableQuery().where(
    `PartitionKey eq '${tableInfo.partitionKey}'`
  );
  query.and(`${filterName} eq '${filterValue}'`);

  // To get around issue https://github.com/Azure/azure-storage-node/issues/545, set below to null
  const nextContinuationToken:
    | azure.TableService.TableContinuationToken
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | any = null;

  return new Promise((resolve, reject) => {
    tableService.queryEntities<DeploymentEntry>(
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
 * Inserts a new entry into the table.
 *
 * @param tableInfo Table Information
 * @param entry entry to insert
 */
export const insertToTable = (
  tableInfo: DeploymentTable,
  entry: DeploymentEntry
): Promise<void> => {
  const tableService = getTableService(tableInfo);

  return new Promise((resolve, reject) => {
    tableService.insertEntity(tableInfo.tableName, entry, (err) => {
      if (!err) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
};

/**
 * Deletes self test data from table
 * @param tableInfo table info object
 * @param entry entry to be deleted
 */
export const deleteFromTable = (
  tableInfo: DeploymentTable,
  entry: DeploymentEntry
): Promise<void> => {
  const tableService = getTableService(tableInfo);

  return new Promise((resolve, reject) => {
    tableService.deleteEntity(tableInfo.tableName, entry, {}, (err) => {
      if (!err) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
};

/**
 * Updates an entry in the table.
 *
 * @param tableInfo Table Information
 * @param entry entry to update
 */
export const updateEntryInTable = (
  tableInfo: DeploymentTable,
  entry: DeploymentEntry
): Promise<void> => {
  const tableService = getTableService(tableInfo);

  return new Promise((resolve, reject) => {
    tableService.replaceEntity(tableInfo.tableName, entry, (err) => {
      if (!err) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
};

/**
 * Adds a new deployment in storage for SRC to ACR pipeline.
 *
 * @param tableInfo table info interface containing information about the storage for deployments
 * @param pipelineId Identifier of the first pipeline
 * @param imageTag image tag name
 * @param serviceName service name
 * @param commitId commit identifier
 */
export const addSrcToACRPipeline = async (
  tableInfo: DeploymentTable,
  pipelineId: string,
  imageTag: string,
  serviceName: string,
  commitId: string,
  repository?: string
): Promise<DeploymentEntry> => {
  try {
    const entry: DeploymentEntry = {
      PartitionKey: tableInfo.partitionKey,
      RowKey: getRowKey(),
      commitId,
      imageTag,
      p1: pipelineId,
      service: serviceName,
    };
    if (repository) {
      entry.sourceRepo = repository.toLowerCase();
    }
    await insertToTable(tableInfo, entry);
    logger.info("Added first pipeline details to the database");
    return entry;
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      "deployment-table-add-src-to-acr-pipeline",
      err
    );
  }
};

/**
 * Updates an existing SRC -> ACR entry with its corresponding ACR -> HLD entry
 * @param entries list of entries found
 * @param tableInfo table info object
 * @param pipelineId Id of the ACR -> HLD pipeline
 * @param imageTag image tag name
 * @param hldCommitId HLD commit Id
 * @param env environment name
 * @param pr Pull request Id (if available)
 */
export const updateMatchingACRToHLDPipelineEntry = async (
  entries: DeploymentEntry[],
  tableInfo: DeploymentTable,
  pipelineId: string,
  imageTag: string,
  hldCommitId: string,
  env: string,
  pr?: string,
  repository?: string
): Promise<DeploymentEntry | null> => {
  const found = (entries || []).find((entry: DeploymentEntry) => {
    return (
      (entry.p2 ? entry.p2 === pipelineId : true) &&
      (entry.hldCommitId ? entry.hldCommitId === hldCommitId : true) &&
      (entry.env ? entry.env === env : true)
    );
  });

  if (found) {
    const updateEntry: DeploymentEntry = {
      PartitionKey: found.PartitionKey,
      RowKey: found.RowKey,
      commitId: found.commitId,
      env: env.toLowerCase(),
      hldCommitId: hldCommitId.toLowerCase(),
      imageTag: found.imageTag,
      p1: found.p1,
      p2: pipelineId.toLowerCase(),
      service: found.service,
      sourceRepo: found.sourceRepo,
    };
    if (pr) {
      updateEntry.pr = pr.toLowerCase();
    }
    if (repository) {
      updateEntry.hldRepo = repository.toLowerCase();
    }
    await updateEntryInTable(tableInfo, updateEntry);
    logger.info(
      `Updated p2 entry for imageTag ${imageTag} by finding corresponding entry`
    );
    return updateEntry;
  }
  return null;
};

/**
 * Adds a new entry for ACR -> HLD pipeline when no corresponding SRC -> ACR pipeline was found
 * to be associated
 * This should only be used in error scenarios or when the corresponding SRC -> ACR build is
 * deleted from storage
 * @param tableInfo table info object
 * @param pipelineId Id of the ACR -> HLD pipeline
 * @param imageTag image tag name
 * @param hldCommitId HLD commit Id
 * @param env environment name
 * @param pr Pull request Id (if available)
 */
export const addNewRowToACRToHLDPipelines = async (
  tableInfo: DeploymentTable,
  pipelineId: string,
  imageTag: string,
  hldCommitId: string,
  env: string,
  pr?: string,
  repository?: string,
  similarEntry?: DeploymentEntry
): Promise<DeploymentEntry> => {
  const newEntry: DeploymentEntry = {
    PartitionKey: tableInfo.partitionKey,
    RowKey: getRowKey(),
    commitId: similarEntry?.commitId ? similarEntry.commitId : "",
    env: env.toLowerCase(),
    hldCommitId: hldCommitId.toLowerCase(),
    imageTag: imageTag.toLowerCase(),
    p1: similarEntry?.p1 ? similarEntry.p1 : "",
    p2: pipelineId.toLowerCase(),
    service: similarEntry?.service ? similarEntry.service : "",
    sourceRepo: similarEntry?.sourceRepo ? similarEntry.sourceRepo : "",
  };
  if (pr) {
    newEntry.pr = pr.toLowerCase();
  }
  if (repository) {
    newEntry.hldRepo = repository.toLowerCase();
  }
  await insertToTable(tableInfo, newEntry);
  logger.info(
    `Added new p2 entry for imageTag ${imageTag} - ${
      similarEntry
        ? "by finding a similar entry"
        : "no matching entry was found."
    }`
  );
  return newEntry;
};

/**
 * Updates the ACR to HLD pipeline in the storage by finding its corresponding SRC to ACR pipeline
 * @param tableInfo table info interface containing information about the storage for deployments
 * @param pipelineId identifier for the ACR to HLD pipeline
 * @param imageTag image tag name
 * @param hldCommitId commit identifier into HLD
 * @param env environment name, such as Dev, Staging etc.
 */
export const updateACRToHLDPipeline = async (
  tableInfo: DeploymentTable,
  pipelineId: string,
  imageTag: string,
  hldCommitId: string,
  env: string,
  pr?: string,
  repository?: string
): Promise<DeploymentEntry> => {
  try {
    const entries = await findMatchingDeployments(
      tableInfo,
      "imageTag",
      imageTag
    );

    if (entries && entries.length > 0) {
      // If there is a corresponding src -> acr pipeline, update it
      const found = await updateMatchingACRToHLDPipelineEntry(
        entries,
        tableInfo,
        pipelineId,
        imageTag,
        hldCommitId,
        env,
        pr,
        repository
      );

      if (found) {
        return found;
      }

      // If there's no src -> acr but a matching image tag and/or multiple p1 pipelines for this,
      // copy one of them and amend info to create a new instance of deployment
      return await addNewRowToACRToHLDPipelines(
        tableInfo,
        pipelineId,
        imageTag,
        hldCommitId,
        env,
        pr,
        repository,
        entries[entries.length - 1]
      );
    }

    // If a corresponding src -> acr is not found, insert a new entry
    return await addNewRowToACRToHLDPipelines(
      tableInfo,
      pipelineId,
      imageTag,
      hldCommitId,
      env,
      pr,
      repository
    );
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      "deployment-table-add-acr-to-hld-pipeline",
      err
    );
  }
};

/**
 * Updates HLD -> Manifest build for its corresponding ACR -> HLD release
 * @param entries list of matching entries based on PR / hld commit
 * @param tableInfo table info interface containing information about
 *        the deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a
 *        filter to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const updateHLDtoManifestEntry = async (
  entries: DeploymentEntry[],
  tableInfo: DeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string,
  repository?: string
): Promise<DeploymentEntry | null> => {
  const found = entries.find(
    (entry: DeploymentEntry) =>
      (entry.p3 ? entry.p3 === pipelineId : true) &&
      (entry.manifestCommitId
        ? entry.manifestCommitId === manifestCommitId
        : true)
  );

  if (found) {
    const entry: DeploymentEntry = {
      PartitionKey: found.PartitionKey,
      RowKey: found.RowKey,
      commitId: found.commitId,
      env: found.env,
      hldCommitId,
      hldRepo: found.hldRepo,
      imageTag: found.imageTag,
      p1: found.p1,
      p2: found.p2,
      p3: pipelineId.toLowerCase(),
      service: found.service,
      sourceRepo: found.sourceRepo,
    };
    if (manifestCommitId) {
      entry.manifestCommitId = manifestCommitId.toLowerCase();
    }
    if (pr) {
      entry.pr = pr;
    }
    if (repository) {
      entry.manifestRepo = repository.toLowerCase();
    }
    await updateEntryInTable(tableInfo, entry);
    logger.info(
      "Updated third pipeline details for its corresponding pipeline"
    );
    return entry;
  }
  return null;
};

/**
 * Adds a new row to the table when the HLD -> Manifest pipeline is triggered by
 * manually committing into the HLD
 * @param tableInfo table info interface containing information about
 *        the deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a
 *        filter to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const addNewRowToHLDtoManifestPipeline = async (
  tableInfo: DeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string,
  repository?: string,
  similarEntry?: DeploymentEntry
): Promise<DeploymentEntry> => {
  const newEntry: DeploymentEntry = {
    PartitionKey: tableInfo.partitionKey,
    RowKey: getRowKey(),
    commitId: similarEntry?.commitId ? similarEntry.commitId : "",
    env: similarEntry?.env ? similarEntry.env : "",
    hldCommitId: hldCommitId.toLowerCase(),
    hldRepo: similarEntry?.hldRepo ? similarEntry.hldRepo : "",
    imageTag: similarEntry?.imageTag ? similarEntry.imageTag : "",
    p1: similarEntry?.p1 ? similarEntry.p1 : "",
    p2: similarEntry?.p2 ? similarEntry.p2 : "",
    p3: pipelineId.toLowerCase(),
    service: similarEntry?.service ? similarEntry.service : "",
    sourceRepo: similarEntry?.sourceRepo ? similarEntry.sourceRepo : "",
  };
  if (manifestCommitId) {
    newEntry.manifestCommitId = manifestCommitId.toLowerCase();
  }
  if (pr) {
    newEntry.pr = pr.toLowerCase();
  }
  if (repository) {
    newEntry.manifestRepo = repository.toLowerCase();
  }
  await insertToTable(tableInfo, newEntry);
  logger.info(
    `Added new p3 entry for hldCommitId ${hldCommitId} - ${
      similarEntry
        ? "by finding a similar entry"
        : "no matching entry was found."
    }`
  );
  return newEntry;
};

/**
 * Updates HLD to Manifest pipeline in storage by going through entries that could
 * be a possible match in the storage.
 *
 * @param entries list of entries that this build could be linked to
 * @param tableInfo table info interface containing information about the
 *        deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a filter
 *        to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const updateHLDtoManifestHelper = async (
  entries: DeploymentEntry[],
  tableInfo: DeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string,
  repository?: string
): Promise<DeploymentEntry> => {
  if (entries && entries.length > 0) {
    // If a src -> acr and acr -> hld pipeline is found for this run, update it
    const updated = await updateHLDtoManifestEntry(
      entries,
      tableInfo,
      hldCommitId,
      pipelineId,
      manifestCommitId,
      pr,
      repository
    );

    if (updated) {
      return updated;
    }

    // If there are multiple acr -> hld pipelines or some information is missing,
    // copy one of them and amend info to create a new instance of deployment
    return await addNewRowToHLDtoManifestPipeline(
      tableInfo,
      hldCommitId,
      pipelineId,
      manifestCommitId,
      pr,
      repository,
      entries[entries.length - 1]
    );
  }

  // When no matching entry exists in storage for this hld -> manifest pipeline, it must be
  // a manual change merged into HLD. Add new entry to storage.
  return await addNewRowToHLDtoManifestPipeline(
    tableInfo,
    hldCommitId,
    pipelineId,
    manifestCommitId,
    pr,
    repository
  );
};

/**
 * Updates the HLD to manifest pipeline in storage by finding its
 * corresponding SRC to ACR and ACR to HLD pipelines
 * Depending on whether PR is specified or not, it performs a lookup
 * on commit Id and PR to link it to the previous release.
 *
 * @param tableInfo table info interface containing information about
 *        the deployment storage table
 * @param hldCommitId commit identifier into the HLD repo, used as a
 *        filter to find corresponding deployments
 * @param pipelineId identifier of the HLD to manifest pipeline
 * @param manifestCommitId manifest commit identifier
 * @param pr pull request identifier
 */
export const updateHLDToManifestPipeline = async (
  tableInfo: DeploymentTable,
  hldCommitId: string,
  pipelineId: string,
  manifestCommitId?: string,
  pr?: string,
  repository?: string
): Promise<DeploymentEntry> => {
  try {
    let entries = await findMatchingDeployments(
      tableInfo,
      "hldCommitId",
      hldCommitId
    );

    // cannot find entries by hldCommitId.
    // attempt to find entries by pr
    if ((!entries || entries.length === 0) && pr) {
      entries = await findMatchingDeployments(tableInfo, "pr", pr);
    }
    return updateHLDtoManifestHelper(
      entries,
      tableInfo,
      hldCommitId,
      pipelineId,
      manifestCommitId,
      pr,
      repository
    );
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      "deployment-table-update-hld-manifest-pipeline-failed",
      err
    );
  }
};

/**
 * Updates manifest commit identifier in the storage for a pipeline identifier in HLD to manifest pipeline
 * @param tableInfo table info interface containing information about the deployment storage table
 * @param pipelineId identifier of the HLD to manifest pipeline, used as a filter to find the deployment
 * @param manifestCommitId manifest commit identifier to be updated
 */
export const updateManifestCommitId = async (
  tableInfo: DeploymentTable,
  pipelineId: string,
  manifestCommitId: string,
  repository?: string
): Promise<DeploymentEntry> => {
  try {
    const entries = await findMatchingDeployments(tableInfo, "p3", pipelineId);
    // Ideally there should only be one entry for every pipeline id
    if (entries.length > 0) {
      const entry = entries[0];
      entry.manifestCommitId = manifestCommitId;
      if (repository) {
        entry.manifestRepo = repository.toLowerCase();
      }
      await updateEntryInTable(tableInfo, entry);
      logger.info(
        `Update manifest commit Id ${manifestCommitId} for pipeline Id ${pipelineId}`
      );
      return entry;
    }
  } catch (err) {
    throw buildError(
      errorStatusCode.AZURE_STORAGE_OP_ERR,
      "deployment-table-update-manifest-commit-id-failed",
      err
    );
  }
  throw buildError(errorStatusCode.AZURE_STORAGE_OP_ERR, {
    errorKey: "deployment-table-update-manifest-commit-id-failed-no-generation",
    values: [manifestCommitId],
  });
};
