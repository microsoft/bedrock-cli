import { getSourceFolderNameFromURL } from "./infra_common";

describe("test getSourceFolderNameFromURL function", () => {
  it("positive test with http .com domain", () => {
    const result = getSourceFolderNameFromURL("http://github.com/bedrock/SPK");
    expect(result).toBe("_bedrock_spk");
  });
  it("positive test with http .net domain", () => {
    const result = getSourceFolderNameFromURL("http://github.net/bedrock/SPK");
    expect(result).toBe("_bedrock_spk");
  });
  it("positive test with ssh", () => {
    const result = getSourceFolderNameFromURL(
      "git@github.com:microsoft/bedrock.git"
    );
    expect(result).toBe("_microsoft_bedrock_git");
  });
  it("positive test with any string", () => {
    const result = getSourceFolderNameFromURL("microsoft/bedrock.git");
    expect(result).toBe("microsoft_bedrock_git");
  });
  it("positive test with empty string", () => {
    const result = getSourceFolderNameFromURL(""); // this will not happen in real world.
    expect(result).toBe("");
  });
});
