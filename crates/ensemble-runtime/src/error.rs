use std::io;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("the data root could not be created")]
    DataRootCreate(#[source] io::Error),
    #[error("the data root could not be canonicalized")]
    DataRootCanonicalize(#[source] io::Error),
    #[error("the data root is not a directory")]
    DataRootNotDirectory,
    #[error("the datastore lock file could not be opened")]
    DataRootLockOpen(#[source] io::Error),
    #[error("another Runtime owns this data root")]
    DataRootLocked,
    #[error("the datastore lock could not be acquired")]
    DataRootLock(#[source] io::Error),
    #[error("the session token file could not be inspected")]
    TokenMetadata(#[source] io::Error),
    #[error("the session token path is not a regular file")]
    TokenNotFile,
    #[error("the session token file could not be read")]
    TokenRead(#[source] io::Error),
    #[error("the session token does not contain at least 256-bit material")]
    TokenTooShort,
    #[error("the session token is too large")]
    TokenTooLarge,
    #[error("the session token is not a valid bearer-token value")]
    TokenInvalid,
    #[error("the loopback listener could not be bound")]
    ListenerBind(#[source] io::Error),
    #[error("the loopback listener address could not be read")]
    ListenerAddress(#[source] io::Error),
    #[error("the ready descriptor parent is not a directory")]
    ReadyParentInvalid,
    #[error("a ready descriptor temporary file could not be created")]
    ReadyTemporaryCreate(#[source] io::Error),
    #[error("the ready descriptor could not be serialized")]
    ReadySerialize(#[source] serde_json::Error),
    #[error("the ready descriptor could not be flushed")]
    ReadyFlush(#[source] io::Error),
    #[error("the ready descriptor could not be published")]
    ReadyPublish(#[source] io::Error),
    #[error("the ready descriptor could not be inspected during shutdown")]
    ReadyInspect(#[source] io::Error),
    #[error("the ready descriptor could not be parsed during shutdown")]
    ReadyParse(#[source] serde_json::Error),
    #[error("the ready descriptor could not be removed during shutdown")]
    ReadyRemove(#[source] io::Error),
    #[error("the HTTP server stopped unexpectedly")]
    Server(#[source] io::Error),
}

impl RuntimeError {
    pub const fn code(&self) -> &'static str {
        match self {
            Self::DataRootCreate(_) => "data_root_create",
            Self::DataRootCanonicalize(_) => "data_root_canonicalize",
            Self::DataRootNotDirectory => "data_root_not_directory",
            Self::DataRootLockOpen(_) => "data_root_lock_open",
            Self::DataRootLocked => "data_root_locked",
            Self::DataRootLock(_) => "data_root_lock",
            Self::TokenMetadata(_) => "token_metadata",
            Self::TokenNotFile => "token_not_file",
            Self::TokenRead(_) => "token_read",
            Self::TokenTooShort => "token_too_short",
            Self::TokenTooLarge => "token_too_large",
            Self::TokenInvalid => "token_invalid",
            Self::ListenerBind(_) => "listener_bind",
            Self::ListenerAddress(_) => "listener_address",
            Self::ReadyParentInvalid => "ready_parent_invalid",
            Self::ReadyTemporaryCreate(_) => "ready_temporary_create",
            Self::ReadySerialize(_) => "ready_serialize",
            Self::ReadyFlush(_) => "ready_flush",
            Self::ReadyPublish(_) => "ready_publish",
            Self::ReadyInspect(_) => "ready_inspect",
            Self::ReadyParse(_) => "ready_parse",
            Self::ReadyRemove(_) => "ready_remove",
            Self::Server(_) => "server",
        }
    }
}
