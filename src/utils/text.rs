use regex::Regex;

pub fn strip_ansi(input: &str) -> String {
    let re = Regex::new(r"\x1B\[[0-9;]*m").expect("ansi regex");
    re.replace_all(input, "").to_string()
}

pub fn format_duration_long(ms: u128) -> String {
    let total_seconds = (ms / 1000) as u64;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    if hours > 0 {
        return format!("{}h {}m {}s", hours, minutes, seconds);
    }
    if minutes > 0 {
        return format!("{}m {}s", minutes, seconds);
    }
    format!("{}s", seconds)
}

pub fn format_duration_short(ms: u128) -> String {
    let total_seconds = (ms / 1000) as u64;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;
    if hours > 0 {
        return format!("{}:{:02}:{:02}", hours, minutes, seconds);
    }
    format!("{}:{:02}", minutes, seconds)
}
