use std::{fs, path::Path};

use axum::http::HeaderValue;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::RuntimeError;

const MIN_TOKEN_CHARACTERS: usize = 43;
const MAX_TOKEN_FILE_BYTES: u64 = 16 * 1024;

#[derive(Clone)]
pub struct SessionToken {
    digest: [u8; 32],
}

impl SessionToken {
    pub fn load(path: &Path) -> Result<Self, RuntimeError> {
        let metadata = fs::metadata(path).map_err(RuntimeError::TokenMetadata)?;
        if !metadata.is_file() {
            return Err(RuntimeError::TokenNotFile);
        }
        if metadata.len() > MAX_TOKEN_FILE_BYTES {
            return Err(RuntimeError::TokenTooLarge);
        }

        let contents = fs::read(path).map_err(RuntimeError::TokenRead)?;
        let token = trim_ascii_whitespace(&contents);
        if token.len() < MIN_TOKEN_CHARACTERS {
            return Err(RuntimeError::TokenTooShort);
        }
        if token.len() as u64 > MAX_TOKEN_FILE_BYTES {
            return Err(RuntimeError::TokenTooLarge);
        }
        if !is_token68(token) {
            return Err(RuntimeError::TokenInvalid);
        }

        Ok(Self {
            digest: Sha256::digest(token).into(),
        })
    }

    pub(crate) fn authorizes(&self, header: Option<&HeaderValue>) -> bool {
        let candidate = header.and_then(bearer_value).unwrap_or_default();
        let candidate_digest: [u8; 32] = Sha256::digest(candidate).into();
        bool::from(self.digest.ct_eq(&candidate_digest))
    }
}

fn bearer_value(value: &HeaderValue) -> Option<&[u8]> {
    let value = value.as_bytes();
    let (scheme, token) = value.split_at_checked(6)?;
    if !scheme.eq_ignore_ascii_case(b"Bearer") || !token.starts_with(b" ") {
        return None;
    }
    Some(&token[1..])
}

fn trim_ascii_whitespace(mut value: &[u8]) -> &[u8] {
    while value.first().is_some_and(u8::is_ascii_whitespace) {
        value = &value[1..];
    }
    while value.last().is_some_and(u8::is_ascii_whitespace) {
        value = &value[..value.len() - 1];
    }
    value
}

fn is_token68(value: &[u8]) -> bool {
    let mut saw_padding = false;
    value.iter().all(|byte| {
        if *byte == b'=' {
            saw_padding = true;
            return true;
        }
        !saw_padding
            && (byte.is_ascii_alphanumeric()
                || matches!(*byte, b'-' | b'.' | b'_' | b'~' | b'+' | b'/'))
    })
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use axum::http::HeaderValue;
    use tempfile::NamedTempFile;

    use super::SessionToken;

    const TOKEN: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    fn token_file(contents: &[u8]) -> NamedTempFile {
        let mut file = NamedTempFile::new().expect("create token file");
        file.write_all(contents).expect("write token file");
        file
    }

    #[test]
    fn accepts_a_256_bit_encoded_token_and_uses_constant_time_digest_comparison() {
        let file = token_file(format!("{TOKEN}\n").as_bytes());
        let token = SessionToken::load(file.path()).expect("valid token");

        let correct = HeaderValue::from_str(&format!("Bearer {TOKEN}")).expect("header");
        let wrong = HeaderValue::from_static(
            "Bearer ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        );
        assert!(token.authorizes(Some(&correct)));
        assert!(!token.authorizes(Some(&wrong)));
        assert!(!token.authorizes(None));
    }

    #[test]
    fn rejects_short_and_malformed_tokens() {
        let short = token_file(b"short");
        let short_error = match SessionToken::load(short.path()) {
            Ok(_) => panic!("short token was accepted"),
            Err(error) => error,
        };
        assert_eq!(short_error.code(), "token_too_short");

        let malformed =
            token_file(b"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abc def");
        let malformed_error = match SessionToken::load(malformed.path()) {
            Ok(_) => panic!("malformed token was accepted"),
            Err(error) => error,
        };
        assert_eq!(malformed_error.code(), "token_invalid");
    }
}
