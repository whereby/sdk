# CI and releases

All CI runs in GitHub Actions (`.github/workflows/`). There's no GoCD here. Every job sets up pnpm and Node from
`.nvmrc`, then runs `pnpm install --frozen-lockfile`, so a `package.json` change without a matching `pnpm-lock.yaml`
fails CI.

Branch protection on `main` requires PRs to be up to date with `main`. No status check is marked required.

## Workflows

| Workflow | Trigger | Runs | Locally |
| --- | --- | --- | --- |
| `test.yml` (Test) | PRs to `main` | `pnpm test` | `pnpm test` |
| `e2e.yml` (End-to-end Tests) | PRs to `main`, daily at 12:00 UTC | `pnpm test:e2e` on macOS with Playwright and FFmpeg, report uploaded as `playwright-report` | `pnpm test:e2e` (needs `.env`, see [testing.md](testing.md)) |
| `build-test-release.yml` | push to `main` | the Version Packages PR, or build, test and publish (below) | none |
| `canary-release.yml` | PR comment `/canary` or `/canary-release` | snapshot release with tag `canary` | none |

`pnpm test` is `turbo test`. For each package that has them it runs `test:lint`, `test:attw` (which builds the package
and its dependencies first) and `test` (lint again plus unit tests). It doesn't run e2e.

Dependabot opens weekly npm update PRs (`.github/dependabot.yml`).

## Changesets

Releases are driven by [changesets](https://github.com/changesets/changesets) (`.changeset/config.json`).

- A PR that changes a published package's behaviour or API includes a changeset: `pnpm changeset`, pick the packages
  and bump types, write the summary. It's a file like `.changeset/calm-rooms-wait.md`:

  ```md
  ---
  "@whereby.com/media": patch
  ---

  Hold back signaling messages in P2P until the room is joined
  ```

- The summary goes into the package's `CHANGELOG.md` as is. Write it for SDK users: what changed for them, not how.
- One changeset per package is common. A change that spans packages can list several in one file, or have one file
  per package.
- Apps (`*-app`) are ignored by changesets and never released. Tooling packages are private. Changes that only touch
  them, CI, docs or tests need no changeset.
- Don't edit `version` in a `package.json` or a `CHANGELOG.md` by hand. `pnpm run version` (`changeset version` plus
  a lockfile update) does that in the release PR.
- Internal dependencies are pinned to exact versions (`"@whereby.com/core": "1.23.4"` in browser-sdk). With
  `updateInternalDependencies: "patch"`, releasing core bumps the pin in browser-sdk, assistant-sdk and
  react-native-sdk and gives each a patch release. Locally pnpm links the workspace copy anyway
  (`link-workspace-packages=true` in `.npmrc`).

## Release flow

1. A PR with a changeset is merged to `main`.
2. `build-test-release.yml` runs. Its `select-mode` job (`changesets/action/select-mode@v2`) picks a mode:
   `version` while there are changesets in `.changeset/`, `publish` when a package's version isn't on npm yet, or
   `none`.
3. In `version` mode, the `version` job opens or updates the **Version Packages** PR (`changeset-release/main`), which
   runs `pnpm run version` to bump versions and changelogs.
4. Merging that PR runs the workflow again, now in `publish` mode:
   - `pack` runs `pnpm build` and `pnpm test`, then packs a tarball of each unpublished package
     (`changesets/action/pack@v2`) and uploads them as a workflow artifact.
   - `publish` publishes those tarballs (`changesets/action/publish@v2`, which runs `changeset publish
     --from-pack-dir`), pushes the git tags and creates the GitHub releases. It doesn't build anything.
   - `deploy` builds again and uploads `packages/<pkg>/dist/cdn/` to the `whereby-cdn` S3 bucket and invalidates
     CloudFront, for browser-sdk (`embed/`), camera-effects (`camera-effects/`) and audio-denoiser
     (`audio-denoiser/`) when they were published (`.github/actions/deploy-cdn`). Then it posts the published versions
     to Slack (`.github/actions/notify-slack`). It reads the `published` and `published-packages` outputs of the
     publish job.

## npm trusted publishing

The `publish` job in `build-test-release.yml` and the canary job in `canary-release.yml` authenticate to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), not a token. GitHub gives the job a
short-lived identity token, and npm accepts it because each `@whereby.com` package has a trusted publisher on
npmjs.com for each of the two workflow files in the `whereby/sdk` repo. npm also generates
[provenance](https://docs.npmjs.com/generating-provenance-statements) for every release.

What keeps it working:

- Both workflows set `permissions: {}` and grant `id-token: write` only to the job that publishes. Don't add it to
  other jobs, and don't give the release `publish` job secrets or a dependency cache.
- The publishing jobs' `actions/setup-node` has no `registry-url`. With one, setup-node writes an `.npmrc` with a
  placeholder token that npm prefers over OIDC, and the publish fails with a 404 or `ENEEDAUTH`.
- `pnpm publish` hands the package to the npm CLI, which needs npm 11.5.1 or later for OIDC. Both jobs check the npm
  version from `.nvmrc`'s Node and upgrades npm if it's older.
- Every published `package.json` has `repository.url` `git+https://github.com/whereby/sdk.git` and a
  `repository.directory`. npm rejects a provenance publish whose repository doesn't match the repo the workflow ran
  in, so keep it on new packages too.
- The trusted publisher on npm names the workflow file. Renaming either workflow breaks its publishing until
  each package's trusted publisher is updated (`npm trust github <pkg> --file <workflow>.yml --repo whereby/sdk
  --allow-publish`, by an npm org admin). A trusted publisher that hasn't completed a publish within 2 days of being
  added expires.
- A new package can't be published with OIDC the first time: npm needs the package to exist before it can have a
  trusted publisher. An npm org admin publishes the first version by hand, then adds the trusted publisher.

## Canaries

Comment `/canary` on a PR (needs write access). `canary-release.yml` runs `changeset version --snapshot canary` and
`changeset publish --tag canary --no-git-tag`, which publishes every package with a changeset in the PR (and its
dependents) as `0.0.0-canary-<datetime>`. Then it deploys the camera-effects and audio-denoiser CDN assets and comments
the install commands on the PR. It publishes with trusted publishing, like the release (above).

These publish to npm and the CDN, so only a human starts them.
