use anyhow::Context;

use super::Db;

const MIGRATIONS: &[(&str, &str)] = &[
    ("0001_init.sql", include_str!("../migrations/0001_init.sql")),
    (
        "0002_add_tags.sql",
        include_str!("../migrations/0002_add_tags.sql"),
    ),
];

pub fn ensure_initialized() -> anyhow::Result<()> {
    let db = Db::connect()?;
    let conn = db.connection();

    for (name, sql) in MIGRATIONS {
        conn.execute_batch(sql)
            .with_context(|| format!("failed to run migration {name}"))?;
    }

    Ok(())
}
