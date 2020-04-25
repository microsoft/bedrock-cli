import { getSourceFolderNameFromURL } from "./infra_common";

describe("test getSourceFolderNameFromURL function", () => {
  it("positive test with http .com domain", () => {
    const result = getSourceFolderNameFromURL(
      "http://github.com/contoso/fabrikam"
    );
    expect(result).toBe("_contoso_fabrikam");
  });
  it("positive test with http .net domain", () => {
    const result = getSourceFolderNameFromURL(
      "http://github.net/contoso/fabrikam"
    );
    expect(result).toBe("_contoso_fabrikam");
  });
  it("positive test with ssh", () => {
    const result = getSourceFolderNameFromURL(
      "git@github.com:microsoft/contoso.git"
    );
    expect(result).toBe("_microsoft_contoso_git");
  });
  it("positive test with any string", () => {
    const result = getSourceFolderNameFromURL("microsoft/contoso.git");
    expect(result).toBe("microsoft_contoso_git");
  });
  it("positive test with empty string", () => {
    const result = getSourceFolderNameFromURL(""); // this will not happen in real world.
    expect(result).toBe("");
  });
});
