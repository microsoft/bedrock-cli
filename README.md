# SPK

> This missing Bedrock CLI

## Getting Started

### System Prerequisites

- Node - >= LTS
- [Yarn](https://yarnpkg.com/) - Stable

### Installation

```sh
yarn install
```

### Running Tests

To run a one-time test of all tests:

```sh
yarn test
```

**Recommended**: To keep tests running in the background and constantly test
newly created tests and code:

```sh
yarn test-watch
```

### Production Builds

We use two tools for creating distributable production builds:

- [webpack](https://webpack.js.org/) - For compiling TypeScript code to a single
  minified JS bundle.
- [pkg](https://github.com/zeit/pkg) - For packaging the output of webpack to 3
  standalone binaries targeting `win32`, `macos`, and `linux`. These binaries
  contain their own self contained versions of Node and can be distributed as
  standalone executables which can be run even if he host does not have Node
  installed.

To run do a production build, just run:

```sh
yarn build
```

## Testing

We use a [TypeScript variant](https://github.com/kulshekhar/ts-jest) of
[Jest](https://jestjs.io/) for testing. To create a test, create a file anywhere
in the project with name `<insert-filename-of-file-testing>.test.ts`; Jest will
automatically do a glob search for files matching `/.+\.test\.tsx?/ig` and run
the tests contained in them.

By convention, we will store the test file in the same directory as the file its
testing. When/if this becomes too burdensome, we can move them to a tests
directory.

## Code Style Guide

### Avoid classes and concretions; don't complect the codebase with state

Prefer the usage of vanilla JS maps which implement
[TypeScript interfaces](https://www.typescriptlang.org/docs/handbook/interfaces.html).
State is one of the hardest things to deal with in a concurrent system (which JS
is by nature with the event-loop) and concrete classes are one of the easiest
first steps to making your system rigid and not async friendly.

For example:

```typescript
interface IAnimal {
  says: () => string;
  leg: number;
}

// Don't do
class Sheep implements IAnimal {
  public says = () => "bahhh";
  public legs = 4;

  constructor({ says, legs }: IAnimal) {
    this.says = says;
    this.legs = legs;
  }
}

// Do
const Sheep = ({ says, legs }: IAnimal) => {
  return {
    says: () => "bahhh",
    legs: 4,
    says,
    legs
  };
};
```

Along with being more composable, this also enables us to easily keep a more
immutable codebase as we can now more easily pass copies of `IAnimal` around via
the the `...` (spread) operator.

### Try to be pure

Write pure function whenever possible. Objects and Arrays are passed as pointers
in JS, if a function takes in an object or an array with and wants to modify it,
de-structure it and modify the new copy and return that copy. This will allow
you to be more confident that async code is able to still evaluate the same data
that you initially passed it even if the event loop caused your code to run out
of order.

```typescript
interface IHuman {
  name: string;
  age: number;
}

// Don't do
// Objects and arrays are passed as pointers.
const jack = { name: "Jack", age: "20" };
const incrementAge = (human: IHuman): IHuman => {
  human.age = age + 1;
  return human;
};
const agedJack = incrementAge(jack);
// NOTE: both agedJack AND jack are now age 21 as you modified the literal
// object passed to the function

// Do
const jack = { name: "Jack", age: "20" };
const incrementAge = (human: IHuman): IHuman => {
  // We use use the `...` (pronounced "spread") operator to make copies of all
  // the values in `human` and place them in agedHuman. We then overwrite the
  // value of `age` with the new value.
  const agedHuman = { ...human, age: human.age + 1 };
  return agedHuman;
};
const agedJack = incrementAge(jack);
// jack remains 20 and agedJack is 21
```

### Treat files like namespaces

One of the best features of `es2016` was the `import`/`export` specification
which allows for better control of what is importable to files from other files.
Use this as a method of encapsulation, instead of relying on classes to
hide/expose functionality, treat the file as a class and use `export` as means
to declare something _`public`_.

```typescript
// Don't do
export class MyClass {
  public static foo(): string {
    return "bar";
  }
}

// Do
export const foo = (): string => {
  return "bar";
};
```

### Use arrow functions

The `es2015` spec introduced arrow functions to JavaScript, these greatly reduce
the previously confusing usage of `this` in JavaScript as the arrow functions
bind `this` the where the function gets initialized. Along with this, they are
just cleaner and easier to debug in general.

```typescript
// Don't do
function foo(bar: number): string {
  return bar.toString();
}

// Don't do
const foo = function(bar: number): string {
  return bar.toString();
};

// Do
const foo = (bar: number): string => {
  return bar.toString();
};
```

### Don't use callbacks

Although `Promise` and `async`/`await` are now pretty standard across modern
browsers and is supported in Node LTS, many libraries (including those in the
node standard library) use callbacks. These functions are a one-way ticket to
[Callback Hell](http://callbackhell.com/), and should avoided at all costs. If
you need to use a node function that has a callback, node includes a util
function call `promisify` which will turn the callback into a returned promise:

```typescript
import { promisify } from "util";
import { readFile } from "fs";

// normally readFile requires a callback
readFile("/etc/passwd", (err, data) => {
  if (err) throw err;
  console.log(data);
});

// But we can turn that function into something promise based
const promiseBasedReadFile = promisify(readFile);

// Full promise based
promiseBasedReadFile("/etc/passwd")
  .then(data => {
    console.log(data);
  })
  .catch(err => {
    console.error(err);
    return Promise.reject(err);
  });

// Async/Await based
try {
  const passwd = await promiseBasedReadFile("etc/passwd");
  console.log(passwd);
} catch (err) {
  console.error(err);
  throw err;
}
```
