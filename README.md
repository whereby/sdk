# Whereby SDK

Monorepo for Whereby SDKs.

## Local development

Run `pnpm install` and `pnpm build` in the root folder.
You can run each of the example apps by running `pnpm dev:name-of-app` in the root folder. For example, to run the `sample-app` example app, you would run `pnpm dev:sample-app`.
To set up local development against a local Whereby room, you can create a `.env` file in the root folder. Look at the `.env.example` file for the fields you need to set.

`pnpm dev` will run storybook for the browser SDK.

## Issues

Found a bug or missing a feature? Please [submit an issue](https://github.com/whereby/sdk/issues/new)

## Pull Requests and commit messages

### Naming conventions

We prefix our commit messages with the service or package name, followed by a colon and a space. The only exception to this is commits or pull requests that affect multiple services or packages, in which case we use `common` as the prefix.

## Release process

We use [changesets](https://github.com/changesets/changesets) to manage our releases. To create a new release, run `pnpm changeset` and follow the prompts. It will ask you for the package you want to release, the type of release (major, minor, patch), and a summary of the changes. This will create a new changeset file in the `.changeset` folder. This should be committed and a part of the pull request that introduces the changes.

When the pull request is merged, the changeset will be picked up by the `build-test-release` GitHub action, which will create (or update) a release pull request. This pull request will contain the changeset summary and a list of the changes that will be included in the release. This can stay open if you don't want to release the changes immediately. It will update automatically when new changesets are merged.

Once the pull request is approved and merged, the release will be published to npm, and deployed to the CDN (if applicable), by the `build-test-release` GitHub action. It publishes with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is involved, and npm attaches provenance to each release.

### Canary releases
Canary releases (snapshots) are not done automatically. To publish one for a pull request, run the `Canary` workflow from the Actions tab with the pull request number, or run `gh workflow run canary-release.yml -f pr=<number>`. It publishes a canary release to npm with the `canary` tag for all the packages that have a changeset in the PR, and comments the install commands on the PR. Running it needs write access to the repository.


## Contact
Email us at [embedded@whereby.com](mailto:embedded@whereby.com) to get in touch with us.
