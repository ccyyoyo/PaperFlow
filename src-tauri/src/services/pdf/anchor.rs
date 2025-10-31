#[derive(Debug, Default, Clone)]
pub struct NoteAnchor {
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub text_hash: String,
}

pub fn derive_anchor(_page: i32, _selection: &str) -> NoteAnchor {
    NoteAnchor { text_hash: format!("hash:{}", _selection.len()), ..Default::default() }
}
