fn main() {
    println!("cargo:rerun-if-changed=../ui");
    println!("cargo:rerun-if-changed=../ui/pet.html");
    println!("cargo:rerun-if-changed=../ui/pet-mini.html");
    println!("cargo:rerun-if-changed=../ui/assets");
    tauri_build::build()
}
