use anyhow::Result;

use super::backfill::run_context_backfill as run_backfill;
use super::implement::run_context_implement as run_implement;
use super::status::run_context_test_status as run_status;
use crate::core::context::model::{
    ContextBackfillOptions, ContextImplementOptions, ContextTestStatusOptions,
};

pub fn run_context_test_status(options: &ContextTestStatusOptions) -> Result<()> {
    run_status(options)
}

pub fn run_context_backfill(options: &ContextBackfillOptions) -> Result<()> {
    run_backfill(options)
}

pub fn run_context_implement(options: &ContextImplementOptions) -> Result<()> {
    run_implement(options)
}
