use anyhow::{bail, Result};

use super::parser::parse_context_file;
use super::test_discovery::{discover_tests_from_runner, is_test_discovered};
use crate::core::context::model::ContextTestStatusOptions;

pub(crate) fn run_context_test_status(options: &ContextTestStatusOptions) -> Result<()> {
    let resolved = resolve_test_status_command_name(&options.command_name)?;
    let parsed = parse_context_file(&options.context_file)?;
    let discovered = discover_tests_from_runner()?;

    println!("Context file: {}", options.context_file.display());
    println!("Command id: {}", resolved);
    println!("Context id: {}", parsed.context_id);
    println!("Tests from Next Actions:");

    let mut found = 0usize;
    for test_id in &parsed.tests {
        let is_discovered = is_test_discovered(test_id, &discovered);
        if is_discovered {
            found += 1;
        }
        println!(
            "- {:<9} {}",
            if is_discovered {
                "DISCOVERED"
            } else {
                "MISSING"
            },
            test_id
        );
    }

    println!("Discovered: {}/{} tests.", found, parsed.tests.len());
    println!("Warning: test existence and discovery do not guarantee behavioral correctness.");
    Ok(())
}

pub(crate) fn resolve_test_status_command_name(raw: &str) -> Result<&'static str> {
    match raw {
        "test-status" | "status" | "test_status" => Ok("test-status"),
        other => bail!(
            "Unsupported command id '{}'. Use test-status (default) or alias status.",
            other
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_test_status_default_and_aliases() {
        assert_eq!(
            resolve_test_status_command_name("test-status").unwrap(),
            "test-status"
        );
        assert_eq!(
            resolve_test_status_command_name("status").unwrap(),
            "test-status"
        );
        assert_eq!(
            resolve_test_status_command_name("test_status").unwrap(),
            "test-status"
        );
    }
}
