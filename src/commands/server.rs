//! Server management commands.
//!
//! Commands for starting, stopping, and checking the status of the Nexus server.

use anyhow::{Context, Result};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success};

/// Default port for the Nexus server.
const DEFAULT_PORT: u16 = 7420;

/// Default host for the Nexus server.
const DEFAULT_HOST: &str = "127.0.0.1";

/// Start the Nexus server.
///
/// If `foreground` is false, the server is daemonized.
pub async fn run_server_start(foreground: bool, port: u16, format: OutputFormat) -> Result<()> {
    // Check if server is already running
    if is_server_running(Some(port)) {
        if format == OutputFormat::Json {
            println!(r#"{{"status": "already_running", "message": "Server is already running"}}"#);
        } else {
            print_info("Server is already running");
        }
        return Ok(());
    }

    if foreground {
        // Run in foreground - just exec the server binary
        if format == OutputFormat::Json {
            println!(
                r#"{{"status": "starting", "port": {}, "foreground": true}}"#,
                port
            );
        } else {
            print_info(&format!(
                "Starting Nexus server on port {} (foreground)...",
                port
            ));
        }

        let status = Command::new("nexus-server")
            .args(["--port", &port.to_string()])
            .status()
            .context("Failed to start nexus-server. Is it installed?")?;

        if !status.success() {
            print_error("Server exited with error");
            std::process::exit(1);
        }
    } else {
        // Daemonize the server
        if format == OutputFormat::Json {
            println!(
                r#"{{"status": "starting", "port": {}, "foreground": false}}"#,
                port
            );
        } else {
            print_info(&format!(
                "Starting Nexus server on port {} (daemon)...",
                port
            ));
        }

        let server_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.join("nexus-server")))
            .unwrap_or_else(|| std::path::PathBuf::from("nexus-server"));

        let child = Command::new("sh")
            .args([
                "-c",
                &format!(
                    "nohup {} --port {} --daemon > /dev/null 2>&1 & echo $!",
                    server_path.display(),
                    port
                ),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .context("Failed to start nexus-server. Is it installed?")?;

        let pid = child.id();
        let output = child.wait_with_output()?;
        let server_pid = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse()
            .unwrap_or(pid);
        let actual_pid = if server_pid != 0 { server_pid } else { pid };

        // Wait a moment for the server to start
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        if is_server_running(Some(port)) {
            let pid_path = get_pid_path();
            if let Some(parent) = pid_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            std::fs::write(&pid_path, actual_pid.to_string()).ok();

            if format == OutputFormat::Json {
                println!(r#"{{"status": "started", "pid": {}}}"#, actual_pid);
            } else {
                print_success(&format!("Server started (PID: {})", actual_pid));
            }
        } else {
            print_error("Server failed to start. Check logs with: nexus server logs");
            std::process::exit(1);
        }
    }

    Ok(())
}

/// Stop the Nexus server.
pub async fn run_server_stop(format: OutputFormat) -> Result<()> {
    if !is_server_running(None) {
        if format == OutputFormat::Json {
            println!(r#"{{"status": "not_running", "message": "Server is not running"}}"#);
        } else {
            print_info("Server is not running");
        }
        return Ok(());
    }

    // Find and kill the server process
    let pid = get_server_pid();

    match pid {
        Some(pid) => {
            if format == OutputFormat::Json {
                println!(r#"{{"status": "stopping", "pid": {}}}"#, pid);
            } else {
                print_info(&format!("Stopping server (PID: {})...", pid));
            }

            // Send SIGTERM
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;

                let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
            }

            #[cfg(not(unix))]
            {
                // On Windows, use taskkill
                let _ = Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F"])
                    .status();
            }

            // Wait for server to stop
            for _ in 0..10 {
                tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
                if !is_server_running(None) {
                    break;
                }
            }

            if !is_server_running(None) {
                if format == OutputFormat::Json {
                    println!(r#"{{"status": "stopped"}}"#);
                } else {
                    print_success("Server stopped");
                }
            } else {
                print_error("Failed to stop server");
                std::process::exit(1);
            }
        }
        None => {
            print_error("Could not find server PID");
            std::process::exit(1);
        }
    }

    Ok(())
}

/// Check and display server status.
pub async fn run_server_status(format: OutputFormat) -> Result<()> {
    let running = is_server_running(None);
    let pid = get_server_pid();

    if format == OutputFormat::Json {
        if running {
            if let Some(pid) = pid {
                println!(r#"{{"status": "running", "pid": {}}}"#, pid);
            } else {
                println!(r#"{{"status": "running"}}"#);
            }
        } else {
            println!(r#"{{"status": "stopped"}}"#);
        }
    } else if running {
        if let Some(pid) = pid {
            print_success(&format!("Server is running (PID: {})", pid));
        } else {
            print_success("Server is running");
        }
    } else {
        print_info("Server is not running");
        print_info("Start with: nexus server start");
    }

    Ok(())
}

/// View server logs.
pub async fn run_server_logs(lines: usize, follow: bool, _format: OutputFormat) -> Result<()> {
    let log_path = get_log_path();

    if !log_path.exists() {
        print_info("No logs found. Server may not have been started yet.");
        return Ok(());
    }

    if follow {
        // Use tail -f equivalent
        print_info(&format!("Following logs from: {}", log_path.display()));
        println!();

        let file = std::fs::File::open(&log_path)?;
        let reader = BufReader::new(file);

        // Print last N lines first
        let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
        let start = if all_lines.len() > lines {
            all_lines.len() - lines
        } else {
            0
        };
        for line in &all_lines[start..] {
            println!("{}", line);
        }

        // Then follow new lines
        // Note: This is a simplified implementation. A full implementation would use
        // notify or inotify to watch for file changes.
        print_info("(Following new log entries... Press Ctrl+C to stop)");

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            // In a real implementation, we would watch for file changes and print new lines
        }
    } else {
        // Just print the last N lines
        let file = std::fs::File::open(&log_path)?;
        let reader = BufReader::new(file);

        let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
        let start = if all_lines.len() > lines {
            all_lines.len() - lines
        } else {
            0
        };

        for line in &all_lines[start..] {
            println!("{}", line);
        }
    }

    Ok(())
}

/// Check if the server is running by trying to connect.
fn is_server_running(port: Option<u16>) -> bool {
    let port = port.unwrap_or(DEFAULT_PORT);
    let addr = format!("{}:{}", DEFAULT_HOST, port);

    // Try to connect to the server socket or HTTP endpoint
    let socket_path = get_socket_path();

    if socket_path.exists() {
        // Try to connect to the Unix socket
        #[cfg(unix)]
        {
            use std::os::unix::net::UnixStream;
            UnixStream::connect(&socket_path).is_ok()
        }
        #[cfg(not(unix))]
        {
            // On Windows, check if the HTTP port is open
            std::net::TcpStream::connect(&addr).is_ok()
        }
    } else {
        // Try HTTP endpoint
        std::net::TcpStream::connect(&addr).is_ok()
    }
}

/// Get the server PID from the PID file.
fn get_server_pid() -> Option<u32> {
    let pid_path = get_pid_path();

    if pid_path.exists() {
        std::fs::read_to_string(&pid_path)
            .ok()
            .and_then(|s| s.trim().parse().ok())
    } else {
        None
    }
}

/// Get the path to the server socket.
fn get_socket_path() -> std::path::PathBuf {
    dirs::cache_dir()
        .or_else(|| dirs::data_local_dir())
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("nexus")
        .join("nexus.sock")
}

/// Get the path to the PID file.
fn get_pid_path() -> std::path::PathBuf {
    dirs::cache_dir()
        .or_else(|| dirs::data_local_dir())
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join("nexus")
        .join("nexus.pid")
}

/// Get the path to the log file.
fn get_log_path() -> std::path::PathBuf {
    std::path::PathBuf::from(env!("HOME"))
        .join(".local")
        .join("share")
        .join("nexus")
        .join("logs")
        .join("nexus.log")
}
