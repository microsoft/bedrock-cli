# spk infra (under the hood)

A breakdown of how `spk infra` will handle versioning, cloning, template
generation, and more.

## Sourcing Templates

`spk` will rely on **git cloning** your source repository (e.g.
microsoft/bedrock) as a means to appropriately source Terraform templates. This
will happen as part of the `spk infra scaffold` and `spk infra generate`
executions using arguments `--source`, `--version`, and `--template`. The
`--source` argument specifies the git url of your source repo, the `--template`
argument specifies the path to the template within the git repo, and the
`--version` argument specifies the git repo _tag_. `spk` requires that template
or repo versions are made in the form of repo tags or branches.

This allows there to be flexibility in using _any_ source repository, including
ones outside of Bedrock. As long as the `--template` value provides a valid path
within the source repository, and the versioned source repository can be
successfully cloned, `spk` will be able to scaffold and generate templates from
any source.

The following sequence of events will take place with regards to sourcing
templates when running `spk infra` commands:

1. `spk infra scaffold` will clone source repository to `~/.spk/infra`
   directory.
2. The `--version` argument will correspond to a repo tag. After the repository
   is successfully cloned, `git checkout tags/<version>` will checkout the
   specific version of the repo.
3. `spk infra scaffold` will copy the template files over to the current working
   directory. The `--template` argument in `spk infra scaffold` will specify the
   path to the Terraform template in the source repo (e.g.
   `/cluster/environments/azure-simple`).
4. Argument values and variables parsed from `variables.tf` and `backend.tfvars`
   will be concatenated and transformed into a `definition.yaml`.
5. `spk infra generate` will parse the `definition.yaml` (in the current working
   directory), and (1) validate the source repo is already cloned in
   `~./spk/infra` (2) perform a `git pull` to ensure remote updates are merged
   (3) git checkout the repo tag based on the version provided in the
   `definition.yaml` and (4) after it is finished iterating through directories,
   copy the Terraform template to the `generated` directory with the approprite
   Terraform files filled out based on `definition.yaml` files.

## Iterating Through Infrastructure Hierarchy

In a multi-cluster scenario, your infrastructure hierarchy should resemble a
tree-like structure as shown:

```
fabrikam
    |- definition.yaml
    |- fabrikam-east/
        |- definition.yaml
    |- fabrikam-west/
        |- definition.yaml
fabrikam-generated
    |-fabrikam-east/
        |- backend.tfvars
        |- main.tf
        |- spk.tfvars
    |- fabrikam-west/
        |- backend.tfvars
        |- main.tf
        |- spk.tfvars
```

`spk infra generate` will attempt to recursively read `definition.yaml` files
following a "top-down" approach. When a user executes
`spk infra generate -p fabrikam-east` for example (assuming in `fabrikam`
directory):

1. The command recursively (1) reads in the `definition.yaml` at the current
   directory level, (2) applies the `definition.yaml` there to the currently
   running dictionary for the directory scope, and (3) descends the path step by
   step.
2. At the final leaf directory, it creates a generated directory and fills the
   Terraform definition using the source and template at the specified version
   and with the accumulated variables.

## Private Repos

`spk` will extend the capability to clone private repositories using personal
access tokens (PAT). For more information, please refer to this
[section](../cloud-infra-management.md#authentication-private-repos) of Cloud
Infra Management.

## Future Considerations

### Redeployments and Migrations

Often, templates may change drastically that it may make more sense to deploy a
new cluster and perform a migration.

- Where do you draw the line on performing re-deployments and migrations?
- Should this be handled through `spk`, Azure DevOps pipeline, or etc.?

### Reconcilation Between Parent and Leaf Templates

There potentially could be issues that emerge when propagating definitions when
dealing with template version mismatch between parent and leaf templates.

- Could it be possible that propagation fails when the templates between
  versions are _too_ different? (e.g. new variables/modules/resources are
  removed but still carried over from parent to leaf)

### Determining Conditionals Based on Committed Modified Files

If `definition.yaml` files and generated Terraform files were to reside in the
same repo (e.g. "Infra HLD Repo"), there needs to be a script (which executes
within a pipeline) that will determine the appropriate action(s) for when
specific files are modified. The following are "proposed" steps on how to handle
this using a script:

Based on the commit ID that triggered the pipeline script, get the
changeset/modified files:

1. If changes are made to definition.yaml files:
   - If a (parent) definition.yaml file:
     - Run `spk infra generated` on all "leaf" directories.
     - Create a pull request against the HLD with the updated generated files.
   - If a (child/leaf) definition.yaml:
     - run `spk infra generated` on just the leaf directory.
     - Create a PR to the HLD with the updated generated files.
   - If BOTH:
     - Run `spk infra generated` on all "leaf" directories.
     - Create a PR to the HLD with the updated generated files.
2. If changes are made to "generated" files:
   - Determine which generated directories are affected.
   - Proceed to run `terraform init`, `terraform plan`, and `terraform apply` on
     the affected directories.
