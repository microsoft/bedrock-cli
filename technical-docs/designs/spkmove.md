# Moving `SPK` repo from `Catalystcode` to `Microsoft` org

| Revision | Date         | Author (s)    | Remarks       |
| -------: | ------------ | ------------- | ------------- |
|      0.1 | Mar-30, 2020 | Sarath, Andre | Initial Draft |

## Overview

This document describes high level steps to move Bedrock-CLI repo (formerly
known as `SPK`) to the Microsoft organization in GitHub.

The major change is to rename the CLI tool name in the existing repo from `spk`
to a new name which is a non trivial and requires code changes in many files.
The plan is to make the changes in the current repo which will simplify the
final sync as we validate CI builds side-by-side for sometime in both repos.

## In Scope

Only renaming `spk` to a new name and moving the repo to Microsoft org is in
scope and all other changes are defferred to post move.

## Design Details

1. Create a new repo `bedrock-cli` in `microsoft` org

   - Create a new repo `bedrock-cli` under `microsoft org`. The final repo name
     is TBD.
   - Perform initial sync between `spk` and `bedrock-cli` repos.

2. Changes in `bedrock-cli` repo

   - Clone existing builds and pipelines in Azure DevOps with references to the
     new repo.
   - Change docs links in `Bedrock` repo to point to new repo location.
   - Configure new name in in the configuration according step 1 above.

3. `SPK` name change

   - Review existing `spk` usage in various types of files such as source code,
     docs, pipeline yaml files, and etc.
   - Define one or more approaches to replace `spk` with new name that works
     better with various file types. For example:

     - replacing `spk` in code files from a configuration
     - using a generic name `cli` or new name in docs and pipeline yaml files
       where reading the new name from a configurable location is not feasible.
     - Changing `webpack.config.js` and/or `package.json` files for generated
       docs and binaries.

   - Create a plan based on approaches from the above activity.
   - Implement above plan to rename `spk` with a new name.

4. Validate

   - All CI and other builds work connecting to the new repo.
   - All docs navigation without any broken links.
   - Validate `git` history in the new repo.

5. Finalize

   - Determine the date for final sync and cut off.
   - Perform final sync.
   - Make current `spk` repo offline.

6. Stabilization
   - Continue to monitor closely for any issues and address them for few days.

## Dependencies

1. The docs in `spk` and `bedrock` repos have references which needs to
   modified.

2) The build pipelines in Azure DevOps are referencing `yaml` files in `spk`
   repo which needs to be modified.

## Risks & Mitigations

1. Docs and builds as listed in the above section may break as part of this
   move.
2. The mitigation plan is to keep both repos side-by-side for few days by:
   - create new build definitions in Azure DevOps and validate.
   - change the doc links in `bedrock` repo and validate.

## Appendix

1. https://www.atlassian.com/git/tutorials/git-move-repository
