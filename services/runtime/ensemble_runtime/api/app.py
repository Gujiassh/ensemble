"""FastAPI app — Ensemble Runtime (M2)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from ensemble_runtime.run.registry import get_registry

app = FastAPI(title="Ensemble Runtime", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:17351", "http://localhost:17351"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunStartBody(BaseModel):
    client_op_id: str
    title: str | None = None
    prompt: str | None = None
    template: str = Field(default="four_crew")


class BubbleActBody(BaseModel):
    client_op_id: str
    action: str
    comment: str | None = None


class InjectBody(BaseModel):
    client_op_id: str
    inject_kind: str = "prompt_append"
    text: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/workspaces")
def list_workspaces() -> dict[str, Any]:
    reg = get_registry()
    return {"workspaces": reg.list_workspaces()}


@app.get("/workspaces/{workspace_id}/org")
def get_org(workspace_id: str) -> dict[str, Any]:
    reg = get_registry()
    try:
        org = reg.get_org(workspace_id)
    except KeyError as e:
        raise HTTPException(404, f"workspace not found: {workspace_id}") from e
    return {"workspace_id": workspace_id, "org": org}


@app.get("/workspaces/{workspace_id}/events")
async def events(
    workspace_id: str,
    request: Request,
    after: str | None = Query(default=None),
) -> EventSourceResponse:
    reg = get_registry()
    if workspace_id not in reg.workspaces:
        raise HTTPException(404, f"workspace not found: {workspace_id}")

    async def gen():  # type: ignore[no-untyped-def]
        q = reg.bus.subscribe(workspace_id)
        try:
            for ev in reg.bus.history_after(workspace_id, after):
                if await request.is_disconnected():
                    break
                yield {"event": "message", "data": json.dumps(ev)}
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"event": "message", "data": json.dumps(ev)}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
        finally:
            reg.bus.unsubscribe(workspace_id, q)

    return EventSourceResponse(gen())


@app.post("/workspaces/{workspace_id}/runs")
async def start_run(workspace_id: str, body: RunStartBody) -> dict[str, Any]:
    reg = get_registry()
    try:
        meta = await reg.start_run(
            workspace_id,
            client_op_id=body.client_op_id,
            title=body.title,
            template=body.template,
            prompt=body.prompt,
        )
    except KeyError as e:
        raise HTTPException(404, f"workspace not found: {workspace_id}") from e
    return meta


@app.post("/workspaces/{workspace_id}/runs/{run_id}/bubbles/{bubble_id}/act")
async def bubble_act(
    workspace_id: str,
    run_id: str,
    bubble_id: str,
    body: BubbleActBody,
) -> dict[str, Any]:
    reg = get_registry()
    try:
        return reg.bubble_act(
            workspace_id,
            run_id,
            bubble_id,
            client_op_id=body.client_op_id,
            action=body.action,
            comment=body.comment,
        )
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@app.post("/workspaces/{workspace_id}/runs/{run_id}/seats/{seat_id}/inject")
async def human_inject(
    workspace_id: str,
    run_id: str,
    seat_id: str,
    body: InjectBody,
) -> dict[str, Any]:
    reg = get_registry()
    try:
        return reg.human_inject(
            workspace_id,
            run_id,
            seat_id,
            client_op_id=body.client_op_id,
            inject_kind=body.inject_kind,
            text=body.text,
        )
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@app.get("/workspaces/{workspace_id}/runs/{run_id}/artifacts/{name}")
def get_artifact(workspace_id: str, run_id: str, name: str) -> Any:
    from fastapi.responses import PlainTextResponse

    from ensemble_runtime.persist import store as persist

    if "/" in name or "\\" in name or name in {".", ".."}:
        raise HTTPException(400, "artifact name must be a basename")
    root = (persist.run_dir(workspace_id, run_id) / "artifacts").resolve()
    path = (root / name).resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(400, "artifact path escapes run dir")
    if not path.exists():
        raise HTTPException(404, f"artifact not found: {name}")
    return PlainTextResponse(path.read_text(encoding="utf-8"))
