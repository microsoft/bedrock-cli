## Description

Initializes the HLD repository by creating the pipeline
`manifest-generation.yaml` file, and the default `component.yaml` for
[fabrikate](https://github.com/microsoft/fabrikate) to consume, if each does not
already exist.

The created `component.yaml` will be populated with a traefik2 definition by
default:

```
name: default-component
subcomponents:
  - name: traefik2
    method: git
    source: 'https://github.com/microsoft/fabrikate-definitions.git'
    path: definitions/traefik2
```

However, you can set a another fabrikate definition to be added instead via the
`--default-component-*` flags.
