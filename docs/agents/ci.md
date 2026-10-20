# CI and releases

All CI runs in GitHub Actions (`.github/workflows/`). There's no GoCD here. Every job sets up pnpm and Node from
`.nvmrc`, then runs `pnpm install --frozen-lockfile`, so a `package.json` change without a matching `pnpm-lock.yaml`
fails CI.

Branch protection on `main` requires PRs to be up to date with `main`. No status check is marked required.

## Workflows

| Workflow | Trigger | Runs | Locally |
| --- | --- | --- | --- |
| `test.yml` (Test) | PRs to `main` and `development` | `pnpm test` | `pnpm test` |
| `e2e.yml` (End-to-end Tests) | PRs to `main`/`development`, daily at 12:00 UTC | `pnpm test:e2e` on macOS with Playwright and FFmpeg, report uploaded as `playwright-report` | `pnpm test:e2e` (needs `.env`, see [testing.md](testing.md)) |
| `build-test-release.yml` | push to `main` | `pnpm test`, `pnpm build`, then changesets (below) | none |
| `prerelease.yml` | push to `development` | same, in changesets pre mode with tag `beta` | none |
| `exit-prerelease.yml` | PRs to `main` | `pnpm changeset pre exit` if `.changeset/pre.json` exists, and commits it to the PR branch | none |
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
2. `build-test-release.yml` runs tests and build, then `changesets/action` opens or updates the **Version Packages**
   PR (`changeset-release/main`), which bumps versions and changelogs.
3. Merging that PR runs the workflow again. This time it publishes to npm (`pnpm release` = `pnpm build && changeset
   publish`), then:
   - uploads `packages/<pkg>/dist/cdn/` to the `whereby-cdn` S3 bucket and invalidates CloudFront, for browser-sdk
     (`embed/`), camera-effects (`camera-effects/`) and audio-denoiser (`audio-denoiser/`)
     (`.github/actions/deploy-cdn`)
   - posts the published versions to Slack (`.github/actions/notify-slack`)

## Pre-releases and canaries

- Beta: PRs target `development` instead of `main`. `prerelease.yml` enters pre mode (`.changeset/pre.json`) and
  publishes with the `beta` tag. Merging `development` into `main` exits pre mode via `exit-prerelease.yml`.
- Canary: comment `/canary` on a PR (needs write access). It publishes a snapshot of every package with a changeset in
  the PR under the `canary` tag, deploys camera-effects and audio-denoiser CDN assets, and comments the install
  commands on the PR.

These publish to npm and the CDN, so only a human starts them.
