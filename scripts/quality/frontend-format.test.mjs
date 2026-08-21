import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateFormatterDebt } from "./frontend-format.mjs";

function withRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensemble-format-debt-"));
  try {
    const file = path.join(root, "preview.tsx");
    fs.writeFileSync(file, "export const Preview=()=> <div />;\n");
    return run(root, file);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function manifest(file, overrides = {}) {
  return {
    version: 1,
    files: [
      {
        path: "preview.tsx",
        owner: "Canvas visual preview owner",
        reason: "Temporary preview is frozen before formatter migration is completed.",
        contentSha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
        reviewBy: "2026-12-31",
        ...overrides,
      },
    ],
  };
}

const config = { maxDebtReviewDays: 180 };
const today = "2026-08-21";

test("exact bounded formatter debt adjudicates one differing file", () =>
  withRoot((root, file) => {
    const result = validateFormatterDebt({
      root,
      config,
      manifest: manifest(file),
      differing: new Set(["preview.tsx"]),
      today,
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.allowed.size, 1);
  }));

test("unlisted, changed, stale, and distant formatter debt fails", () =>
  withRoot((root, file) => {
    const unlisted = validateFormatterDebt({
      root,
      config,
      manifest: { version: 1, files: [] },
      differing: new Set(["preview.tsx"]),
      today,
    });
    assert.ok(unlisted.errors.some((error) => error.code === "frontend_format_required"));

    const changedManifest = manifest(file);
    fs.appendFileSync(file, "// changed\n");
    const changed = validateFormatterDebt({
      root,
      config,
      manifest: changedManifest,
      differing: new Set(["preview.tsx"]),
      today,
    });
    assert.ok(changed.errors.some((error) => error.code === "formatter_debt_content_changed"));

    const stale = validateFormatterDebt({
      root,
      config,
      manifest: manifest(file),
      differing: new Set(),
      today,
    });
    assert.ok(stale.errors.some((error) => error.code === "formatter_debt_stale"));

    const distant = validateFormatterDebt({
      root,
      config,
      manifest: manifest(file, { reviewBy: "2027-03-01" }),
      differing: new Set(["preview.tsx"]),
      today,
    });
    assert.ok(distant.errors.some((error) => error.code === "formatter_debt_review_too_distant"));
  }));
