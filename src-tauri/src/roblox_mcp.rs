use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Mutex},
    thread,
    time::Duration,
};
use tauri::State;

struct McpSession {
    child: Child,
    stdin: ChildStdin,
    responses: mpsc::Receiver<String>,
    next_id: u64,
    tools: Vec<String>,
}

impl Drop for McpSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct RobloxMcpState {
    session: Mutex<Option<McpSession>>,
}

fn send_message(session: &mut McpSession, message: Value) -> Result<(), String> {
    let line = serde_json::to_string(&message).map_err(|e| e.to_string())?;
    session.stdin.write_all(line.as_bytes()).map_err(|e| format!("Could not write to Roblox Studio MCP: {e}"))?;
    session.stdin.write_all(b"\n").map_err(|e| e.to_string())?;
    session.stdin.flush().map_err(|e| e.to_string())
}

fn receive_response(session: &mut McpSession, expected_id: u64) -> Result<Value, String> {
    loop {
        let line = session.responses.recv_timeout(Duration::from_secs(15))
            .map_err(|e| format!("Timed out waiting for Roblox Studio MCP ({}). Make sure Studio is open and its MCP server is enabled.", e))?;
        let parsed: Value = serde_json::from_str(&line)
            .map_err(|e| format!("Roblox Studio MCP returned invalid JSON: {e}"))?;
        if parsed.get("id").and_then(Value::as_u64) == Some(expected_id) {
            if let Some(error) = parsed.get("error") {
                return Err(format!("MCP request failed: {error}"));
            }
            return Ok(parsed.get("result").cloned().unwrap_or(Value::Null));
        }
    }
}

fn request(session: &mut McpSession, method: &str, params: Value) -> Result<Value, String> {
    let id = session.next_id;
    session.next_id += 1;
    send_message(session, json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))?;
    receive_response(session, id)
}

#[tauri::command]
pub fn roblox_mcp_connect(state: State<'_, RobloxMcpState>) -> Result<Value, String> {
    let mut guard = state.session.lock().map_err(|_| "Roblox connection state is unavailable.".to_string())?;
    if guard.is_some() {
        return Err("A Roblox Studio MCP connection is already running.".into());
    }

    #[cfg(not(target_os = "windows"))]
    return Err("Roblox Studio MCP integration is currently supported on Windows only.".into());

    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA")
            .map_err(|_| "Windows LOCALAPPDATA was not found.".to_string())?;
        let launcher = std::path::Path::new(&local_app_data).join("Roblox").join("mcp.bat");
        if !launcher.is_file() {
            return Err("Roblox Studio MCP launcher was not found. Update Roblox Studio, then enable Assistant → Manage MCP Servers → Enable Studio as MCP server.".into());
        }

        let launcher_command = format!("\"{}\"", launcher.display());
        let mut child = Command::new("cmd.exe")
            .args(["/D", "/S", "/C"])
            .arg(launcher_command)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Could not start the Roblox Studio MCP launcher: {e}"))?;

        let stdin = child.stdin.take().ok_or("MCP stdin was not available.")?;
        let stdout = child.stdout.take().ok_or("MCP stdout was not available.")?;
        let stderr = child.stderr.take().ok_or("MCP stderr was not available.")?;
        let (tx, rx) = mpsc::channel::<String>();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                match line {
                    Ok(line) if !line.trim().is_empty() => {
                        if tx.send(line).is_err() { break; }
                    }
                    Ok(_) => {}
                    Err(_) => break,
                }
            }
        });
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines() {
                if line.is_err() { break; }
            }
        });

        let mut session = McpSession { child, stdin, responses: rx, next_id: 1, tools: Vec::new() };
        let init = request(&mut session, "initialize", json!({
            "protocolVersion":"2024-11-05",
            "capabilities":{},
            "clientInfo":{"name":"MATRIX LABS","version":"8.2.0"}
        }))?;
        send_message(&mut session, json!({"jsonrpc":"2.0","method":"notifications/initialized"}))?;
        let tool_result = request(&mut session, "tools/list", json!({}))?;
        session.tools = tool_result.get("tools").and_then(Value::as_array).into_iter().flatten()
            .filter_map(|tool| tool.get("name").and_then(Value::as_str).map(str::to_owned)).collect();

        let studios = if session.tools.iter().any(|name| name == "list_roblox_studios") {
            request(&mut session, "tools/call", json!({"name":"list_roblox_studios","arguments":{}}))
                .unwrap_or_else(|error| json!({"isError":true,"content":[{"type":"text","text":error}]}))
        } else {
            json!({"isError":true,"content":[{"type":"text","text":"The connected server does not expose list_roblox_studios."}]})
        };

        let response = json!({
            "connected":true,
            "serverInfo":init.get("serverInfo").cloned().unwrap_or(Value::Null),
            "protocolVersion":init.get("protocolVersion").cloned().unwrap_or(Value::Null),
            "tools":session.tools,
            "studios":studios
        });
        *guard = Some(session);
        Ok(response)
    }
}

#[tauri::command]
pub fn roblox_mcp_disconnect(state: State<'_, RobloxMcpState>) -> Result<(), String> {
    let mut guard = state.session.lock().map_err(|_| "Roblox connection state is unavailable.".to_string())?;
    if let Some(mut session) = guard.take() {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }
    Ok(())
}

#[tauri::command]
pub fn roblox_mcp_status(state: State<'_, RobloxMcpState>) -> Result<Value, String> {
    let mut guard = state.session.lock().map_err(|_| "Roblox connection state is unavailable.".to_string())?;
    let Some(session) = guard.as_mut() else {
        return Ok(json!({"connected":false,"tools":[]}));
    };
    if let Some(status) = session.child.try_wait().map_err(|e| e.to_string())? {
        *guard = None;
        return Ok(json!({"connected":false,"tools":[],"exitStatus":status.to_string()}));
    }
    Ok(json!({"connected":true,"tools":session.tools}))
}


/// Read-only Studio tools exposed through a fixed allowlist. Mutating tools such as
/// multi_edit, execute_luau, insert_asset, and start_stop_play are intentionally excluded.
fn validate_read_only_arguments(tool_name: &str, arguments: Value, studio_id: &str) -> Result<Value, String> {
    let mut args = arguments.as_object().cloned()
        .ok_or_else(|| "Roblox Studio tool arguments must be a JSON object.".to_string())?;
    let allowed: &[&str] = match tool_name {
        "search_game_tree" => &["path", "instance_type", "keywords", "max_depth"],
        "inspect_instance" => &["path"],
        "script_search" => &["keywords"],
        "script_grep" => &["query"],
        "script_read" => &["target_file", "should_read_entire_file", "start_line_one_indexed", "end_line_one_indexed_inclusive"],
        "get_console_output" | "screen_capture" => &[],
        _ => return Err("This Roblox Studio tool is not available through the read-only bridge.".into()),
    };

    if let Some(key) = args.keys().find(|key| !allowed.contains(&key.as_str())) {
        return Err(format!("Unsupported argument for {tool_name}: {key}"));
    }

    for key in ["path", "instance_type", "keywords", "query", "target_file"] {
        if let Some(value) = args.get(key) {
            let text = value.as_str().ok_or_else(|| format!("{key} must be text."))?;
            if text.trim().is_empty() || text.len() > 512 {
                return Err(format!("{key} must contain 1–512 characters."));
            }
        }
    }

    if let Some(depth) = args.get("max_depth") {
        let depth = depth.as_u64().ok_or("max_depth must be an integer.")?;
        if !(1..=10).contains(&depth) {
            return Err("max_depth must be between 1 and 10.".into());
        }
    }

    for key in ["start_line_one_indexed", "end_line_one_indexed_inclusive"] {
        if let Some(line) = args.get(key) {
            let line = line.as_u64().ok_or_else(|| format!("{key} must be a positive integer."))?;
            if line == 0 || line > 100_000 {
                return Err(format!("{key} must be between 1 and 100000."));
            }
        }
    }

    if let (Some(start), Some(end)) = (
        args.get("start_line_one_indexed").and_then(Value::as_u64),
        args.get("end_line_one_indexed_inclusive").and_then(Value::as_u64),
    ) {
        if end < start {
            return Err("The ending line must be greater than or equal to the starting line.".into());
        }
    }

    if let Some(read_entire) = args.get("should_read_entire_file") {
        if !read_entire.is_boolean() {
            return Err("should_read_entire_file must be true or false.".into());
        }
    }

    if studio_id.trim().is_empty() || studio_id.len() > 256 {
        return Err("Select a valid Roblox Studio instance before running a tool.".into());
    }
    args.insert("studio_id".into(), Value::String(studio_id.to_string()));
    Ok(Value::Object(args))
}

#[tauri::command]
pub fn roblox_mcp_read_tool(
    state: State<'_, RobloxMcpState>,
    tool_name: String,
    studio_id: String,
    arguments: Value,
) -> Result<Value, String> {
    const READ_ONLY_TOOLS: &[&str] = &[
        "search_game_tree",
        "inspect_instance",
        "script_search",
        "script_grep",
        "script_read",
        "get_console_output",
        "screen_capture",
    ];

    if !READ_ONLY_TOOLS.contains(&tool_name.as_str()) {
        return Err("Blocked: MATRIX LABS only exposes approved read-only Roblox Studio tools here.".into());
    }

    let safe_arguments = validate_read_only_arguments(&tool_name, arguments, &studio_id)?;
    let mut guard = state.session.lock()
        .map_err(|_| "Roblox connection state is unavailable.".to_string())?;
    let session = guard.as_mut().ok_or("Connect to Roblox Studio first.")?;

    if !session.tools.iter().any(|name| name == &tool_name) {
        return Err(format!("The connected Studio server does not provide {tool_name}."));
    }

    request(session, "tools/call", json!({
        "name": tool_name,
        "arguments": safe_arguments
    }))
}
