const typescript = require("rollup-plugin-typescript2");

module.exports = [
    {
     input: 'src/lib/index.ts',
     output: {
       dir: 'dist',
       format: 'cjs',
       sourcemap: true,
     },
     plugins: [
       typescript(),
     ],
     external: ['redux'],
   }
] 