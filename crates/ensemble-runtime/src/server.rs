use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;

use crate::auth::SessionToken;

#[derive(Clone)]
struct AppState {
    token: Arc<SessionToken>,
    health: HealthResponse,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    protocol_version: String,
    runtime_version: String,
    status: &'static str,
    pid: u32,
    data_root_digest: String,
}

pub fn router(
    token: SessionToken,
    protocol_version: &str,
    pid: u32,
    data_root_digest: &str,
) -> Router {
    let state = AppState {
        token: Arc::new(token),
        health: HealthResponse {
            protocol_version: protocol_version.to_owned(),
            runtime_version: env!("CARGO_PKG_VERSION").to_owned(),
            status: "ok",
            pid,
            data_root_digest: data_root_digest.to_owned(),
        },
    };

    Router::new()
        .route("/v1/health", get(health))
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(state, authenticate))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(state.health)
}

async fn authenticate(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if state
        .token
        .authorizes(request.headers().get(header::AUTHORIZATION))
    {
        next.run(request).await
    } else {
        (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Bearer")],
        )
            .into_response()
    }
}
