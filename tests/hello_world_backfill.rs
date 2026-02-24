#[test]
fn hello_world_backfill_fixture_task() {
    let greeting = format!("{} {}", "hello", "world");
    assert_eq!(greeting, "hello world");
}

#[test]
fn hello_world_backfill_second_fixture_task() {
    let value = 2 + 2;
    assert_eq!(value, 4);
}
