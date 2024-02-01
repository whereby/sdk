#!/usr/bin/env node
import { defineCommand, runMain } from 'citty';
import { addDependency, installDependencies, removeDependency } from './index.mjs';
import 'node:fs';
import 'node:fs/promises';
import 'pathe';
import 'node:module';
import 'ufo';

const name = "nypm";
const version = "0.3.6";
const description = "Unified Package Manager for Node.js";

const operationArgs = {
  cwd: {
    type: "string",
    description: "Current working directory"
  },
  workspace: {
    type: "boolean",
    description: "Add to workspace"
  },
  silent: {
    type: "boolean",
    description: "Run in silent mode"
  }
};
const install = defineCommand({
  meta: {
    description: "Install dependencies"
  },
  args: {
    ...operationArgs,
    name: {
      type: "positional",
      description: "Dependency name",
      required: false
    },
    dev: {
      type: "boolean",
      alias: "D",
      description: "Add as dev dependency"
    }
  },
  run: async ({ args }) => {
    await (args._.length > 0 ? addDependency(args._, args) : installDependencies(args));
  }
});
const remove = defineCommand({
  meta: {
    description: "Remove dependencies"
  },
  args: {
    name: {
      type: "positional",
      description: "Dependency name",
      required: true
    },
    ...operationArgs
  },
  run: async ({ args }) => {
    await removeDependency(args.name, args);
  }
});
const main = defineCommand({
  meta: {
    name,
    version,
    description
  },
  subCommands: {
    install,
    i: install,
    add: install,
    remove
  }
});
runMain(main);
