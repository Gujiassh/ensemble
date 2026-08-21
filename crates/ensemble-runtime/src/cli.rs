use std::path::PathBuf;

use clap::Parser;

#[derive(Debug, Clone, Parser)]
#[command(name = "ensemble-runtime", version, about)]
pub struct Cli {
    /// Directory containing all state owned by this Runtime instance.
    #[arg(long, value_name = "PATH")]
    pub data_root: PathBuf,

    /// File containing the producer-generated bearer token.
    #[arg(long, value_name = "PATH")]
    pub session_token_file: PathBuf,

    /// Atomic bootstrap descriptor written after the listener is ready.
    #[arg(long, value_name = "PATH")]
    pub ready_file: PathBuf,
}
