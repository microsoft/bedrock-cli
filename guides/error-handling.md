# Error Handling

## Objectives

1. All errors are trace-able. That's from the error messages, we are able to
   figure out the execution path (many times, it is not appropriate to dump
   stack traces) and root cause(s).
2. An unique status code for each error so that user understand the error domain
   which can be `validation error`, `Azure storage management error`,
   `git operations related error`, etc.
3. Allows for localization of error message in future.

## Coding details

### imports

```javascript
import { build as buildError } from ”../lib/errorBuilder";
import { errorStatusCode } from "../lib/errorStatusCode";
```

`src/lib/errorBuilder` is the error builder. `src/lib/errorStatusCode` contains
an enum of error type

### throw

#### case 1

```javascript
throw buildError(errorStatusCode.<type>,
  "<error-identifier>");
```

example

```javascript
throw buildError(errorStatusCode.GIT_OPS_ERR, "infra-err-git-clone-failed");
```

and in `src/lib/i18n.json`, we have an entry

```
...
"infra-err-git-clone-failed": "Could not clone the source remote repository. The remote repo might not exist or you did not have the rights to access it",
...
```

#### case 2

where we have placeholder in error message

```javascript
throw buildError(errorStatusCode.<type>, {
  errorKey: "<error-identifier>",
  values: [sourcePath]
});
```

and in `src/lib/i18n.json`, we have an entry

```
...
"infra-git-source-no-exist": "Source path, {0} did not exist.",
...
```

#### case 3

where we nest an error into current error

```javascript
throw buildError(errorStatusCode.<type>,
  "<error-identifier>", err);
```

example

```javascript
try {
  <perform some azure API calls>
} catch (err) {
  throw buildError(errorStatusCode.GIT_OPS_ERR,
    "hld-reconcile-err-helm-add", err);
  }
}
```

and in `src/lib/i18n.json`, we have an entry

```
...
hld-reconcile-err-helm-add": "Error adding helm chart",
...
```

### write to log before exiting

This will write the entire error chain to the log. example

```
import { build as buildError, log as logError } from "../../lib/errorBuilder";
import { errorStatusCode } from "../../lib/errorStatusCode";

...
export const execute = async (
  opts: CommandOptions,
  exitFn: (status: number) => Promise<void>
): Promise<void> => {
  try {
    ...
    await exitFn(0);
  } catch (err) {
    logError(
      buildError(
        errorStatusCode.CMD_EXE_ERR,
        "introspect-create-cmd-failed",
        err
      )
    );
    await exitFn(1);
  }
};
```

We build a final error with `errorStatusCode.CMD_EXE_ERR`, and include the `err`
object. `err` may also include other errors. And we write this final error to
log with `logError` function.

# Appendix

## Reference

1. https://github.com/microsoft/bedrock-cli/blob/master/technical-docs/designs/exceptionHandling.md
