#[derive(Debug, Clone, Default)]
pub struct PreviewSnapshot {
    pub thumbnail: Option<Vec<u8>>,
    pub text: Option<String>,
}

pub fn build_snapshot(_page: i32, _selection: &str) -> PreviewSnapshot {
    PreviewSnapshot { text: Some(_selection.to_string()), ..Default::default() }
}
