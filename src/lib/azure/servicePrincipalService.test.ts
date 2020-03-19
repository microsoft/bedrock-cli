import * as shell from "../shell";
import { azCLILogin, createWithAzCLI } from "./servicePrincipalService";
import * as servicePrincipalService from "./servicePrincipalService";

describe("test azCLILogin function", () => {
  it("positive test", async () => {
    jest.spyOn(shell, "exec").mockReturnValueOnce(Promise.resolve(""));
    await azCLILogin();
  });
  it("negative test", async () => {
    jest
      .spyOn(shell, "exec")
      .mockReturnValueOnce(Promise.reject(new Error("fake")));
    await expect(azCLILogin()).rejects.toThrow();
  });
});

describe("test createWithAzCLI function", () => {
  it("positive test", async () => {
    const result = {
      appId: "b510c1ff-358c-4ed4-96c8-eb23f42bb65b",
      password: "a510c1ff-358c-4ed4-96c8-eb23f42bbc5b",
      tenant: "72f988bf-86f1-41af-91ab-2d7cd011db47"
    };
    jest
      .spyOn(servicePrincipalService, "azCLILogin")
      .mockReturnValueOnce(Promise.resolve());
    jest
      .spyOn(shell, "exec")
      .mockReturnValueOnce(Promise.resolve(JSON.stringify(result)));
    const sp = await createWithAzCLI();
    expect(sp.id).toBe(result.appId);
    expect(sp.password).toBe(result.password);
    expect(sp.tenantId).toBe(result.tenant);
  });
  it("negative test", async () => {
    jest.spyOn(servicePrincipalService, "azCLILogin").mockResolvedValueOnce();
    jest.spyOn(shell, "exec").mockRejectedValueOnce(Error("fake"));
    await expect(createWithAzCLI()).rejects.toThrow();
  });
});
