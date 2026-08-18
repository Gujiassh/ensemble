mod runtime;

use runtime::RuntimeSupervisor;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

fn resolve_repo_root() -> PathBuf {
    // Dev: CARGO_MANIFEST_DIR = <repo>/src-tauri → parent is repo root.
    // Packaged: walk ancestors from the executable looking for services/runtime.
    let from_manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(parent) = from_manifest.parent() {
        let marker = parent.join("services/runtime");
        if marker.is_dir() {
            return parent.to_path_buf();
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for ancestor in dir.ancestors().take(6) {
                if ancestor.join("services/runtime").is_dir() {
                    return ancestor.to_path_buf();
                }
            }
        }
    }

    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
fn runtime_status(state: tauri::State<'_, Arc<RuntimeSupervisor>>) -> runtime::RuntimeStatus {
    state.status()
}

#[tauri::command]
fn runtime_restart(
    state: tauri::State<'_, Arc<RuntimeSupervisor>>,
) -> Result<runtime::RuntimeStatus, String> {
    state.restart()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let repo_root = resolve_repo_root();
    eprintln!(
        "[ensemble-shell] repo_root={} data={}",
        repo_root.display(),
        repo_root.join("data").display()
    );

    let supervisor = Arc::new(RuntimeSupervisor::new(repo_root));

    tauri::Builder::default()
        .manage(supervisor.clone())
        .invoke_handler(tauri::generate_handler![runtime_status, runtime_restart])
        .setup(move |app| {
            let supervisor = supervisor.clone();
            match supervisor.ensure_started() {
                Ok(status) => {
                    eprintln!(
                        "[ensemble-shell] runtime ready healthy={} owned={} pid={:?} detail={}",
                        status.healthy, status.owned, status.pid, status.detail
                    );
                }
                Err(err) => {
                    eprintln!("[ensemble-shell] runtime start failed: {err}");
                }
            }

            if let Some(window) = app.get_webview_window("main") {
                let supervisor_on_close = supervisor.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        supervisor_on_close.shutdown();
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Ensemble")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. } => {
                    if let Some(sup) = app_handle.try_state::<Arc<RuntimeSupervisor>>() {
                        sup.shutdown();
                    }
                }
                _ => {}
            }
        });
}
