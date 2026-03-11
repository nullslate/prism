import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/header";
import { PrismProvider } from "@/components/prism-provider";
import { ToastProvider } from "@/components/toast";

export const Route = createRootRoute({
  component: () => (
    <PrismProvider>
      <ToastProvider>
        <div className="flex flex-col h-screen" style={{ background: "var(--prism-bg)" }}>
          <Header />
          <Outlet />
        </div>
      </ToastProvider>
    </PrismProvider>
  ),
});
