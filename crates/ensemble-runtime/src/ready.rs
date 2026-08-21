use std::{
    ffi::OsString,
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

use fs2::FileExt;
use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

use crate::RuntimeError;

const READY_LEASE_SUFFIX: &str = ".ensemble-runtime-ready.lock";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadyDescriptor {
    pub protocol_version: String,
    pub pid: u32,
    pub host: String,
    pub port: u16,
    pub data_root_digest: String,
    pub started_at: String,
}

pub(crate) struct ReadyPathLease {
    ready_path: PathBuf,
    lock_file: File,
}

impl ReadyPathLease {
    pub(crate) fn acquire(path: &Path, canonical_data_root: &Path) -> Result<Self, RuntimeError> {
        let parent = usable_parent(path)?;
        let canonical_parent =
            dunce::canonicalize(parent).map_err(RuntimeError::ReadyParentCanonicalize)?;
        let file_name = path.file_name().ok_or(RuntimeError::ReadyPathInvalid)?;
        if file_name
            .to_string_lossy()
            .to_ascii_lowercase()
            .ends_with(READY_LEASE_SUFFIX)
        {
            return Err(RuntimeError::ReadyPathInvalid);
        }

        let ready_path = canonical_parent.join(file_name);
        if ready_path == canonical_data_root || ready_path.starts_with(canonical_data_root) {
            return Err(RuntimeError::ReadyInsideDataRoot);
        }

        let mut lease_file_name = OsString::from(file_name);
        lease_file_name.push(READY_LEASE_SUFFIX);
        let lease_path = canonical_parent.join(lease_file_name);
        let lock_file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&lease_path)
            .map_err(RuntimeError::ReadyLeaseOpen)?;
        match FileExt::try_lock_exclusive(&lock_file) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                return Err(RuntimeError::ReadyPathLocked);
            }
            Err(error) => return Err(RuntimeError::ReadyLease(error)),
        }

        Ok(Self {
            ready_path,
            lock_file,
        })
    }
}

impl Drop for ReadyPathLease {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.lock_file);
    }
}

pub(crate) struct ReadyFileGuard {
    lease: ReadyPathLease,
    descriptor: ReadyDescriptor,
    armed: bool,
}

impl ReadyFileGuard {
    pub(crate) fn publish(
        lease: ReadyPathLease,
        descriptor: ReadyDescriptor,
    ) -> Result<Self, RuntimeError> {
        let parent = usable_parent(&lease.ready_path)?;
        let mut temporary =
            NamedTempFile::new_in(parent).map_err(RuntimeError::ReadyTemporaryCreate)?;
        serde_json::to_writer(temporary.as_file_mut(), &descriptor)
            .map_err(RuntimeError::ReadySerialize)?;
        temporary
            .as_file_mut()
            .write_all(b"\n")
            .map_err(RuntimeError::ReadyFlush)?;
        temporary
            .as_file_mut()
            .sync_all()
            .map_err(RuntimeError::ReadyFlush)?;
        temporary
            .persist(&lease.ready_path)
            .map_err(|error| RuntimeError::ReadyPublish(error.error))?;
        sync_parent(parent);

        Ok(Self {
            lease,
            descriptor,
            armed: true,
        })
    }

    pub(crate) fn remove_if_owned(&mut self) -> Result<bool, RuntimeError> {
        if !self.armed {
            return Ok(false);
        }

        let contents = match fs::read(&self.lease.ready_path) {
            Ok(contents) => contents,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                self.armed = false;
                return Ok(false);
            }
            Err(error) => return Err(RuntimeError::ReadyInspect(error)),
        };
        let current: ReadyDescriptor =
            serde_json::from_slice(&contents).map_err(RuntimeError::ReadyParse)?;
        if current != self.descriptor {
            self.armed = false;
            return Ok(false);
        }

        fs::remove_file(&self.lease.ready_path).map_err(RuntimeError::ReadyRemove)?;
        if let Ok(parent) = usable_parent(&self.lease.ready_path) {
            sync_parent(parent);
        }
        self.armed = false;
        Ok(true)
    }
}

impl Drop for ReadyFileGuard {
    fn drop(&mut self) {
        let _ = self.remove_if_owned();
    }
}

fn usable_parent(path: &Path) -> Result<&Path, RuntimeError> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    if !parent.is_dir() {
        return Err(RuntimeError::ReadyParentInvalid);
    }
    Ok(parent)
}

#[cfg(unix)]
fn sync_parent(parent: &Path) {
    if let Ok(directory) = File::open(parent) {
        let _ = directory.sync_all();
    }
}

#[cfg(not(unix))]
fn sync_parent(_parent: &Path) {}

#[cfg(test)]
mod tests;
