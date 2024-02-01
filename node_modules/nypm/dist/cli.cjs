#!/usr/bin/env node
'use strict';

const citty = require('citty');
const index = require('./index.cjs');
require('node:fs');
require('node:fs/promises');
require('pathe');
require('node:module');
require('ufo');

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
const install = citty.defineCommand({
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
    await (args._.length > 0 ? index.addDependency(args._, args) : index.installDependencies(args));
  }
});
const remove = citty.defineCommand({
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
    await index.removeDependency(args.name, args);
  }
});
const main = citty.defineCommand({
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
citty.runMain(main);
