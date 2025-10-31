use std::path::{Path, PathBuf};

pub fn normalize<P: AsRef<Path>>(path: P) -> PathBuf {
    let p = path.as_ref();
    if cfg!(target_os = "windows") {
        PathBuf::from(p.to_string_lossy().replace('/', "\\"))
    } else {
        p.to_path_buf()
    }
}
