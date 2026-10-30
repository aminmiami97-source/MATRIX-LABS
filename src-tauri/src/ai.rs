use keyring::v1::Entry;
use reqwest::{redirect::Policy, Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use zeroize::{Zeroize, Zeroizing};

const CREDENTIAL_SERVICE: &str = "com.matrixlabs.desktop";
const CREDENTIAL_ACCOUNT: &str = "matrix-ai";
const CHAT_ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";
const MAX_MESSAGES: usize = 24;
const MAX_MESSAGE_CHARS: usize = 12_000;
const MAX_SYSTEM_CHARS: usize = 4_000;
const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatReply {
    pub content: String,
    pub model: String,
}

fn validate_model(model: &str) -> Result<String, String> {
    let value = model.trim();
    if value.is_empty()
        || value.len() > 100
        || !value.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '/'))
    {
        return Err("Enter a valid model ID using letters, numbers, dots, dashes, or underscores.".to_string());
    }
    if value.contains("..") || value.starts_with('/') || value.ends_with('/') || value.contains("//") {
        return Err("That model ID is not valid.".to_string());
    }
    Ok(value.to_string())
}

fn credential_entry() -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)
        .map_err(|_| "Windows Credential Manager could not be opened. Check your Windows account and try again.".to_string())
}

fn load_api_key() -> Result<Zeroizing<String>, String> {
    let entry = credential_entry()?;
    let key = entry
        .get_password()
        .map_err(|_| "No MATRIX AI key is saved. Open Settings to connect your private key.".to_string())?;
    if key.trim().is_empty() {
        return Err("The saved key is empty. Please save it again in Settings.".to_string());
    }
    Ok(Zeroizing::new(key))
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(90))
        .redirect(Policy::none())
        .build()
        .map_err(|_| "Could not initialize the secure network client.".to_string())
}

async fn service_error(response: Response) -> String {
    match response.status().as_u16() {
        401 | 403 => "MATRIX AI rejected the saved key. Replace it in Settings.".to_string(),
        404 => "The selected model was not found. Check the model ID in Settings.".to_string(),
        429 => "The AI service rate limit or account quota was reached. Check the account usage page and try again later.".to_string(),
        400 => "The AI service rejected this request. Check the model ID and try again.".to_string(),
        500..=599 => "The AI service is having a server problem. Try again later.".to_string(),
        code => format!("MATRIX AI returned HTTP {}. Try again later.", code),
    }
}

async fn response_json(response: Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(service_error(response).await);
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "The AI response could not be read.".to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("The AI response was too large.".to_string());
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| "The AI service returned an unreadable response.".to_string())
}

fn validate_messages(messages: &[ConversationMessage], system_prompt: &str) -> Result<(), String> {
    if messages.is_empty() {
        return Err("Write a message before sending.".to_string());
    }
    if messages.len() > MAX_MESSAGES {
        return Err("This conversation is too long for one request. Start a new chat or remove older messages.".to_string());
    }
    if system_prompt.trim().is_empty() || system_prompt.chars().count() > MAX_SYSTEM_CHARS {
        return Err("The agent instructions are empty or too long.".to_string());
    }
    for message in messages {
        if message.content.trim().is_empty() || message.content.chars().count() > MAX_MESSAGE_CHARS {
            return Err("A chat message is empty or too long.".to_string());
        }
        if message.role != "user" && message.role != "assistant" {
            return Err("The conversation contains an unsupported message role.".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn save_matrix_ai_key(api_key: String) -> Result<(), String> {
    let mut secret = api_key;
    let invalid = {
        let trimmed = secret.trim();
        trimmed.len() < 20
            || trimmed.len() > 4096
            || trimmed.chars().any(|ch| matches!(ch, '\n' | '\r' | '\0'))
    };
    if invalid {
        secret.zeroize();
        return Err("The private key looks invalid. Check it and try again.".to_string());
    }

    let entry = match credential_entry() {
        Ok(entry) => entry,
        Err(error) => {
            secret.zeroize();
            return Err(error);
        }
    };
    let result = entry.set_password(secret.trim());
    secret.zeroize();

    result.map_err(|_| "Windows Credential Manager could not save the private key.".to_string())
}

#[tauri::command]
pub fn matrix_ai_key_status() -> Result<bool, String> {
    let entry = credential_entry()?;
    match entry.get_password() {
        Ok(mut secret) => {
            let present = !secret.trim().is_empty();
            secret.zeroize();
            Ok(present)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn delete_matrix_ai_key() -> Result<(), String> {
    let entry = credential_entry()?;
    match entry.get_password() {
        Ok(mut secret) => {
            secret.zeroize();
            entry.delete_credential()
                .map_err(|_| "Windows Credential Manager could not remove the private key.".to_string())
        }
        Err(_) => Ok(()),
    }
}

#[tauri::command]
pub async fn send_ai_message(
    model: String,
    system_prompt: String,
    messages: Vec<ConversationMessage>,
) -> Result<ChatReply, String> {
    let model = validate_model(&model)?;
    validate_messages(&messages, &system_prompt)?;

    let api_key = load_api_key()?;
    let client = http_client()?;

    let mut api_messages = Vec::with_capacity(messages.len() + 1);
    api_messages.push(json!({
        "role": "system",
        "content": system_prompt
    }));
    for message in &messages {
        api_messages.push(json!({
            "role": message.role,
            "content": message.content
        }));
    }

    let response = client
        .post(CHAT_ENDPOINT)
        .bearer_auth(api_key.as_str())
        .header("X-OpenRouter-Title", "MATRIX LABS")
        .json(&json!({
            "model": model,
            "messages": api_messages
        }))
        .send()
        .await
        .map_err(|_| "Could not reach MATRIX AI. Check your internet connection and try again.".to_string())?;

    let body = response_json(response).await?;
    let content = body
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "MATRIX AI returned no text. Try another model or send the message again.".to_string())?;

    Ok(ChatReply { content, model })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_provider_model_ids() {
        assert_eq!(validate_model("openai/gpt-5.2").unwrap(), "openai/gpt-5.2");
        assert!(validate_model("../secret").is_err());
        assert!(validate_model("model//injection").is_err());
    }

    #[test]
    fn rejects_invalid_conversation_roles() {
        let messages = vec![ConversationMessage {
            role: "tool".to_string(),
            content: "run something".to_string(),
        }];
        assert!(validate_messages(&messages, "You are helpful.").is_err());
    }

    #[test]
    fn rejects_empty_messages_and_system_prompt() {
        assert!(validate_messages(&[], "You are helpful.").is_err());
        let messages = vec![ConversationMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];
        assert!(validate_messages(&messages, "").is_err());
    }
}
