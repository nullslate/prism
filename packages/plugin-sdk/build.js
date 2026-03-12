import { build } from "esbuild";
import { resolve } from "path";

const entryPoint = process.argv[2] || "src/index.tsx";

build({
  entryPoints: [resolve(entryPoint)],
  bundle: true,
  format: "iife",
  globalName: "__PRISM_PLUGIN_EXPORTS__",
  outfile: "dist/index.js",
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic",
  minify: true,
  banner: {
    js: [
      "var require = (function(modules) {",
      '  return function(name) { return modules[name] || (function() { throw new Error("Cannot find module " + name); })(); };',
      "})({",
      '  "react": window.React,',
      '  "react-dom": window.ReactDOM,',
      '  "react/jsx-runtime": window.__REACT_JSX_RUNTIME__,',
      "});",
    ].join("\n"),
  },
  footer: {
    js: [
      "if (!window.__PRISM_PLUGINS__) window.__PRISM_PLUGINS__ = {};",
      'const name = document.currentScript?.getAttribute("data-plugin");',
      "if (name) window.__PRISM_PLUGINS__[name] = __PRISM_PLUGIN_EXPORTS__;",
    ].join("\n"),
  },
}).catch(() => process.exit(1));
