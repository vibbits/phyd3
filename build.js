import { buildSync } from "esbuild";
import npmDts from "npm-dts";

import pkg from "./package.json" assert { type: "json" };

var shared = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es6",
  platform: "neutral",
  external: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
};

buildSync({
  ...shared,
  outfile: "dist/index.js",
});

new npmDts.Generator({
  entry: "src/index.ts",
  output: "dist/index.d.ts",
}).generate();
