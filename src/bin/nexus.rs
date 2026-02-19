//! NEXUS - Context-Driven Development CLI
//!
//! Main entry point for the NEXUS tool.

use anyhow::Result;
use nexus::{
    Cli, Commands, ContextCommands, ProjectCommands, RagCommands, WorktreeOptions,
    run_build_context, run_context_create, run_context_delete, run_context_gen_code,
    run_context_gen_context, run_context_gen_tests, run_context_list, run_context_move,
    run_context_reorder, run_context_show, run_context_test_sync, run_context_update,
    run_create_context, run_project_create, run_project_delete, run_project_list, run_rag_clean,
    run_rag_daemon, run_rag_scan, run_rag_search, run_rag_search_actions, run_rag_search_outcomes,
    run_rag_status, run_rag_stop, run_rag_view, run_setup, run_tui,
};

fn main() -> Result<()> {
    let cli = Cli::parse_args();

    match cli.command {
        None => run_tui(),
        Some(Commands::Tui) => run_tui(),
        Some(Commands::Fzf) => run_build_context(),
        Some(Commands::Setup { profile }) => run_setup(profile),
        Some(Commands::BuildContext) => run_build_context(),
        Some(Commands::CreateContext) => run_create_context(),
        Some(Commands::Project(cmd)) => match cmd {
            ProjectCommands::List { json } => run_project_list(json),
            ProjectCommands::Create { name, prefix } => run_project_create(&name, prefix),
            ProjectCommands::Delete { name, force } => run_project_delete(&name, force),
        },
        Some(Commands::Context(cmd)) => match cmd {
            ContextCommands::List { project, json } => run_context_list(project, json),
            ContextCommands::Show { id } => run_context_show(&id),
            ContextCommands::Create { project } => run_context_create(&project),
            ContextCommands::Update { id } => run_context_update(&id),
            ContextCommands::Delete { id, force, no_reorder } => {
                run_context_delete(&id, force, no_reorder)
            }
            ContextCommands::Move { id, to } => run_context_move(&id, to),
            ContextCommands::Reorder { project } => run_context_reorder(&project),
            ContextCommands::TestSync {
                context,
                project,
                json,
            } => run_context_test_sync(context, project, json),
            ContextCommands::GenTests {
                context,
                action,
                max_retries,
                all,
                skip_retries,
                debug,
                parallel,
            } => run_context_gen_tests(
                context,
                action,
                max_retries,
                all,
                skip_retries,
                debug,
                parallel,
            ),
            ContextCommands::GenContext {
                dry_run,
                debug,
                provider,
            } => run_context_gen_context(dry_run, debug, &provider),
            ContextCommands::GenCode {
                test,
                context,
                max_retries,
                skip_retries,
                debug,
                undo,
                id,
                no_worktree,
                auto_merge,
                test_cmd,
            } => {
                let worktree_opts = Some(WorktreeOptions {
                    no_worktree,
                    auto_merge,
                    test_cmd,
                });
                run_context_gen_code(
                    test,
                    context,
                    max_retries,
                    skip_retries,
                    debug,
                    undo,
                    id,
                    worktree_opts,
                )
            }
        },
        Some(Commands::Rag(cmd)) => {
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(async {
                match cmd {
                    RagCommands::Scan => run_rag_scan().await,
                    RagCommands::Daemon => run_rag_daemon().await,
                    RagCommands::Stop => run_rag_stop(),
                    RagCommands::Status => run_rag_status(),
                    RagCommands::Search { queries, limit } => run_rag_search(&queries, limit).await,
                    RagCommands::SearchActions { queries, limit } => {
                        run_rag_search_actions(&queries, limit).await
                    }
                    RagCommands::SearchOutcomes { queries, limit } => {
                        run_rag_search_outcomes(&queries, limit).await
                    }
                    RagCommands::View => run_rag_view().await,
                    RagCommands::Clean => run_rag_clean(),
                }
            })
        }
    }
}
