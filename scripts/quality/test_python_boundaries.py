from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.quality.python_boundaries import evaluate_python_boundaries


def config() -> dict:
    return {
        "roots": [
            {"path": "services/runtime/ensemble_runtime", "module": "ensemble_runtime"},
            {"path": "runners", "module": "runners"},
            {"path": "services/runtime/tests", "module": "tests"},
        ],
        "excludedDirectories": ["__pycache__"],
        "layers": [
            {"name": "composition", "path": "services/runtime/ensemble_runtime/__main__.py"},
            {"name": "api", "path": "services/runtime/ensemble_runtime/api"},
            {"name": "run", "path": "services/runtime/ensemble_runtime/run"},
            {"name": "persist", "path": "services/runtime/ensemble_runtime/persist"},
            {"name": "org", "path": "services/runtime/ensemble_runtime/org"},
            {"name": "ensemble-root", "path": "services/runtime/ensemble_runtime"},
            {"name": "runners", "path": "runners"},
        ],
        "allowedDependencies": {
            "composition": ["composition", "api"],
            "api": ["api", "run", "persist"],
            "run": ["run", "persist", "org", "runners"],
            "persist": ["persist"],
            "org": ["org"],
            "ensemble-root": ["ensemble-root"],
            "runners": ["runners"],
        },
    }


class PythonBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="ensemble-python-boundary-")
        self.root = Path(self.temp.name)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write(self, relative: str, source: str = "") -> None:
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")

    def evaluate(self) -> dict:
        return evaluate_python_boundaries(self.root, config())

    def test_valid_dag(self) -> None:
        self.write("services/runtime/ensemble_runtime/__init__.py")
        self.write("services/runtime/ensemble_runtime/org/__init__.py")
        self.write("services/runtime/ensemble_runtime/org/model.py")
        self.write("services/runtime/ensemble_runtime/persist/__init__.py")
        self.write("services/runtime/ensemble_runtime/run/__init__.py")
        self.write(
            "services/runtime/ensemble_runtime/run/service.py",
            "from ensemble_runtime.org import model\nfrom runners import mock\n",
        )
        self.write("runners/__init__.py")
        self.write("runners/mock/__init__.py")
        result = self.evaluate()
        self.assertTrue(result["ok"], result["errors"])

    def test_runners_cannot_import_runtime(self) -> None:
        self.write("services/runtime/ensemble_runtime/__init__.py")
        self.write("services/runtime/ensemble_runtime/run/__init__.py")
        self.write("runners/__init__.py", "from ensemble_runtime.run import service\n")
        self.write("services/runtime/ensemble_runtime/run/service.py")
        result = self.evaluate()
        self.assertIn("python_forbidden_direction", {item["code"] for item in result["errors"]})

    def test_lower_layer_cannot_import_api(self) -> None:
        self.write("services/runtime/ensemble_runtime/__init__.py")
        self.write("services/runtime/ensemble_runtime/api/__init__.py")
        self.write("services/runtime/ensemble_runtime/api/app.py")
        self.write("services/runtime/ensemble_runtime/persist/__init__.py")
        self.write(
            "services/runtime/ensemble_runtime/persist/store.py",
            "from ensemble_runtime.api import app\n",
        )
        result = self.evaluate()
        self.assertIn("python_forbidden_direction", {item["code"] for item in result["errors"]})

    def test_cycle_fails(self) -> None:
        self.write("services/runtime/ensemble_runtime/__init__.py")
        self.write("services/runtime/ensemble_runtime/run/__init__.py")
        self.write("services/runtime/ensemble_runtime/run/a.py", "from . import b\n")
        self.write("services/runtime/ensemble_runtime/run/b.py", "from . import a\n")
        result = self.evaluate()
        self.assertIn("python_import_cycle", {item["code"] for item in result["errors"]})

    def test_service_production_cannot_import_service_tests(self) -> None:
        self.write("services/runtime/ensemble_runtime/__init__.py")
        self.write("services/runtime/ensemble_runtime/run/__init__.py")
        self.write(
            "services/runtime/ensemble_runtime/run/service.py",
            "from tests import helper\n",
        )
        self.write("services/runtime/tests/helper.py")
        result = self.evaluate()
        self.assertIn(
            "python_production_imports_test",
            {item["code"] for item in result["errors"]},
        )

    def test_runner_production_cannot_import_runner_tests(self) -> None:
        self.write("runners/__init__.py", "from runners.mock import test_helper\n")
        self.write("runners/mock/__init__.py")
        self.write("runners/mock/test_helper.py")
        result = self.evaluate()
        self.assertIn(
            "python_production_imports_test",
            {item["code"] for item in result["errors"]},
        )

    def test_service_test_cycle_fails(self) -> None:
        self.write("services/runtime/tests/a.py", "from tests import b\n")
        self.write("services/runtime/tests/b.py", "from tests import a\n")
        result = self.evaluate()
        self.assertIn("python_import_cycle", {item["code"] for item in result["errors"]})

    def test_unresolved_local_import_fails(self) -> None:
        self.write("runners/__init__.py", "from runners.missing import value\n")
        result = self.evaluate()
        self.assertIn(
            "python_unresolved_local_import",
            {item["code"] for item in result["errors"]},
        )


if __name__ == "__main__":
    unittest.main()
