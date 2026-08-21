use std::process::ExitCode;

use clap::Parser;
use ensemble_runtime::{Cli, RuntimeConfig, run_until};

#[tokio::main]
async fn main() -> ExitCode {
    let config = RuntimeConfig::from(Cli::parse());

    match run_until(config, ensemble_runtime::shutdown::shutdown_signal()).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("runtime_failed code={}", error.code());
            ExitCode::FAILURE
        }
    }
}
