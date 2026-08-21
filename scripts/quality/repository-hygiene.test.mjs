import assert from "node:assert/strict";
import test from "node:test";

import { scanText } from "./repository-hygiene.mjs";

test("clean text passes", () => {
  assert.deepEqual(scanText("clean.ts", "const value = 1;\n"), []);
});

test("Markdown two-space hard breaks are semantic, not whitespace debt", () => {
  assert.deepEqual(scanText("notes.md", "first line  \nsecond line\n"), []);
});

test("trailing spaces and tabs fail with line numbers", () => {
  const errors = scanText("dirty.ts", "const a = 1;  \nconst b = 2;\t\n");
  assert.deepEqual(errors, [
    { code: "trailing_whitespace", path: "dirty.ts", line: 1 },
    { code: "trailing_whitespace", path: "dirty.ts", line: 2 },
  ]);
});

test("merge conflict markers fail", () => {
  const errors = scanText(
    "conflict.ts",
    ["<<<<<<< ours", "const value = 1;", "=======", ">>>>>>> theirs", ""].join("\n"),
  );
  assert.deepEqual(
    errors.map((error) => error.code),
    ["conflict_marker", "conflict_marker", "conflict_marker"],
  );
});

test("binary content is ignored", () => {
  assert.deepEqual(scanText("image.bin", "abc\0def  \n<<<<<<< ours"), []);
});
