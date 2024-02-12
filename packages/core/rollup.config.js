/* eslint-disable @typescript-eslint/no-var-requires */
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const replace = require("@rollup/plugin-replace");
const nodeResolve = require("@rollup/plugin-node-resolve");
const pkg = require("./package.json");
const { dts } = require("rollup-plugin-dts");
const json = require("@rollup/plugin-json");

const replaceValues = {
  preventAssignment: true,
  values: {
      __SDK_VERSION__: pkg.version,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
      "process.env.NODE_DEBUG": JSON.stringify(process.env.NODE_DEBUG),
      "process.env.AWF_BASE_URL": JSON.stringify(process.env.AWF_BASE_URL),
      "process.env.AWF_API_BASE_URL": JSON.stringify(process.env.AWF_API_BASE_URL),
      "process.env.AP_ROOM_BASE_URL": JSON.stringify(process.env.AP_ROOM_BASE_URL),
      "process.env.RTCSTATS_URL": JSON.stringify(process.env.RTCSTATS_URL || "wss://rtcstats.srv.whereby.com"),
      "process.env.REACT_APP_API_BASE_URL": JSON.stringify(
          process.env.REACT_APP_API_BASE_URL || "https://api.whereby.dev"
      ),
      "process.env.REACT_APP_SIGNAL_BASE_URL": JSON.stringify(
          process.env.REACT_APP_SIGNAL_BASE_URL || "wss://signal.appearin.net"
      ),
      "process.env.REACT_APP_IS_DEV": JSON.stringify(process.env.REACT_APP_IS_DEV),
  },
};

const peerDependencies = [...Object.keys(pkg.peerDependencies || {})];

const plugins = [
  replace(replaceValues),
  replace({
      preventAssignment: true,
      // jslib-media uses global.navigator for some gUM calls, replace these
      delimiters: [" ", "."],
      values: { "global.navigator.mediaDevices": " navigator.mediaDevices." },
  }),
  nodeResolve({
      // only include @whereby/jslib-media and rtcstats in our bundle
      preferBuiltins: true,
      resolveOnly: [/@whereby\/jslib-media|rtcstats|/],
  }),
  commonjs(),
  typescript(),
  json()
];

module.exports = [
    // Esm build of lib, to be used with bundlers
    {
      input: 'src/lib/index.ts',
      output: {
        exports: "named",
        file: "dist/index.esm.js",
        format: "esm",
      },
      plugins,
      external: [ ...peerDependencies],
   },
   {
      input: "src/lib/index.ts",
      output: [{ file: "dist/index.d.ts", format: "es" }],
      external: ["@whereby/jslib-media/src/webrtc/RtcManager"],
      plugins: [dts()],
    },
];