import {
  disableVerboseLogging,
  enableVerboseLogging,
  logger
} from "../../logger";
import * as update from "./deploymenttable";

const mockedDB: any[] = [];
const mockTableInfo: update.IDeploymentTable = {
  accountKey: "test",
  accountName: "test",
  partitionKey: "test",
  tableName: "test"
};
jest.spyOn(update, "findMatchingDeployments").mockImplementation(
  (
    tableInfo: update.IDeploymentTable,
    filterName: string,
    filterValue: string
  ): Promise<any> => {
    const array: any[] = [];
    return new Promise(resolve => {
      mockedDB.forEach((row: any) => {
        if (filterName in row && row[filterName] === filterValue) {
          logger.debug(
            `Found matching mock entry ${JSON.stringify(row, null, 4)}`
          );
          array.push(row);
        }
      });
      resolve(array);
    });
  }
);

jest.spyOn(update, "insertToTable").mockImplementation(
  (tableInfo: update.IDeploymentTable, entry: any): Promise<any> => {
    return new Promise(resolve => {
      logger.debug(`Inserting to table ${JSON.stringify(entry, null, 4)}`);
      mockedDB.push(entry);
      resolve(entry);
    });
  }
);
jest.spyOn(update, "updateEntryInTable").mockImplementation(
  (tableInfo: update.IDeploymentTable, entry: any): Promise<any> => {
    logger.debug(`Updating existing entry ${JSON.stringify(entry, null, 4)}`);
    return new Promise(resolve => {
      mockedDB.forEach((row: any, index: number) => {
        if (row.RowKey === entry.RowKey) {
          mockedDB[index] = entry;
          resolve(entry);
        }
      }, mockedDB);
    });
  }
);

beforeAll(() => {
  enableVerboseLogging();
});

afterAll(() => {
  disableVerboseLogging();
});

describe("Verify the update deployment commands", () => {
  it("should create a row key, add to storage and update the deployment", async () => {
    // Verify that RowKey is valid
    const rowKey = update.getRowKey();
    expect(rowKey).toHaveLength(12);
    expect(/^[a-z0-9]+$/i.test(rowKey)).toBeTruthy();
    logger.info(
      `Verified that RowKey ${rowKey} is alphanumeric with 12 characters`
    );

    // Verify that adding a deployment works
    expect(mockedDB).toHaveLength(0);
    update
      .addSrcToACRPipeline(
        mockTableInfo,
        "1234",
        "hello-spk-master-1234",
        "test",
        "bbbbbbb"
      )
      .then(someValue1 => {
        expect(mockedDB).toHaveLength(1);
        expect(mockedDB[0].p1).toBe("1234");
        expect(mockedDB[0].imageTag).toBe("hello-spk-master-1234");
        expect(mockedDB[0].service).toBe("test");
        expect(mockedDB[0].commitId).toBe("bbbbbbb");
        logger.info(`Verified that a new deployment was added`);

        // Verify that updating an existing deployment does not add a new element
        update
          .updateACRToHLDPipeline(
            mockTableInfo,
            "567",
            "hello-spk-master-1234",
            "aaaaaaa",
            "Dev",
            "405"
          )
          .then(someValue2 => {
            expect(mockedDB).toHaveLength(1);
            logger.info(
              `mockedDB[0] = ${JSON.stringify(mockedDB[0], null, 4)}`
            );
            expect(mockedDB[0].p2).toBe("567");
            expect(mockedDB[0].env).toBe("dev");
            expect(mockedDB[0].p1).toBe("1234");
            expect(mockedDB[0].hldCommitId).toBe("aaaaaaa");
            expect(mockedDB[0].pr).toBe("405");
            logger.info(`Verified that a deployment was updated`);

            // Verify that updating an existing deployment that has no match, does add a new element
            update
              .updateACRToHLDPipeline(
                mockTableInfo,
                "568",
                "hello-spk-master-1234",
                "aaaaaaab",
                "Dev",
                "405"
              )
              .then(someValue3 => {
                expect(mockedDB).toHaveLength(2);
                expect(mockedDB[1].p1).toBe("1234");
                expect(mockedDB[1].p2).toBe("568");
                expect(mockedDB[1].env).toBe("dev");
                expect(mockedDB[1].pr).toBe("405");
                logger.info(
                  `Verified that updating a deployment that does not match, adds a new element`
                );

                // Verify third pipeline can be added
                update
                  .updateHLDToManifestPipeline(
                    mockTableInfo,
                    "aaaaaaab",
                    "900",
                    "manifest",
                    "405"
                  )
                  .then(someValue4 => {
                    expect(mockedDB).toHaveLength(2);
                    expect(mockedDB[1].p3).toBe("900");
                    expect(mockedDB[1].manifestCommitId).toBe("manifest");
                    expect(mockedDB[1].pr).toBe("405");

                    // Verify manifest commit can be updated
                    update
                      .updateManifestCommitId(mockTableInfo, "900", "manifest1")
                      .then(someValue5 => {
                        expect(mockedDB).toHaveLength(2);
                        expect(mockedDB[1].p3).toBe("900");
                        expect(mockedDB[1].manifestCommitId).toBe("manifest1");

                        update
                          .updateACRToHLDPipeline(
                            mockTableInfo,
                            "568",
                            "hello-spk-master-1234",
                            "aaaaaaab",
                            "Staging"
                          )
                          .then(someValue6 => {
                            expect(mockedDB).toHaveLength(3);
                            expect(mockedDB[2].p1).toBe("1234");
                            expect(mockedDB[2].p2).toBe("568");
                            expect(mockedDB[2].env).toBe("staging");
                            expect(mockedDB[2].p3).toBeUndefined();
                            expect(
                              mockedDB[2].manifestCommitId
                            ).toBeUndefined();
                            logger.info(
                              `Verified that creating a release out of an existing deployment does not duplicate entries`
                            );

                            update
                              .updateHLDToManifestPipeline(
                                mockTableInfo,
                                "newcommit",
                                "901",
                                "unitest"
                              )
                              .then(someValue7 => {
                                expect(mockedDB).toHaveLength(4);
                                expect(mockedDB[3].p1).toBeUndefined();
                                expect(mockedDB[3].p2).toBeUndefined();
                                expect(mockedDB[3].p3).toBe("901");
                                expect(mockedDB[3].manifestCommitId).toBe(
                                  "unitest"
                                );
                              });
                            logger.info(
                              `Verified that committing directly into HLD creates a new entry in storage and does not link p1 and p2`
                            );
                          });
                      });
                  });
              });
          });
      });
  });
});
