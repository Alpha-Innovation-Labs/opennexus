//! Output formatting utilities for the setup-only CLI.

/// ANSI color codes for terminal output.
mod colors {
    pub const GREEN: &str = "\x1b[32m";
    pub const RED: &str = "\x1b[31m";
    pub const BLUE: &str = "\x1b[34m";
    pub const BOLD: &str = "\x1b[1m";
    pub const RESET: &str = "\x1b[0m";
}

/// Check if the terminal supports colors.
fn supports_color() -> bool {
    // Simple check - in production, use a crate like `supports-color`
    std::env::var("NO_COLOR").is_err() && std::env::var("TERM").map(|t| t != "dumb").unwrap_or(true)
}

/// Print a success message (green checkmark).
pub fn print_success(message: &str) {
    if supports_color() {
        eprintln!(
            "{}{}[OK]{} {}",
            colors::BOLD,
            colors::GREEN,
            colors::RESET,
            message
        );
    } else {
        eprintln!("[OK] {}", message);
    }
}

/// Print an info message (blue).
pub fn print_info(message: &str) {
    if supports_color() {
        eprintln!(
            "{}{}[INFO]{} {}",
            colors::BOLD,
            colors::BLUE,
            colors::RESET,
            message
        );
    } else {
        eprintln!("[INFO] {}", message);
    }
}

/// Print an error message (red).
pub fn print_error(message: &str) {
    if supports_color() {
        eprintln!(
            "{}{}[ERROR]{} {}",
            colors::BOLD,
            colors::RED,
            colors::RESET,
            message
        );
    } else {
        eprintln!("[ERROR] {}", message);
    }
}
