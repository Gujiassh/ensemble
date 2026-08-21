use std::{
    fs::{self, File},
    io::{self, Write},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;

use crate::RuntimeError;

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

pub struct ReadyFileGuard {
    path: PathBuf,
    descriptor: ReadyDescriptor,
    armed: bool,
}

impl ReadyFileGuard {
    pub fn publish(path: PathBuf, descriptor: ReadyDescriptor) -> Result<Self, RuntimeError> {
        let parent = usable_parent(&path)?;
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
            .persist(&path)
            .map_err(|error| RuntimeError::ReadyPublish(error.error))?;
        sync_parent(parent);

        Ok(Self {
            path,
            descriptor,
            armed: true,
        })
    }

    pub fn remove_if_owned(&mut self) -> Result<bool, RuntimeError> {
        if !self.armed {
            return Ok(false);
        }

        let contents = match fs::read(&self.path) {
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

        fs::remove_file(&self.path).map_err(RuntimeError::ReadyRemove)?;
        if let Ok(parent) = usable_parent(&self.path) {
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
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::{ReadyDescriptor, ReadyFileGuard};

    fn descriptor(pid: u32) -> ReadyDescriptor {
        ReadyDescriptor {
            protocol_version: "1".to_owned(),
            pid,
            host: "127.0.0.1".to_owned(),
            port: 32100,
            data_root_digest: "a".repeat(64),
            started_at: "2026-08-20T00:00:00Z".to_owned(),
        }
    }

    #[test]
    fn publishes_complete_json_and_removes_only_its_own_descriptor() {
        let temporary = tempdir().expect("temporary directory");
        let path = temporary.path().join("runtime.ready.json");
        let expected = descriptor(std::process::id());
        let mut guard =
            ReadyFileGuard::publish(path.clone(), expected.clone()).expect("publish descriptor");

        let actual: ReadyDescriptor =
            serde_json::from_slice(&fs::read(&path).expect("read descriptor"))
                .expect("parse descriptor");
        assert_eq!(actual, expected);
        assert!(guard.remove_if_owned().expect("remove owned descriptor"));
        assert!(!path.exists());
    }

    #[test]
    fn preserves_a_replacement_descriptor() {
        let temporary = tempdir().expect("temporary directory");
        let path = temporary.path().join("runtime.ready.json");
        let mut guard = ReadyFileGuard::publish(path.clone(), descriptor(10)).expect("publish");
        fs::write(
            &path,
            serde_json::to_vec(&descriptor(11)).expect("serialize replacement"),
        )
        .expect("replace descriptor");

        assert!(!guard.remove_if_owned().expect("ownership check"));
        assert!(path.exists());
    }
}
