# AGENTS.md

Whereby SDK: the npm packages (`@whereby.com/*`) that customers use to put Whereby video in their own apps. Whereby's
own room web app uses two of them (`media`, `camera-effects`) too. It's a pnpm + Turborepo monorepo of TypeScript
packages, built with Rollup. Room state is Redux Toolkit in `core`, the React layer targets React 18/19, and tests
use Jest 29 + ts-jest.

## Read when relevant

| Before you... | Read |
| --- | --- |
| write or change tests | [docs/agents/testing.md](docs/agents/testing.md) |
| touch `packages/core/src/redux/` or `packages/core/src/client/` | [docs/agents/state.md](docs/agents/state.md) |
| add or change anything customers call (hooks, client methods, embed commands, exports) | [docs/agents/public-api.md](docs/agents/public-api.md) |
| add a changeset, change CI or need to know how releases work | [docs/agents/ci.md](docs/agents/ci.md) |

## Layout

Workspaces are `packages/*` (published), `apps/*` (examples, never published) and `tooling/*` (shared config). An
arrow means "depends on":

- `packages/media`: WebRTC (P2P and SFU via mediasoup), signal socket, wire protocol types. Whereby's room
  web app uses it too.
- `packages/camera-effects` and `packages/audio-denoiser` (→ media): background effects and noise suppression, with
  assets on the CDN.
- `packages/core` (→ media, camera-effects, audio-denoiser): the Redux store with all room logic, the API clients and
  `WherebyClient`. Entry points `@whereby.com/core` and `@whereby.com/core/redux`.
- `packages/browser-sdk` (→ core, media): React hooks and components (`/react`) and the `<whereby-embed>` web
  component (`/embed`, which loads the Whereby room in an iframe). Also a CDN build. Storybook lives here.
- `packages/react-native-sdk` (→ core): `WherebyEmbed`, the Whereby room in a WebView (`/embed`). Built with bob,
  not Rollup. `src/native/` is a placeholder.
- `packages/assistant-sdk` (→ core): headless participants in Node.js (`@roamhq/wrtc`).
- `apps/`: examples on the workspace packages. `sample-app` (port 5420) also hosts the Playwright e2e tests.
  `embed-element-app` is the test page for `<whereby-embed>`.
- `tooling/{eslint,jest,prettier,rollup,tsconfig}`: shared configs, imported as `@whereby.com/<name>-config`.

## Setup

- Node 24 (`.nvmrc`) and **pnpm 10** (`packageManager` in `package.json`, `pnpm-workspace.yaml`). Don't use npm or
  yarn. All packages come from public npm, so no token is needed.
- `pnpm install`, then `pnpm build`. Tests and Storybook import other packages from their `dist/` (see Gotchas).
- Shared versions (TypeScript, ESLint, Prettier, Jest, React) are set once in the `catalog` in `pnpm-workspace.yaml`
  and referenced as `catalog:`. Change them there.
- The root `.env` (from `.env.example`) sets the room for Storybook (`STORYBOOK_ROOM`, `STORYBOOK_ROOM_HOST_ROOMKEY`),
  the e2e API key (`WHEREBY_API_KEY`) and, for a local backend, `REACT_APP_API_BASE_URL` / `REACT_APP_SIGNAL_BASE_URL` /
  `REACT_APP_SFU_BASE_URL`. Without them Storybook talks to production.

## Commands

Run from the repo root. `<pkg>` is the package name, e.g. `@whereby.com/core`.

| Task | Command |
| --- | --- |
| Build everything (about 90 s cold, cached after) | `pnpm build` |
| Build one package and what it depends on | `pnpm turbo build --filter=<pkg>` |
| Everything CI runs (lint, attw, unit tests) | `pnpm test` |
| Lint and unit tests for one package (builds deps first) | `pnpm turbo test --filter=<pkg>` |
| Lint / format one file | `pnpm --filter <pkg> exec eslint <path>` / `pnpm exec prettier --write <path>` |
| Typecheck one package | `pnpm --filter <pkg> exec tsc --noEmit` |
| One test file | `pnpm --filter @whereby.com/core test:unit src/redux/tests/store/spotlights.spec.ts` |
| Tests matching a name | `pnpm --filter <pkg> test:unit <path> -t "<name>"` |
| Package types check (are-the-types-wrong) | `pnpm test:attw` |
| Storybook for browser-sdk (port 6006) | `pnpm dev` |
| Run an example app | `pnpm dev:sample-app` (also `dev:embed-element-app`, `dev:telehealth-app`, `dev:quiz-app`, `dev:nextjs-example`) |
| E2E (needs `.env`) | `pnpm test:e2e` |
| Add a changeset | `pnpm changeset` |

`test:unit` paths are relative to the package. Run Jest through `test:unit`, not `npx jest`: core, browser-sdk and
assistant-sdk need `--experimental-vm-modules`, which the script sets.

Before handing off, run what the PR check runs:

```sh
pnpm test   # turbo: build, test:lint, test:attw, test (lint + jest) in every package
```

It passes on `main` today, in about 20 s once `pnpm build` has filled the Turbo cache. Jest prints `console.error`
output from some existing tests. That doesn't fail the run.

## Rules

- ESLint (`tooling/eslint/base.js`, typescript-eslint recommended) is the source of truth for lint. `no-console`
  except `console.warn`/`console.error`. browser-sdk adds `eslint-plugin-storybook`.
- Prettier (`tooling/prettier`: 4 spaces, 120 columns) isn't checked in CI. Run `prettier --write` on files you
  change. 5 existing files aren't formatted, so check the diff stays yours.
- TypeScript is `strict`. Type errors fail `pnpm build` (rollup-plugin-typescript2) and ts-jest.
- Room logic belongs in core, not in browser-sdk hooks or the apps. browser-sdk only adapts core's clients to React.
- Every change to a published package's behaviour or API needs a changeset ([docs/agents/ci.md](docs/agents/ci.md)).
  Don't hand-edit `version` fields, `CHANGELOG.md` files or internal dependency pins. The release PR does that.
- Add dependencies to the package that uses them (`pnpm --filter <pkg> add <dep>`), with the updated `pnpm-lock.yaml`.

## PRs and commits

- Commit subjects start with the package or area, then a capitalised imperative sentence: `core: Add audio-only mode
  support`, `browser-sdk: Render room integrations in VideoGrid by default`. Use `common:` for changes across
  packages, and `storybook:`, `e2e:` or the app name for those areas (README, PR template).
- One commit per package where you can, each with its own changeset.
- Branches: `<user>/<ticket>-<slug>`. PRs target `main`. Beta work targets `development`.
- PR title has the same prefix. The body follows `.github/PULL_REQUEST_TEMPLATE.md`: **Description** (summary, related
  issue), **Testing**, **Screenshots/GIFs**, **Checklist**, **Additional Information**.

## Gotchas

- Tests in browser-sdk, core and assistant-sdk resolve `@whereby.com/core` and `@whereby.com/media` to
  `dist/legacy-esm.js`. After changing core or media, rebuild them (`pnpm turbo build --filter=<pkg>`) or dependents
  test against the old code.
- `pnpm test` skips camera-effects and audio-denoiser (no `test`/`test:lint` scripts). Lint them with
  `pnpm --filter <pkg> exec eslint src`. Their `lint` script runs `eslint .`, which also lints `dist/` and fails after
  a build.
- media and camera-effects are also used by Whereby's room web app. Keep their APIs backwards compatible.
- Storybook 9 with React 19 mounts every story twice. A story that calls `joinRoom()` in an effect can join twice and
  end up with signalling but no video. Guard the effect (check the root element `isConnected`) before joining.
- `<whereby-embed>` only works if the page's origin (Storybook is `localhost:6006`) is in the room organization's
  allowed domains. Otherwise the room drops commands and events silently.
- `.env` is gitignored and holds API keys. Never commit it or print its contents.
- Don't edit or commit output dirs: `dist/`, `.turbo/`, `storybook-static/`, `playwright-report/`, `test-results/`,
  `apps/nextjs-example/.next/`.
