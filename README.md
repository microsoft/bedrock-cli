# SPK

[![Build Status](https://dev.azure.com/epicstuff/bedrock/_apis/build/status/CatalystCode.spk?branchName=master)](https://dev.azure.com/epicstuff/bedrock/_build/latest?definitionId=128&branchName=master)

> This missing Bedrock CLI

## Initialize

In order to start using spk, you need to specify configuration in a yaml file.
Please refer to the config file located [here](./spk-config.yaml) and follow the
same format.

If you would like to specify private keys or access tokens that should **not be
stored in raw text**, follow the steps below.

```yaml
---
account_name: "someHardcodedValue"
table_name: "anotherNonPrivateKey"
key: "${env:ACCESS_KEY}"
partition_key: "canBeStoredInRawTextKey"
```

You may refer to environment variables in your shell if you specify them in the
format "env:{VARIABLE_NAME}". `spk` will be able to use them from your current
shell. Make sure that if you open a new shell window, these variables will have
to be set again, otherwise, `spk` will throw an error on trying to use them.

A recommended approach is to have a `.env` file in your folder (make sure it's
gitignored!) with all variables and their values. By default, the `spk` tool
should be able to load these into your local env and use them to replace the
placeholders in the config file you pass in.

Run the `spk init -f <filename>` command, and then you should be all set to
start using the `spk` tool!

## Getting Started

### System Prerequisites

- Node@>=LTS
- [Yarn](https://yarnpkg.com/)@Stable
- Azure CLI

### Installation

Install the project dependencies with Yarn:

```sh
yarn install
```

### Running the linter

```sh
yarn lint
```

To run the tslint autofixer:

```sh
 yarn lint-fix
```

### Running The Code

Install `ts-node` to make your development cycle easier:

```sh
yarn global add ts-node
ts-node src/index.ts # this is the same as running `./spk` or 'node spk.js'

# You can now do things like
ts-node src/index.ts project init # same as running `./spk project init`
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

### Running the Debugger

To debug on [Visual Studio Code](https://code.visualstudio.com/):

1. On the top menu select Debug > Start Debugging
2. It will prompt you to create a `launch.json` file for the go language,
   proceed to create it.
3. Add the settings found below to the `launch.json` file. Change the `args`
   with the command and options that you want to debug. In this case, it will
   debug `deployment get`.

Sample `launch.json`:

```
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Debug index.ts",
            "cwd": "${workspaceFolder}",
            "runtimeArgs": ["-r", "ts-node/register"],​
            "args": ["${workspaceRoot}/src/index.ts", "deployment", "get"]​
        }
    ]
}
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

### IDE Configuration

This project uses [TSLint](https://palantir.github.io/tslint/) for linting and
[Prettier](https://prettier.io/) for code formatting. For best integration with
these tools, VSCode is recommended along with the corresponding extensions:

- https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode
- https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin

Note: the Prettier VSCode extension will overwrite the existing formatting
hot-key (`alt`+`shift`+`f`)

#### Pre-commit Prettier Hook

A pre-commit hook will automatically get installed when running `yarn` on the
project. This hook will automatically format all staged files with Prettier
before committing them. Although useful, make sure to format your code regularly
throughout your dev cycle (`alt`+`shift`+`f` in VSCode) to make sure that no
unintended format changes happen.

## Testing

We use a [TypeScript variant](https://github.com/kulshekhar/ts-jest) of
[Jest](https://jestjs.io/) for testing. To create a test, create a file anywhere
in the project with name `<insert-filename-of-file-testing>.test.ts`; Jest will
automatically do a glob search for files matching `/.+\.test\.tsx?/ig` and run
the tests contained in them.

By convention, we will store the test file in the same directory as the file its
testing. When/if this becomes too burdensome, we can move them to a tests
directory.

## Adding/Removing/Modifying Project Dependencies

> NEVER modify `dependencies` or `devDependencies` manually in package.json!

### Adding a dependency

```sh
yarn add react # This will add react to both package.json and the yarn.lock lockfile
```

or

```sh
yarn add react@^16.9.0 # you can specify target semver's as well
```

We also want to keep all @types in devDependencies instead of dependencies.

```sh
$ yarn add -D @types/node-emoji
```

### Removing a dependency

```sh
yarn remove react # Will remove react from both package.json and yarn.lock
```

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

Write pure function whenever possible. The _value_ of Objects and Arrays in JS
are pointers, if a function takes in an object or an array, modifies it, and
returns the the modified value, it has actually mutated the array/object that
was passed as an argument (note this only applies to objects and arrays, all
other types are pass-by-value). This is a style of coding you want to avoid when
dealing with JS as multiple functions may take in the same object as an argument
throughout your code and the ordering of the functions cannot be assured when
dealing with async code.

Instead, what we want to do is create copies of the information in your function
and return a modified copy of the original using the `...` (spread) operator.
This will allow you to be more confident that async code is able to still
evaluate the same data that you initially passed it even if the event loop
caused your code to run out of order.

```typescript
interface IHuman {
  name: string;
  age: number;
}

// Don't do
// Objects and arrays are passed as pointers.
const jack = { name: "Jack", age: 20 };
const incrementAge = (human: IHuman): IHuman => {
  human.age = age + 1;
  return human;
};
const agedJack = incrementAge(jack);
// NOTE: both agedJack AND jack are now age 21 as you modified the literal
// object passed to the function

// Do
const jack = { name: "Jack", age: 20 };
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
