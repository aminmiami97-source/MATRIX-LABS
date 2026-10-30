use keyring::v1::Entry;
use reqwest::{redirect::Policy, Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use zeroize::{Zeroize, Zeroizing};

const CREDENTIAL_SERVICE: &str = "com.matrixlabs.desktop";
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
    pub provider: String,
    pub model: String,
}

fn validate_provider(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("openai"),
        "gemini" => Ok("gemini"),
        _ => Err("Choose a supported AI provider.".to_string()),
    }
}

fn validate_model(model: &str) -> Result<String, String> {
    let value = model.trim();
    if value.is_empty()
        || value.len() > 80
        || !value.chars().all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | '/'))
    {
        return Err("Enter a valid model ID using letters, numbers, dots, dashes, or underscores.".to_string());
    }
    if value.contains("..") || value.starts_with('/') || value.ends_with('/') {
        return Err("That model ID is not valid.".to_string());
    }
    Ok(value.to_string())
}

fn credential_entry(provider: &str) -> Result<Entry, String> {
    let provider = validate_provider(provider)?;
    Entry::new(CREDENTIAL_SERVICE, provider)
        .map_err(|_| "Windows Credential Manager could not be opened. Check your Windows account and try again.".to_string())
}

fn load_api_key(provider: &str) -> Result<Zeroizing<String>, String> {
    let entry = credential_entry(provider)?;
    let key = entry
        .get_password()
        .map_err(|_| "No API key is saved for this provider. Open Settings to connect one.".to_string())?;
    if key.trim().is_empty() {
        return Err("The saved API key is empty. Please save it again in Settings.".to_string());
    }
    Ok(Zeroizing::new(key))
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(90))
        // Do not forward credentials through redirects to a different host.
        .redirect(Policy::none())
        .build()
        .map_err(|_| "Could not initialize the secure network client.".to_string())
}

async fn provider_error(response: Response) -> String {
    let status = response.status();
    match status.as_u16() {
        401 | 403 => "The provider rejected this API key. Check the key and provider selection.".to_string(),
        404 => "The provider could not find that model. Check the model ID in Settings.".to_string(),
        429 => "The provider rate limit or usage quota was reached. Check its usage page and try again later.".to_string(),
        400 => "The provider rejected this request. Check the model ID and try a different model.".to_string(),
        500..=599 => "The AI provider is having a server problem. Try again later.".to_string(),
        _ => format!("The AI provider returned HTTP {}. Try again or check its service status.", status.as_u16()),
    }
}

async fn response_json(response: Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(provider_error(response).await);
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "The AI provider response could not be read.".to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("The AI provider response was too large.".to_string());
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| "The AI provider returned an unreadable response.".to_string())
}

fn validate_messages(messages: &[ConversationMessage], system_prompt: &str) -> Result<(), String> {
    if messages.is_empty() {
        return Err("Write a message before sending.".to_string());
    }
    if messages.len() > MAX_MESSAGES {
        return Err("This conversation is too long for one request. Start a new chat or remove older messages.".to_string());
    }
    if system_prompt.chars().count() > MAX_SYSTEM_CHARS {
        return Err("The agent instructions are too long.".to_string());
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

async fn send_openai(
    client: &Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[ConversationMessage],
) -> Result<String, String> {
    let mut api_messages = Vec::with_capacity(messages.len() + 1);
    api_messages.push(json!({
        "role": "developer",
        "content": system_prompt
    }));

    for message in messages {
        api_messages.push(json!({
            "role": message.role,
            "content": message.content
        }));
    }

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "messages": api_messages
        }))
        .send()
        .await
        .map_err(|_| "Could not reach OpenAI. Check your internet connection and try again.".to_string())?;

    let body = response_json(response).await?;
    body.get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|content| !content.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "OpenAI returned no text. Try another model or send the message again.".to_string())
}

async fn send_gemini(
    client: &Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    messages: &[ConversationMessage],
) -> Result<String, String> {
    let mut contents = Vec::with_capacity(messages.len());
    for message in messages {
        let role = if message.role == "assistant" { "model" } else { "user" };
        contents.push(json!({
            "role": role,
            "parts": [{ "text": message.content }]
        }));
    }

    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
            model
        ))
        .header("x-goog-api-key", api_key)
        .json(&json!({
            "systemInstruction": {
                "parts": [{ "text": system_prompt }]
            },
            "contents": contents
        }))
        .send()
        .await
        .map_err(|_| "Could not reach Gemini. Check your internet connection and try again.".to_string())?;

    let body = response_json(response).await?;
    let parts = body
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|candidates| candidates.first())
        .and_then(|candidate| candidate.get("content"))
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .ok_or_else(|| "Gemini did not return a text response. The request may have been blocked.".to_string())?;

    let text = parts
        .iter()
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("");

    if text.trim().is_empty() {
        return Err("Gemini returned no text. Try again or check the model settings.".to_string());
    }
    Ok(text.trim().to_string())
}

#[tauri::command]
pub fn save_provider_key(provider: String, api_key: String) -> Result<(), String> {
    let provider = validate_provider(&provider)?;
    let mut secret = api_key;

    let invalid = {
        let trimmed = secret.trim();
        trimmed.len() < 12
            || trimmed.len() > 4096
            || trimmed.chars().any(|ch| matches!(ch, '\n' | '\r' | '\0'))
    };
    if invalid {
        secret.zeroize();
        return Err("The API key looks invalid. Check it and try again.".to_string());
    }

    let entry = match credential_entry(provider) {
        Ok(entry) => entry,
        Err(error) => {
            secret.zeroize();
            return Err(error);
        }
    };
    let result = entry.set_password(secret.trim());
    secret.zeroize();

    result.map_err(|_| "Windows Credential Manager could not save the API key.".to_string())
}

#[tauri::command]
pub fn provider_key_status(provider: String) -> Result<bool, String> {
    let entry = credential_entry(&provider)?;
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
pub fn delete_provider_key(provider: String) -> Result<(), String> {
    let entry = credential_entry(&provider)?;
    match entry.get_password() {
        Ok(mut secret) => {
            secret.zeroize();
            entry
                .delete_credential()
                .map_err(|_| "Windows Credential Manager could not remove the saved key.".to_string())
        }
        Err(_) => Ok(()),
    }
}

#[tauri::command]
pub async fn send_ai_message(
    provider: String,
    model: String,
    system_prompt: String,
    messages: Vec<ConversationMessage>,
) -> Result<ChatReply, String> {
    let provider = validate_provider(&provider)?;
    let model = validate_model(&model)?;
    validate_messages(&messages, &system_prompt)?;

    let api_key = load_api_key(provider)?;
    let client = http_client()?;

    let content = match provider {
        "openai" => send_openai(&client, api_key.as_str(), &model, &system_prompt, &messages).await?,
        "gemini" => send_gemini(&client, api_key.as_str(), &model, &system_prompt, &messages).await?,
        _ => return Err("Choose a supported AI provider.".to_string()),
    };

    Ok(ChatReply {
        content,
        provider: provider.to_string(),
        model,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_supported_providers() {
        assert_eq!(validate_provider("openai").unwrap(), "openai");
        assert_eq!(validate_provider("gemini").unwrap(), "gemini");
        assert!(validate_provider("custom").is_err());
    }

    #[test]
    fn rejects_model_path_injection() {
        assert!(validate_model("../secret").is_err());
        assert!(validate_model("models/gemini-3-flash").is_ok());
        assert!(validate_model("gpt-6-luna").is_ok());
    }

    #[test]
    fn rejects_invalid_conversation_roles() {
        let messages = vec![ConversationMessage {
            role: "tool".to_string(),
            content: "run something".to_string(),
        }];
        assert!(validate_messages(&messages, "You are helpful.").is_err());
    }
}
