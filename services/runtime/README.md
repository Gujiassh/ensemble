# Ensemble Runtime

Python orchestrator for Ensemble:

- Workspace / Org tree SSoT
- Stage machine + run store + SSE events
- **CrewAI** projection (`ensemble_runtime.crew`) — locked AI framework
- **FastAPI** + uvicorn + sse-starlette (HTTP/SSE; T017)
- Runner dispatch (mock / pi)

## Stack lock

```text
Org tree (SSoT) → CrewAI (Agent/Task/Crew) → RunnerJob (pi/mock)
```

See `docs/ssot/crewai.md` at repo root.

## Dev

```bash
cd services/runtime
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# CrewAI import smoke
python -c "import crewai; from ensemble_runtime.crew import project_org_to_crew; print('ok', crewai.__version__)"

pytest
```

Env:

| Variable | Values | Default |
|----------|--------|---------|
| `ENSEMBLE_CREWAI_MODE` | `off` \| `mock` \| `live` | `mock` (until live LLM configured) |
| `ENSEMBLE_DATA_DIR` | path | `../../data` or `~/.ensemble` |
| `ENSEMBLE_FORCE_MOCK` | `1` to force mock runner | unset |
| `ENSEMBLE_PI_DRY_RUN` | `1` stub pi artifacts without calling CLI | unset |
| `ENSEMBLE_PI_BIN` | pi binary name/path | `pi` |
| `ENSEMBLE_SINGLE_AGENT_RUNNER` | `pi` to use PiRunner on implement | mock |

## Layout

```text
ensemble_runtime/
  crew/           # CrewAI projection (no tree writes)
  org/            # tree load/save (M3)
  run/            # stage + store (M3)
  api/            # FastAPI + SSE (M2)
```

## M3 single-agent curl

```bash
# health
curl -s http://127.0.0.1:18427/health

# start single-agent run on ws_beta
RUN=$(curl -s -X POST http://127.0.0.1:18427/workspaces/ws_beta/runs \
  -H 'content-type: application/json' \
  -d '{"client_op_id":"op_demo1","template":"single_agent","title":"demo","prompt":"write a plan"}')
echo "$RUN"
RUN_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["run_id"])' <<<"$RUN")

# wait for plan/implement (~0.5s), then read artifacts
sleep 1
curl -s "http://127.0.0.1:18427/workspaces/ws_beta/runs/$RUN_ID/artifacts/01-plan.md"
curl -s "http://127.0.0.1:18427/workspaces/ws_beta/runs/$RUN_ID/artifacts/02-output.md"

# inject prompt, reject gate → rework v2
curl -s -X POST "http://127.0.0.1:18427/workspaces/ws_beta/runs/$RUN_ID/seats/seat_eng/inject" \
  -H 'content-type: application/json' \
  -d '{"client_op_id":"op_inj1","inject_kind":"prompt_append","text":"ADD: prefer async"}'
curl -s -X POST "http://127.0.0.1:18427/workspaces/ws_beta/runs/$RUN_ID/bubbles/b_${RUN_ID}_gate/act" \
  -H 'content-type: application/json' \
  -d '{"client_op_id":"op_rej1","action":"reject","comment":"rework"}'
sleep 1
curl -s "http://127.0.0.1:18427/workspaces/ws_beta/runs/$RUN_ID/artifacts/02-output.v2.md"
```

Artifacts land under `data/workspaces/<ws>/runs/<run_id>/artifacts/` (or `$ENSEMBLE_DATA_DIR`).
