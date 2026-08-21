import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  countCodeLines,
  evaluateSourceShape,
} from "./source-shape.mjs";

const SCRIPT_PATH = fileURLToPath(new URL("./source-shape.mjs", import.meta.url));
const TODAY = "2026-08-21";

function config() {
  return {
    version: 1,
    shape: {
      sourceRoots: ["src"],
      excludedDirectories: ["node_modules", "dist", "target"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".rs", ".py"],
      generatedDirectoryNames: ["generated"],
      generatedFileNames: [],
      generatedNameFragments: [".generated."],
      trustedGeneratedPaths: ["src/vite-env.d.ts"],
      generatedHeaderLines: 8,
      generatedDirectiveVersion: 1,
      declarativePaths: ["src/tokens.ts"],
      localizationDirectoryNames: ["locales"],
      testDirectoryNames: ["test-support", "fixtures", "tests"],
      maxExceptionReviewDays: 180,
      maxSoftReviewDays: 180,
      maxExceptionGrowthRatio: 1.25,
      roles: {
        "react-component": { soft: 250, review: 450 },
        "react-hook": { soft: 160, review: 320 },
        "typescript-logic": { soft: 300, review: 600 },
        "rust-module": { soft: 220, review: 500 },
        stylesheet: { soft: 500, review: 1000 },
        "test-preview": { soft: 350, review: 750 },
        localization: { soft: 600, review: 1200 },
        "declarative-data": { soft: 600, review: 1200 },
        "python-module": { soft: 300, review: 600 },
        "python-test": { soft: 400, review: 800 },
      },
    },
  };
}

function emptyManifest() {
  return { version: 1, exceptions: [] };
}

function emptyReviews() {
  return { version: 1, reviews: [] };
}

function softReview(path, role, reviewedCodeLines, overrides = {}) {
  return {
    path,
    role,
    owner: "Canvas component responsibility owner",
    responsibility: "Renders one bounded component responsibility without persistence decisions.",
    decision: "accept-cohesive",
    rationale: "The current warning remains cohesive and has focused verification coverage.",
    trigger: "Re-review before any code-line growth or additional responsibility is introduced.",
    reviewedCodeLines,
    reviewBy: "2026-12-31",
    ...overrides,
  };
}

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ensemble-shape-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeLines(root, relativePath, count, statement = "const value = 1;") {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${Array(count).fill(statement).join("\n")}\n`);
}

test("code line counting excludes comment-only and blank lines consistently", () => {
  const source = [
    "// comment",
    "const url = 'https://example.test';",
    "",
    "/* block",
    " * comment",
    " */",
    "const value = 1; /* trailing comment */",
  ].join("\n");
  assert.equal(countCodeLines(source), 2);
});

test("Python counting ignores comments and conservatively counts docstrings", () => {
  const source = [
    "# comment only",
    '"""Module docs',
    "# docstring content",
    '"""',
    "value = 1  # trailing comment",
    "",
  ].join("\n");
  assert.equal(countCodeLines(source, "python-module"), 4);
});

test("Python module and test thresholds are classified independently", () =>
  withTempRoot((root) => {
    writeLines(root, "src/runtime.py", 301, "value = 1");
    writeLines(root, "src/runner/test_runtime.py", 801, "assert True");

    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      today: TODAY,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.warnings.map((warning) => warning.role),
      ["python-module"],
    );
    assert.ok(
      result.errors.some(
        (error) =>
          error.code === "review_threshold_exceeded" && error.role === "python-test",
      ),
    );
  }));

test("adaptive TSX, TS, Rust, CSS, and test thresholds are independent", () =>
  withTempRoot((root) => {
    writeLines(root, "src/Component.tsx", 251, "export const C = () => <div />;");
    writeLines(root, "src/logic.ts", 601);
    writeLines(root, "src/runtime.rs", 501, "fn value() -> usize { 1 }");
    writeLines(root, "src/styles.css", 1001, ".item { color: red; }");
    writeLines(root, "src/test-support/Preview.tsx", 751, "export const x = 1;");

    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      today: TODAY,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.warnings.map((warning) => warning.role),
      ["react-component"],
    );
    assert.deepEqual(
      result.errors
        .filter((error) => error.code === "review_threshold_exceeded")
        .map((error) => error.role)
        .sort(),
      ["rust-module", "stylesheet", "test-preview", "typescript-logic"],
    );
  }));

test("a complete cohesive exception can authorize one bounded exceedance", () =>
  withTempRoot((root) => {
    writeLines(root, "src/logic.ts", 601);
    const manifest = {
      version: 1,
      exceptions: [
        {
          path: "src/logic.ts",
          role: "typescript-logic",
          owner: "runtime-team",
          rationale: "The parser table is reviewed as one bounded implementation.",
          cohesion: "Splitting the mutually recursive productions would obscure invariants.",
          maxCodeLines: 650,
          reviewBy: "2026-12-31",
        },
      ],
    };
    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest,
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.equal(result.exceptionsUsed, 1);
  }));

test("exception validation rejects incomplete, distant, missing, stale, and mismatched records", () =>
  withTempRoot((root) => {
    writeLines(root, "src/small.ts", 2);
    writeLines(root, "src/large.ts", 601);
    const base = {
      role: "typescript-logic",
      owner: "runtime-team",
      rationale: "The implementation remains intentionally bounded and cohesive.",
      cohesion: "All entries participate in one validated lookup table invariant.",
      maxCodeLines: 650,
      reviewBy: "2026-12-31",
    };
    const cases = [
      [{ ...base, path: "src/large.ts", cohesion: "" }, "exception_schema"],
      [{ ...base, path: "src/large.ts", reviewBy: "2099-02-30" }, "exception_schema"],
      [
        { ...base, path: "src/large.ts", reviewBy: "2027-03-01" },
        "exception_review_too_distant",
      ],
      [{ ...base, path: "src/missing.ts" }, "exception_missing_file"],
      [{ ...base, path: "src/small.ts" }, "exception_stale"],
      [{ ...base, path: "src/large.ts", role: "rust-module" }, "exception_role_mismatch"],
      [
        { ...base, path: "src/large.ts", maxCodeLines: 999999 },
        "exception_disproportionate_ceiling",
      ],
    ];

    for (const [record, expectedCode] of cases) {
      const result = evaluateSourceShape({
        root,
        config: config(),
        manifest: { version: 1, exceptions: [record] },
        today: TODAY,
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((error) => error.code === expectedCode));
    }
  }));

test("a bounded exact soft-warning review adjudicates without raising the LOC limit", () =>
  withTempRoot((root) => {
    writeLines(root, "src/Component.tsx", 251, "export const C = () => <div />;");
    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      reviewsManifest: {
        version: 1,
        reviews: [softReview("src/Component.tsx", "react-component", 251)],
      },
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.softReviewsUsed, 1);
  }));

test("soft reviews fail when distant, mismatched, size-changed, stale, or absent", () =>
  withTempRoot((root) => {
    writeLines(root, "src/Component.tsx", 251, "export const C = () => <div />;");
    const cases = [
      [emptyReviews(), "soft_warning_unreviewed"],
      [{ version: 1, reviews: [softReview("src/Component.tsx", "react-hook", 251)] }, "soft_review_role_mismatch"],
      [{ version: 1, reviews: [softReview("src/Component.tsx", "react-component", 250)] }, "soft_review_size_changed"],
      [{ version: 1, reviews: [softReview("src/Component.tsx", "react-component", 251, { reviewBy: "2027-03-01" })] }, "soft_review_too_distant"],
    ];
    for (const [reviewsManifest, code] of cases) {
      const result = evaluateSourceShape({
        root,
        config: config(),
        manifest: emptyManifest(),
        reviewsManifest,
        today: TODAY,
      });
      assert.ok(result.errors.some((error) => error.code === code));
    }

    writeLines(root, "src/Component.tsx", 2, "export const C = () => <div />;");
    const stale = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      reviewsManifest: {
        version: 1,
        reviews: [softReview("src/Component.tsx", "react-component", 251)],
      },
      today: TODAY,
    });
    assert.ok(stale.errors.some((error) => error.code === "soft_review_stale"));
  }));

test("generated candidates require provenance while trusted exact files do not", () =>
  withTempRoot((root) => {
    const generated = path.join(root, "src/generated/client.ts");
    fs.mkdirSync(path.dirname(generated), { recursive: true });
    fs.writeFileSync(
      generated,
      `// @generated\n${Array(1999).fill("const value = 1;").join("\n")}\n`,
    );
    writeLines(root, "src/vite-env.d.ts", 2000);
    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      reviewsManifest: emptyReviews(),
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.equal(result.ignoredGenerated, 2);
    assert.equal(result.files.length, 0);
  }));

test("hand-authored code hidden under generated paths is enforced", () =>
  withTempRoot((root) => {
    const hidden = path.join(root, "src/generated/client.ts");
    fs.mkdirSync(path.dirname(hidden), { recursive: true });
    fs.writeFileSync(
      hidden,
      `const claimed = "@generated";\n${Array(4999).fill("const value = 1;").join("\n")}\n`,
    );
    const result = evaluateSourceShape({
      root,
      config: config(),
      manifest: emptyManifest(),
      reviewsManifest: emptyReviews(),
      today: TODAY,
    });
    assert.equal(result.ignoredGenerated, 0);
    assert.ok(
      result.errors.some(
        (error) =>
          error.code === "review_threshold_exceeded" &&
          error.path === "src/generated/client.ts",
      ),
    );
  }));

test("CLI exits non-zero and emits flat diagnostics on gate failure", () =>
  withTempRoot((root) => {
    writeLines(root, "src/logic.ts", 601);
    const configPath = path.join(root, "config.json");
    const exceptionsPath = path.join(root, "exceptions.json");
    const reviewsPath = path.join(root, "reviews.json");
    fs.writeFileSync(configPath, JSON.stringify(config()));
    fs.writeFileSync(exceptionsPath, JSON.stringify(emptyManifest()));
    fs.writeFileSync(reviewsPath, JSON.stringify(emptyReviews()));

    const result = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--root",
        root,
        "--config",
        configPath,
        "--exceptions",
        exceptionsPath,
        "--reviews",
        reviewsPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /quality_shape_error code="review_threshold_exceeded"/);
    assert.match(result.stdout, /quality_shape_summary status=fail/);
  }));
