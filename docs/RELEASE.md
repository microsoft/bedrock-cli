# Release

[![Build Status](https://dev.azure.com/epicstuff/bedrock/_apis/build/status/myho/%5Bspk%5D%20create%20github%20release?branchName=master)](https://dev.azure.com/epicstuff/bedrock/_build/latest?definitionId=130&branchName=master)

Instruction on how to cut a new release.

## Steps

### Bump Version

1. Run the following script to update `package.json`. This will also create and
   push to a new branch.

   ```bash
   # releasing new minor version & git remote is origin
   ./scripts/release-version-bump minor origin
   ```

1. Create PR

### Create GitHub Release

1. Once PR is merge
1. Run the following script to tag master branch. This will kick off
   [the release pipeline](https://dev.azure.com/epicstuff/bedrock/_build?definitionId=130&_a=summary)
   to auto build and create a GitHub release.

   ```bash
   # origin is my git remote, change it to whatever yours is
   ./scripts/tag-release.sh origin
   ```

1. The release will also include a changelog of commits made since last release.
   This can be turn off.
