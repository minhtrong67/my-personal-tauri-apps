fn main() {
    // Re-embed icons and config whenever they change, otherwise Cargo can keep an old icon.
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=capabilities");
    tauri_build::build()
}
