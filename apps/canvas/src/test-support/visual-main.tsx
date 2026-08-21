import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { VisualHarness } from "./VisualHarness";

const params = new URLSearchParams(window.location.search);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VisualHarness params={params} />
  </StrictMode>,
);
