# Workflow setup

## Node versionining
We rely on nvm / .nvmrc to ensure the correct Node.js version is used throughout
this repo. For workflows, this means that `actions/setup-node` step should be 
configured to read `.nvmrc` like so:

```
- name: Setup Node.js
    uses: actions/setup-node@v6
    with:
        node-version-file: .nvmrc
        cache: "pnpm"
        cache-dependency-path: |
            pnpm-lock.yaml
```

The exceptions are the jobs that publish to npm (`publish` in `build-test-release.yml` and the job in
`canary-release.yml`): they set no `cache` and no `registry-url`, because they hold the OIDC token for npm trusted
publishing. See [docs/agents/ci.md](../../docs/agents/ci.md).
