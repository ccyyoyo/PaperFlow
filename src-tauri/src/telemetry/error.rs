use serde::Serialize;
use thiserror::Error;

pub type IpcResult<T> = Result<T, IpcError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum IpcStatus {
    BadRequest,
    NotFound,
    Conflict,
    IoError,
    DbError,
    Internal,
}

#[derive(Debug, Clone, Serialize, Error)]
#[error("{message}")]
pub struct IpcError {
    pub code: IpcStatus,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl IpcError {
    pub fn new(code: IpcStatus, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

impl From<anyhow::Error> for IpcError {
    fn from(err: anyhow::Error) -> Self {
        Self::new(IpcStatus::Internal, err.to_string())
    }
}
