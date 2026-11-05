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

        let mut child = Command::new("cmd.exe")
            .args(["/D", "/S", "/C", "call "%LOCALAPPDATA%\\Roblox\\mcp.bat""])
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
                    Ok(line) if !line.trim().is_empty() => { if tx.send(line).is_err() { break; } }
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
