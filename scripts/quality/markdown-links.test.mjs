import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateMarkdownLinks } from "./markdown-links.mjs";

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensemble-links-"));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

test("local Markdown targets resolve relative to their source file", () =>
  withTempRoot((root) => {
    write(root, "docs/target.md", "# Target\n");
    write(root, "docs/index.md", "[target](target.md#heading)\n");
    const result = evaluateMarkdownLinks(root);
    assert.equal(result.ok, true);
    assert.equal(result.links, 1);
  }));

test("missing local targets fail while fenced examples and URLs are ignored", () =>
  withTempRoot((root) => {
    write(
      root,
      "README.md",
      [
        "[missing](docs/missing.md)",
        "[external](https://example.test/docs)",
        "```md",
        "[example](not-a-real-file.md)",
        "```",
      ].join("\n"),
    );
    const result = evaluateMarkdownLinks(root);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      {
        code: "missing_local_target",
        source: "README.md",
        target: "docs/missing.md",
      },
    ]);
  }));


test("runtime data and tool caches do not become documentation inputs", () =>
  withTempRoot((root) => {
    write(root, "README.md", "[external](https://example.test)\n");
    write(root, "data/workspaces/run/artifact.md", "[missing](generated.md)\n");
    write(root, ".pytest_cache/README.md", "[missing](cache.md)\n");
    const result = evaluateMarkdownLinks(root);
    assert.equal(result.ok, true);
    assert.equal(result.files, 1);
    assert.equal(result.links, 0);
  }));
