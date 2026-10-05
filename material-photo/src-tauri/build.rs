fn main() {
    // Re-embed icons, installer images and config whenever they change, otherwise Cargo can keep old ones.
    println!("cargo:rerun-if-changed=icons");
    println!("cargo:rerun-if-changed=installer");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=capabilities");
    tauri_build::build()
}
