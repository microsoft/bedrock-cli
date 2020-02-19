# Command Implementation

## Main Objective

We want to align all command implementation to adhere to a pattern for ease code
review, and maintenance; reduce defects; and generate documentations.

## Structure

All command implementations are under `src/commands` folder. Every command shall
have

1. `.ts` file that implements the command.

   1. has a function, `commandDecorator` which is the entry point to the command
   2. this `commandDecorator` provide an `action` function for the `commander`
      library.
   3. `action` command has to terminate by calling `CommandBuilder.exit`
      function with a `0` or `1` status code for `successeful` or `unsuccessful`
      execution respectively.

2. `.test.ts` file that contains unit test for the command
   1. code coverage shall be above 80%.
3. `.json` file that contains the command declaration
4. `.md` file that contains detailed information about the command.
   1. describe what this command is for (what it does)
   2. information that you think that users should be aware of
   3. sample(s) of the command
