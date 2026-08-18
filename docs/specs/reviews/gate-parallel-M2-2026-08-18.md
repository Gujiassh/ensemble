# Parallel Gate M2

- date: 2026-08-18
- main_controller: main-session
- G1 evidence: docs/specs/reviews/M1-canvas-2026-08-18.md · ACCEPT
- G2 protocol path: packages/protocol only (FAIL if apps/canvas/src/protocol exists as SSoT)
- lanes:
  - name: runtime
    worktree: (same tree; Main serial bootstrap then may split)
    write_globs: [services/runtime/**, data/**]
    deny_globs: [apps/canvas/**, src-tauri/**, packages/protocol/**]
    audit_required: yes
  - name: canvas-wire
    worktree: (same tree after runtime HTTP smoke)
    write_globs: [apps/canvas/**]
    deny_globs: [services/runtime/**, src-tauri/**]
    audit_required: yes
- integration_audit_required: yes
- note: First M2 slice implemented in-session without separate worktrees; ownership still respected by file paths.
