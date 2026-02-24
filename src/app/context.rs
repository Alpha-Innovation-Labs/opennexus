use anyhow::Result;

use crate::core::context::model::{
    ContextBackfillOptions, ContextImplementOptions, ContextTestStatusOptions,
};
use crate::features::context::{
    run_context_backfill, run_context_implement, run_context_test_status,
};

pub fn run_context_implement_app(options: &ContextImplementOptions) -> Result<()> {
    run_context_implement(options)
}

pub fn run_context_test_status_app(options: &ContextTestStatusOptions) -> Result<()> {
    run_context_test_status(options)
}

pub fn run_context_backfill_app(options: &ContextBackfillOptions) -> Result<()> {
    run_context_backfill(options)
}
