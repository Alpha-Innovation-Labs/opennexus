use anyhow::Result;

use crate::features::ralph::parser::parse_operation;
use crate::features::ralph::runtime::execute;

pub fn run_ralph_app(args: &[String]) -> Result<()> {
    let operation = parse_operation(args)?;
    execute(operation)
}
