import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { PrismProvider } from "@/components/prism-provider";

export const Route = createRootRoute({
  component: () => (
    <PrismProvider>
      <div className="flex flex-col h-screen" style={{ background: "var(--prism-bg)" }}>
        <Header />
        <Outlet />
      </div>
    </PrismProvider>
  ),
});
