from __future__ import annotations

import argparse
import ast
import importlib.util
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SourceFile:
    path: Path
    relative_path: str
    module: str
    is_package: bool


def _walk_sources(root: Path, config: dict[str, Any]) -> list[SourceFile]:
    excluded = set(config["excludedDirectories"])
    sources: list[SourceFile] = []
    for configured_root in config["roots"]:
        source_root = root / configured_root["path"]
        if not source_root.exists():
            continue
        for path in sorted(source_root.rglob("*.py")):
            if any(part in excluded for part in path.parts):
                continue
            relative_module = path.relative_to(source_root)
            parts = list(relative_module.parts)
            is_package = parts[-1] == "__init__.py"
            if is_package:
                parts = parts[:-1]
            else:
                parts[-1] = path.stem
            module_parts = [configured_root["module"], *parts]
            sources.append(
                SourceFile(
                    path=path,
                    relative_path=path.relative_to(root).as_posix(),
                    module=".".join(part for part in module_parts if part),
                    is_package=is_package,
                )
            )
    return sources


def _resolve_from_module(source: SourceFile, node: ast.ImportFrom) -> str | None:
    if node.level == 0:
        return node.module
    package = source.module if source.is_package else source.module.rpartition(".")[0]
    relative_name = f"{'.' * node.level}{node.module or ''}"
    try:
        return importlib.util.resolve_name(relative_name, package)
    except (ImportError, ValueError):
        return None


def _imported_modules(source: SourceFile, tree: ast.AST) -> list[tuple[str, bool]]:
    modules: set[tuple[str, bool]] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update((alias.name, True) for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = _resolve_from_module(source, node)
            if base:
                modules.add((base, True))
                modules.update(
                    (f"{base}.{alias.name}", False) for alias in node.names if alias.name != "*"
                )
    return sorted(modules)


def _layer(relative_path: str, config: dict[str, Any]) -> str | None:
    base_name = Path(relative_path).name
    if base_name.startswith("test_") or "/tests/" in f"/{relative_path}":
        return "test"
    layers = sorted(config["layers"], key=lambda item: len(item["path"]), reverse=True)
    for layer in layers:
        layer_path = layer["path"]
        if relative_path == layer_path or relative_path.startswith(f"{layer_path}/"):
            return layer["name"]
    return None


def _cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    index = 0
    indices: dict[str, int] = {}
    low_links: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    result: list[list[str]] = []

    def connect(node: str) -> None:
        nonlocal index
        indices[node] = index
        low_links[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for target in sorted(graph.get(node, set())):
            if target not in graph:
                continue
            if target not in indices:
                connect(target)
                low_links[node] = min(low_links[node], low_links[target])
            elif target in on_stack:
                low_links[node] = min(low_links[node], indices[target])
        if low_links[node] != indices[node]:
            return
        component: list[str] = []
        while True:
            member = stack.pop()
            on_stack.remove(member)
            component.append(member)
            if member == node:
                break
        if len(component) > 1 or node in graph.get(node, set()):
            result.append(sorted(component))

    for node in sorted(graph):
        if node not in indices:
            connect(node)
    return result


def evaluate_python_boundaries(root: Path, config: dict[str, Any]) -> dict[str, Any]:
    sources = _walk_sources(root, config)
    by_module = {source.module: source for source in sources}
    local_prefixes = tuple(item["module"] for item in config["roots"])
    namespace_modules = set(local_prefixes)
    graph: dict[str, set[str]] = {source.relative_path: set() for source in sources}
    errors: list[dict[str, str]] = []
    edge_count = 0

    for source in sources:
        try:
            tree = ast.parse(source.path.read_text(encoding="utf-8"), filename=source.relative_path)
        except SyntaxError as error:
            errors.append(
                {
                    "code": "python_parse_error",
                    "source": source.relative_path,
                    "detail": f"{error.lineno}:{error.offset}",
                }
            )
            continue
        targets: set[str] = set()
        for imported, required in _imported_modules(source, tree):
            target = by_module.get(imported)
            if target:
                if target.relative_path != source.relative_path:
                    targets.add(target.relative_path)
                continue
            if required and imported.startswith(local_prefixes):
                if imported in namespace_modules:
                    continue
                errors.append(
                    {
                        "code": "python_unresolved_local_import",
                        "source": source.relative_path,
                        "target": imported,
                    }
                )
        graph[source.relative_path].update(targets)
        edge_count += len(targets)

        source_layer = _layer(source.relative_path, config)
        if source_layer == "test":
            continue
        allowed = set(config["allowedDependencies"].get(source_layer, []))
        for target_path in targets:
            target_layer = _layer(target_path, config)
            if target_layer == "test":
                errors.append(
                    {
                        "code": "python_production_imports_test",
                        "source": source.relative_path,
                        "target": target_path,
                    }
                )
            elif target_layer and target_layer not in allowed:
                errors.append(
                    {
                        "code": "python_forbidden_direction",
                        "source": source.relative_path,
                        "target": target_path,
                        "detail": f"{source_layer}->{target_layer}",
                    }
                )

    for component in _cycles(graph):
        errors.append({"code": "python_import_cycle", "cycle": "->".join(component)})
    errors.sort(
        key=lambda item: (
            item["code"],
            item.get("source", ""),
            item.get("target", ""),
            item.get("cycle", ""),
        )
    )
    return {
        "ok": not errors,
        "files": len(sources),
        "edges": edge_count,
        "errors": errors,
    }


def _field(key: str, value: Any) -> str:
    return "" if value is None else f" {key}={json.dumps(value, separators=(',', ':'))}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).with_name("quality.config.json"),
    )
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))["pythonBoundaries"]
    result = evaluate_python_boundaries(args.root.resolve(), config)
    for error in result["errors"]:
        print(
            "quality_python_boundary_error"
            + _field("code", error.get("code"))
            + _field("source", error.get("source"))
            + _field("target", error.get("target"))
            + _field("cycle", error.get("cycle"))
            + _field("detail", error.get("detail")),
        )
    print(
        f"quality_python_boundary_summary status={'pass' if result['ok'] else 'fail'}"
        f" files={result['files']} edges={result['edges']} errors={len(result['errors'])}"
    )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
