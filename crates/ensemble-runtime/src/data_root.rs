use std::{
    fs::{self, File, OpenOptions},
    io,
    path::{Path, PathBuf},
};

use fs2::FileExt;
use sha2::{Digest, Sha256};

use crate::RuntimeError;

const LOCK_FILE_NAME: &str = ".ensemble-runtime.lock";

pub struct LockedDataRoot {
    canonical_path: PathBuf,
    digest: String,
    lock_file: File,
}

impl LockedDataRoot {
    pub fn acquire(path: &Path) -> Result<Self, RuntimeError> {
        fs::create_dir_all(path).map_err(RuntimeError::DataRootCreate)?;
        let canonical_path =
            dunce::canonicalize(path).map_err(RuntimeError::DataRootCanonicalize)?;
        if !canonical_path.is_dir() {
            return Err(RuntimeError::DataRootNotDirectory);
        }

        let lock_path = canonical_path.join(LOCK_FILE_NAME);
        let lock_file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock_path)
            .map_err(RuntimeError::DataRootLockOpen)?;

        match FileExt::try_lock_exclusive(&lock_file) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                return Err(RuntimeError::DataRootLocked);
            }
            Err(error) => return Err(RuntimeError::DataRootLock(error)),
        }

        let digest = digest_path(&canonical_path);
        Ok(Self {
            canonical_path,
            digest,
            lock_file,
        })
    }

    pub fn canonical_path(&self) -> &Path {
        &self.canonical_path
    }

    pub fn digest(&self) -> &str {
        &self.digest
    }
}

impl Drop for LockedDataRoot {
    fn drop(&mut self) {
        let _ = FileExt::unlock(&self.lock_file);
    }
}

fn digest_path(path: &Path) -> String {
    let mut hasher = Sha256::new();

    #[cfg(unix)]
    {
        use std::os::unix::ffi::OsStrExt;
        hasher.update(path.as_os_str().as_bytes());
    }

    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        for unit in path.as_os_str().encode_wide() {
            hasher.update(unit.to_le_bytes());
        }
    }

    #[cfg(not(any(unix, windows)))]
    hasher.update(path.to_string_lossy().as_bytes());

    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::LockedDataRoot;

    #[test]
    fn distinct_roots_have_distinct_non_secret_digests() {
        let temporary = tempdir().expect("temporary directory");
        let first = LockedDataRoot::acquire(&temporary.path().join("first")).expect("first lock");
        let second =
            LockedDataRoot::acquire(&temporary.path().join("second")).expect("second lock");

        assert_ne!(first.digest(), second.digest());
        assert_eq!(first.digest().len(), 64);
        assert!(
            !first
                .digest()
                .contains(first.canonical_path().to_string_lossy().as_ref())
        );
    }
}
