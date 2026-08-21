from __future__ import annotations

import unittest

from scripts.quality.validate_config import validate_workflow_text


class WorkflowValidationTests(unittest.TestCase):
    def test_valid_pinned_workflow(self) -> None:
        workflow = """
name: Quality
on: [push]
jobs:
  quality:
    steps:
      - uses: actions/checkout@1111111111111111111111111111111111111111
      - run: pnpm quality
"""
        self.assertEqual(validate_workflow_text(workflow), [])

    def test_mutable_action_tag_fails(self) -> None:
        workflow = """
name: Quality
jobs:
  quality:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm quality
"""
        self.assertIn(
            "workflow_action_unpinned:actions/checkout@v4",
            validate_workflow_text(workflow),
        )

    def test_invalid_yaml_fails(self) -> None:
        self.assertEqual(validate_workflow_text("jobs: [unterminated"), ["workflow_yaml_syntax"])


if __name__ == "__main__":
    unittest.main()
