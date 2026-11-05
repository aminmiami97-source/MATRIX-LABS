mod roblox_mcp;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(roblox_mcp::RobloxMcpState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            roblox_mcp::roblox_mcp_connect,
            roblox_mcp::roblox_mcp_disconnect,
            roblox_mcp::roblox_mcp_status,
            roblox_mcp::roblox_mcp_read_tool
        ])
        .run(tauri::generate_context!())
        .expect("error while running MATRIX LABS");
}
