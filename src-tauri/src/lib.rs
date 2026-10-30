mod ai;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ai::save_matrix_ai_key,
            ai::matrix_ai_key_status,
            ai::delete_matrix_ai_key,
            ai::send_ai_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running MATRIX LABS");
}
