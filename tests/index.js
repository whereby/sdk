/* global require */

/*
 * This file bundles all source code and tests, and is used as the entry point for Karma.
 *
 * This way we also get reports on files with no coverage.
 */

const srcContext = require.context("../src", true, /.js$/);
srcContext.keys().forEach(srcContext);

require("./bootstrap.js");

const testsContext = require.context(".", true, /.spec.js$/);
testsContext.keys().forEach(testsContext);
