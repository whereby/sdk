# Workflow setup

## Node versionining
We rely on nvm / .nvmrc to ensure the correct Node.js version is used throughout
this repo. For workflows, this means that `actions/setup-node` step should be 
configured to read `.nvmrc` like so:

```
- name: Setup Node.js
    uses: actions/setup-node@v4
    with:
        node-version-file: .nvmrc
        cache: "yarn"
        cache-dependency-path: |
            yarn.lock
```