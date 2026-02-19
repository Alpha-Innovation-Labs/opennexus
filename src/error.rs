//! Error types for the Nexus CLI.
//!
//! This module provides dedicated error types for CLI operations,
//! enabling better error handling and user-friendly error messages.

use thiserror::Error;

/// Errors that can occur during CLI operations.
#[derive(Debug, Error)]
pub enum CliError {
    /// Context not found.
    #[error("Context not found: {0}")]
    ContextNotFound(String),

    /// Project not found.
    #[error("Project not found: {0}")]
    ProjectNotFound(String),

    /// Project already exists.
    #[error("Project already exists: {0}")]
    ProjectAlreadyExists(String),

    /// Context already exists.
    #[error("Context already exists: {0}")]
    ContextAlreadyExists(String),

    /// Invalid context ID format.
    #[error("Invalid context ID format: {0}. Expected format: PREFIX_NNN")]
    InvalidContextId(String),

    /// Invalid project name.
    #[error("Invalid project name: {0}")]
    InvalidProjectName(String),

    /// Setup failed.
    #[error("Setup failed: {0}")]
    SetupFailed(String),

    /// Server not running.
    #[error("Server is not running. Start it with 'nexus server start'")]
    ServerNotRunning,

    /// Server connection failed.
    #[error("Failed to connect to server: {0}")]
    ServerConnectionFailed(String),

    /// Workflow not found.
    #[error("Workflow not found: {0}")]
    WorkflowNotFound(String),

    /// Workflow execution failed.
    #[error("Workflow execution failed: {0}")]
    WorkflowExecutionFailed(String),

    /// User cancelled operation.
    #[error("Operation cancelled by user")]
    UserCancelled,

    /// File operation failed.
    #[error("File operation failed: {0}")]
    FileOperationFailed(String),

    /// IO error.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON serialization/deserialization error.
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// Configuration error.
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// Client error from nexus-client.
    #[error("Client error: {0}")]
    Client(#[from] nexus_client::ClientError),
}

/// Result type alias for CLI operations.
pub type CliResult<T> = Result<T, CliError>;

impl CliError {
    /// Check if the error is retryable.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            CliError::ServerNotRunning | CliError::ServerConnectionFailed(_)
        )
    }

    /// Get a user-friendly suggestion for fixing the error.
    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            CliError::ServerNotRunning => Some("Try running 'nexus server start' first"),
            CliError::ServerConnectionFailed(_) => {
                Some("Check if the server is running with 'nexus server status'")
            }
            CliError::ContextNotFound(_) => {
                Some("Use 'nexus context list' to see available contexts")
            }
            CliError::ProjectNotFound(_) => {
                Some("Use 'nexus project list' to see available projects")
            }
            CliError::WorkflowNotFound(_) => {
                Some("Use 'nexus workflow list' to see available workflows")
            }
            CliError::InvalidContextId(_) => {
                Some("Context IDs should be in the format PREFIX_NNN (e.g., CLI_001)")
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = CliError::ContextNotFound("CLI_999".to_string());
        assert_eq!(err.to_string(), "Context not found: CLI_999");
    }

    #[test]
    fn test_is_retryable() {
        assert!(CliError::ServerNotRunning.is_retryable());
        assert!(CliError::ServerConnectionFailed("timeout".to_string()).is_retryable());
        assert!(!CliError::ContextNotFound("CLI_001".to_string()).is_retryable());
    }

    #[test]
    fn test_suggestion() {
        assert!(CliError::ServerNotRunning.suggestion().is_some());
        assert!(CliError::ContextNotFound("CLI_001".to_string())
            .suggestion()
            .is_some());
        assert!(CliError::UserCancelled.suggestion().is_none());
    }
}
