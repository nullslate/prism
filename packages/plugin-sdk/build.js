import { build } from "esbuild";
import { resolve } from "path";

const entryPoint = process.argv[2] || "src/index.tsx";

build({
  entryPoints: [resolve(entryPoint)],
  bundle: true,
  format: "iife",
  globalName: "__PRISM_PLUGIN_EXPORTS__",
  outfile: "dist/index.js",
  external: ["react", "react-dom"],
  jsx: "automatic",
  minify: true,
  footer: {
    js: [
      "if (!window.__PRISM_PLUGINS__) window.__PRISM_PLUGINS__ = {};",
      'const name = document.currentScript?.getAttribute("data-plugin");',
      "if (name) window.__PRISM_PLUGINS__[name] = __PRISM_PLUGIN_EXPORTS__;",
    ].join("\n"),
  },
}).catch(() => process.exit(1));
