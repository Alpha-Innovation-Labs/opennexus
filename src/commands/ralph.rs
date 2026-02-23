use anyhow::Result;

use crate::app::run_ralph_app;

pub fn run_ralph(args: &[String]) -> Result<()> {
    run_ralph_app(args)
}
