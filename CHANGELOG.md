# RELEASE NOTES

## [0.6.2] - 2020-04-12

### Changed

- Various build fixes

## [0.6.1] - 2020-04-10

### Added

- Specific error codes to various CLI operations

### Changed

- Various bug fixes
- Integration test improvements

## [0.6.0] - 2020-04-03

### Added

- Enabled `spk ring` commands

### Changed

- Refactoring for eslint support and exception chaining.
- Integration test improvements
- Various bug fixes

## [0.5.8] - 2020-03-17

### Added

- `spk setup` improvements

### Changed

- Fixed bug where Azure Pipelines would fail due to Helm 3 installation

## [0.5.7] - 2020-03-10

### Added

- `spk setup` improvements

### Changed

- Fixed "Ring names must be DNS safe"
- Fixed "fab set in build update hld pipeline should set image tag in different
  config file"
- Various bug fixes and refactoring

## [0.5.6] - 2020-03-06

### Changed

- Various bug fixes and refactoring

## [0.5.5] - 2020-03-04

### Added

- Initial version of `spk setup` command

### Changed

- Various bug fixes and refactoring

## [0.5.4] - 2020-02-25

### Changed

- Various bug fixes and refactoring

## [0.5.3] - 2020-02-19

### Changed

- Various bug fixes and refactoring

## [0.5.2] - 2020-02-14

### Changed

- Default fabrikate component initialized by `spk hld`
- Various bug fixes and refactoring

## [0.5.1] - 2020-02-05

### Changed

- Various bug fixes and refactoring

## [0.5.0] - 2020-02-03

### Added

- Ability to offer overrides for ingress route path prefixes and major version
  in `bedrock.yaml`
- Updated pipelines to include introspection storage update scripts

### Changed

- Changes to standardize the utilization of variable groups across lifecycle and
  service pipelines project
- Various bug fixes and refactoring

## [0.4.1] - 2020-01-29

### Changed

- Resolved [bug](https://github.com/microsoft/bedrock/issues/916) around
  `spk hld reconcile`
- Resolved [bug](https://github.com/microsoft/bedrock/issues/905) around unit
  test failure

## [0.4.0] - 2020-01-25

### Added

- Ability to disable ingress route creation
- Ability to specify ports for traefik ingress routes
- Generation of traefik strip-prefix middleware
- Ability to specify per-service middleware injection for Traefik2 IngressRoutes
- Extend bedrock.yaml services to incorporate display name

### Changed

- Syntax for some operations. Please refer to documentation.
- Various bug fixes

## [0.3.0] - 2019-11-24

### Added

- Service management `reconcile`, `install-manifest-pipeline`,
  `install-lifecycle-pipeline`, and `ingress-route create` features
- Service Infrastructure `generate` features
- Multi-stage pipeline support in service management and introspection
- Service Introspection `dashboard` UX tweaks

### Changed

- Syntax for some operations. Please refer to documentation.

## [0.2.0] - 2019-10-29

### Added

- Service Infrastructure `scaffold` features
- Service Management `service create-revision`, `service create-pipeline` and
  `hld` features
- Service introspection `onboarding`, `validate`, `variable-groups` features

### Changed

- Service introspection manual setup instructions

## [0.1.0] - 2019-10-21

### Added

- Global Configuration

  - One place to configuration all parameters to initialize the SPK tool

- Service Management

  - The ability to create an Azure Repo (standard or mono-repo) with SPK
    metadata files
  - The ability to create a service in your Azure Repo that will automatically
    be linked to an Azure DevOps Pipeline

- Service Introspection

  - Features to able to see your services being deployed in the SPK CLI

### Known Issues

- No infrastructure features this release
