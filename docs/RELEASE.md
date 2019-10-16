# Release

Instruction on how to release new package

## Steps

### Bump Version

1. Run `./scripts/release-version-bump <RELEASE_TYPE>` to update `package.json`.
   This will also create and push to a new branch.

1. Create PR

### Create GitHub Release

1. Once PR is merge
1. Run `./scripts/tag-release.sh` to tag master branch. This will kick off
   [the release pipeline](https://dev.azure.com/epicstuff/bedrock/_build?definitionId=130&_a=summary)
   to auto build and create a GitHub release.
1. The release will also include a Changelog of commits made since last release.
   This can be turn off.
