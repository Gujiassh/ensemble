import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

async function resolveApplication(): Promise<ReactNode> {
  const params = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && params.has("scenario")) {
    const { VisualHarness } = await import("./test-support/VisualHarness");
    return <VisualHarness params={params} />;
  }
  return <App />;
}

async function renderApplication() {
  const application = await resolveApplication();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{application}</StrictMode>,
  );
}

void renderApplication();
