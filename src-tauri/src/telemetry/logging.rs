use once_cell::sync::OnceCell;
use tracing::{error, info};
use tracing_subscriber::{fmt, EnvFilter};

static SUBSCRIBER: OnceCell<()> = OnceCell::new();

pub fn init() {
    SUBSCRIBER.get_or_init(|| {
        let env_filter =
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

        fmt()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_thread_ids(true)
            .with_line_number(true)
            .init();

        info!(target = "startup", "Telemetry initialized");
    });
}

pub fn log_startup_error(stage: &str, err: &anyhow::Error) {
    error!(target = "startup", %stage, error = %err, "startup stage failed");
}
