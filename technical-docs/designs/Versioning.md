# Software Design Document

Reference: Versioning and release guidance Authors: Andre Briggs

| Revision | Date         | Author       | Remarks       |
| -------: | ------------ | ------------ | ------------- |
|      0.1 | Apr-06, 2020 | Andre Briggs | Initial Draft |

## 1. Overview

Consumers of the Bedrock CLI should have guidance on what the versioning and
release strategy is.

## 2. Out of Scope

This document does not cover what a customer should do if they want a new
feature in an older version of the Bedrock CLI.

## 3. Proposal

The proposal is that we use semantic versioning for the Bedrock CLI. This means
that Bedrock CLI versions have a `MAJOR.MINOR.PATCH` (e.g. `0.6.0`). Semantic
versioning is a well known pattern that consists of:

```text
MAJOR version when you make incompatible API changes
MINOR version when you add functionality in a backwards compatible manner
PATCH version when you make backwards compatible bug fixes
```

### 3.1 What is included in a release

All releases will have a git tag in the
[releases](https://github.com/CatalystCode/spk/releases) section of the Bedrock
CLI repository. Each release will mention:

- What has been added
- What has been modified
- What has been removed

Additionally, the generated operational level documenentation can provide a more
specific changefeed on interface changes to the CLI. An
[example](https://github.com/dennisseah/simple/blob/master/design-docs/documents/changesInCommandsOverReleases.md)
describes how this would look.

If any new dependencies are required for the Bedrock CLI to operate they will
also be documented.

### 3.2 How users decide how to upgrade

Taking on new software is always risk. We reccomend that existing users of the
Bedrock CLI implement canary deployment techniques to ensure that their existing
environments can remain intact while confirming that new version work for them.

### 3.3 How to tell what open source dependences have changed

User want to know what OSS the Bedrock CLI uses can refer to `yarn.lock` in the
Bedrock CLI repository.

## 4. Dependencies

One strategy to completely control variables is to run the Bedrock CLI in a
controlled environment such as a
[custom build agent](https://github.com/andrebriggs/bedrock-agents) that has all
the dependencies necessary. This will minimize the chance of external
dependencies not being available (e.g. cloud outages) and will allow easier
rollback.

## 5. Known issues

## 6. Risks & Mitigations

## 7. Documentations

## 8. Appendix

- [Semantic Versioning](https://semver.org)
- [Custom Build Agents with Bedrock](https://github.com/andrebriggs/bedrock-agents)
- [Seeing command changes over releases](https://github.com/dennisseah/simple/blob/master/design-docs/documents/changesInCommandsOverReleases.md)
