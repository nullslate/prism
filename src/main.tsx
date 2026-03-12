import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import * as jsxRuntime from "react/jsx-runtime";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Expose React globals for plugin bundles (loaded as IIFE scripts)
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
(window as any).__REACT_JSX_RUNTIME__ = jsxRuntime;

const router = createRouter({ routeTree, history: createHashHistory() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
