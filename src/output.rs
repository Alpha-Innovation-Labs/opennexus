//! Output formatting utilities for the CLI.
//!
//! Provides consistent output formatting for success, error, info, and warning messages.
//! Also includes streaming output support for long-running operations.

#![allow(dead_code)]

use std::io::{self, Write};

/// ANSI color codes for terminal output.
mod colors {
    pub const GREEN: &str = "\x1b[32m";
    pub const RED: &str = "\x1b[31m";
    pub const YELLOW: &str = "\x1b[33m";
    pub const BLUE: &str = "\x1b[34m";
    pub const CYAN: &str = "\x1b[36m";
    pub const BOLD: &str = "\x1b[1m";
    pub const DIM: &str = "\x1b[2m";
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

/// Print an error message (red X).
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

/// Print a warning message (yellow).
pub fn print_warning(message: &str) {
    if supports_color() {
        eprintln!(
            "{}{}[WARN]{} {}",
            colors::BOLD,
            colors::YELLOW,
            colors::RESET,
            message
        );
    } else {
        eprintln!("[WARN] {}", message);
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

/// Print a debug message (dim).
pub fn print_debug(message: &str) {
    if supports_color() {
        eprintln!("{}[DEBUG] {}{}", colors::DIM, message, colors::RESET);
    } else {
        eprintln!("[DEBUG] {}", message);
    }
}

/// Print a step in a multi-step process.
pub fn print_step(step: usize, total: usize, message: &str) {
    if supports_color() {
        eprintln!(
            "{}[{}/{}]{} {}",
            colors::CYAN,
            step,
            total,
            colors::RESET,
            message
        );
    } else {
        eprintln!("[{}/{}] {}", step, total, message);
    }
}

/// Streaming output handler for long-running operations.
pub struct StreamingOutput {
    line_count: usize,
    last_line_length: usize,
}

impl StreamingOutput {
    /// Create a new streaming output handler.
    pub fn new() -> Self {
        Self {
            line_count: 0,
            last_line_length: 0,
        }
    }

    /// Write a line of output.
    pub fn write_line(&mut self, line: &str) {
        println!("{}", line);
        self.line_count += 1;
        self.last_line_length = line.len();
    }

    /// Write output without a newline (for progress updates).
    pub fn write_inline(&mut self, text: &str) {
        // Clear the current line and write new text
        print!("\r{}", text);
        let _ = io::stdout().flush();
        self.last_line_length = text.len();
    }

    /// Clear the current inline output.
    pub fn clear_inline(&mut self) {
        if self.last_line_length > 0 {
            print!("\r{}\r", " ".repeat(self.last_line_length));
            let _ = io::stdout().flush();
            self.last_line_length = 0;
        }
    }

    /// Write a progress bar.
    pub fn write_progress(&mut self, current: usize, total: usize, label: &str) {
        let width = 40;
        let filled = (current * width) / total.max(1);
        let empty = width - filled;

        let bar = format!(
            "[{}{}] {}/{} {}",
            "=".repeat(filled),
            " ".repeat(empty),
            current,
            total,
            label
        );

        self.write_inline(&bar);
    }

    /// Finish inline output and move to next line.
    pub fn finish_inline(&mut self) {
        if self.last_line_length > 0 {
            println!();
            self.last_line_length = 0;
        }
    }

    /// Get the number of lines written.
    pub fn line_count(&self) -> usize {
        self.line_count
    }
}

impl Default for StreamingOutput {
    fn default() -> Self {
        Self::new()
    }
}

/// Format a duration in human-readable form.
pub fn format_duration(seconds: u64) -> String {
    if seconds < 60 {
        format!("{}s", seconds)
    } else if seconds < 3600 {
        let mins = seconds / 60;
        let secs = seconds % 60;
        format!("{}m {}s", mins, secs)
    } else {
        let hours = seconds / 3600;
        let mins = (seconds % 3600) / 60;
        format!("{}h {}m", hours, mins)
    }
}

/// Format a file size in human-readable form.
pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes < KB {
        format!("{} B", bytes)
    } else if bytes < MB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else if bytes < GB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    }
}

/// Table formatting for CLI output.
pub struct Table {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    column_widths: Vec<usize>,
}

impl Table {
    /// Create a new table with the given headers.
    pub fn new(headers: Vec<&str>) -> Self {
        let headers: Vec<String> = headers.into_iter().map(|s| s.to_string()).collect();
        let column_widths = headers.iter().map(|h| h.len()).collect();
        Self {
            headers,
            rows: Vec::new(),
            column_widths,
        }
    }

    /// Add a row to the table.
    pub fn add_row(&mut self, row: Vec<&str>) {
        let row: Vec<String> = row.into_iter().map(|s| s.to_string()).collect();

        // Update column widths
        for (i, cell) in row.iter().enumerate() {
            if i < self.column_widths.len() {
                self.column_widths[i] = self.column_widths[i].max(cell.len());
            }
        }

        self.rows.push(row);
    }

    /// Render the table to a string.
    pub fn render(&self) -> String {
        let mut output = String::new();

        // Header row
        let header_line: Vec<String> = self
            .headers
            .iter()
            .enumerate()
            .map(|(i, h)| format!("{:width$}", h, width = self.column_widths[i]))
            .collect();
        output.push_str(&header_line.join(" | "));
        output.push('\n');

        // Separator
        let separator: Vec<String> = self.column_widths.iter().map(|w| "-".repeat(*w)).collect();
        output.push_str(&separator.join("-+-"));
        output.push('\n');

        // Data rows
        for row in &self.rows {
            let line: Vec<String> = row
                .iter()
                .enumerate()
                .map(|(i, cell)| {
                    let width = self.column_widths.get(i).copied().unwrap_or(0);
                    format!("{:width$}", cell, width = width)
                })
                .collect();
            output.push_str(&line.join(" | "));
            output.push('\n');
        }

        output
    }

    /// Print the table to stdout.
    pub fn print(&self) {
        print!("{}", self.render());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(30), "30s");
        assert_eq!(format_duration(90), "1m 30s");
        assert_eq!(format_duration(3661), "1h 1m");
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(500), "500 B");
        assert_eq!(format_size(1500), "1.5 KB");
        assert_eq!(format_size(1_500_000), "1.4 MB");
    }

    #[test]
    fn test_table() {
        let mut table = Table::new(vec!["ID", "Name", "Status"]);
        table.add_row(vec!["001", "Test", "OK"]);
        table.add_row(vec!["002", "Another Test", "Failed"]);

        let output = table.render();
        assert!(output.contains("ID"));
        assert!(output.contains("Name"));
        assert!(output.contains("Another Test"));
    }
}
