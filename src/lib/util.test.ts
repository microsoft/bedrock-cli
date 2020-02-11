import { deepClone } from "./util";

describe("test deepClone function", () => {
  it("positive test", () => {
    const obj = {
      arrObjects: [
        {
          prop1: "prop1",
          prop2: "prop2"
        }
      ],
      arrString: ["item1", "item2"],
      attr: "hello",
      o: {
        hello: "world"
      }
    };
    expect(deepClone(obj)).toStrictEqual(obj);
  });
});
