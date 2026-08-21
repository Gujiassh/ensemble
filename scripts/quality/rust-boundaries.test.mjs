import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateRustBoundaries } from "./rust-boundaries.mjs";

function config() {
  return {
    rustBoundaries: {
      roots: ["crates/runtime/src"],
      layers: ["domain", "application", "infrastructure", "adapter"],
      allowedDependencies: {
        domain: ["domain"],
        application: ["application", "domain"],
        infrastructure: ["infrastructure", "domain"],
        adapter: ["adapter", "domain"],
      },
    },
  };
}

function withRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensemble-rust-boundary-"));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, relativePath, source) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

test("flat bootstrap is explicitly not applicable", () =>
  withRoot((root) => {
    write(root, "crates/runtime/src/lib.rs", "pub fn bootstrap() {}\n");
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.equal(result.ok, true);
    assert.equal(result.notApplicable, true);
    assert.equal(result.activeFiles, 0);
  }));

test("application may depend on domain", () =>
  withRoot((root) => {
    write(root, "crates/runtime/src/application/service.rs", "use crate::domain::Model;\n");
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.equal(result.ok, true);
    assert.equal(result.notApplicable, false);
  }));

test("domain cannot depend on infrastructure", () =>
  withRoot((root) => {
    write(root, "crates/runtime/src/domain/model.rs", "use crate::infrastructure::Db;\n");
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.detail === "domain->infrastructure"));
  }));

test("grouped imports enforce each planned layer", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/model.rs",
      "use crate::{domain::Id, adapter::Gateway};\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.detail === "domain->adapter"));
  }));

test("comments and strings do not create fake dependencies", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/model.rs",
      '// use crate::infrastructure::Db;\nconst TEXT: &str = "crate::adapter::Gateway";\n',
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.equal(result.ok, true);
    assert.equal(result.references, 0);
  }));

test("self paths resolve within the source layer", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/nested.rs",
      "use self::helper::Id;\nfn value() { let _ = self::helper::VALUE; }\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.equal(result.ok, true);
    assert.equal(result.references, 1);
  }));

test("multi-super paths resolve from nested source modules", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/nested.rs",
      "use super::super::infrastructure::Db;\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.detail === "domain->infrastructure"));
  }));

test("relative grouped imports and aliases cannot hide forbidden layers", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/nested.rs",
      "use super::super::{domain::{Id}, infrastructure::{Db as Database}};\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.detail === "domain->infrastructure"));
  }));

test("qualified paths outside use declarations are enforced", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/model.rs",
      "fn load() { let _ = crate::adapter::Gateway; }\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.detail === "domain->adapter"));
  }));

test("relative paths above crate root fail conservatively", () =>
  withRoot((root) => {
    write(
      root,
      "crates/runtime/src/domain/model.rs",
      "use super::super::super::infrastructure::Db;\n",
    );
    const result = evaluateRustBoundaries({ root, config: config() });
    assert.ok(result.errors.some((error) => error.code === "rust_ambiguous_relative_path"));
  }));
