use crate::telemetry::IpcResult;

pub fn track_read_time(_paper_id: &str, _seconds: u32) -> IpcResult<()> {
    Ok(())
}
