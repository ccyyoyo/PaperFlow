/// Basic tokenizer that lowercases ASCII alphanumerics and splits on boundaries.
/// For CJK ranges where whitespace is uncommon, each character becomes a token.
pub fn tokenize(source: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in source.chars() {
        if ch.is_ascii_alphanumeric() {
            current.push(ch.to_ascii_lowercase());
            continue;
        }

        if is_cjk(ch) {
            if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
            }
            tokens.push(ch.to_string());
            continue;
        }

        if !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x4E00..=0x9FFF   // CJK Unified Ideographs
            | 0x3400..=0x4DBF // CJK Unified Ideographs Extension A
            | 0x20000..=0x2A6DF // Extension B
            | 0x2A700..=0x2B73F // Extension C
            | 0x2B740..=0x2B81F // Extension D
            | 0x2B820..=0x2CEAF // Extension E
            | 0xF900..=0xFAFF // CJK Compatibility Ideographs
            | 0x2F800..=0x2FA1F // CJK Compatibility Ideographs Supplement
    )
}
