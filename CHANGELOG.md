# RELEASE NOTES

## [Unreleased]

- Service management `reconcile` features
- Service Infrastructure `generate` features
- Multi-stage pipeline support in service management and introspection

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
