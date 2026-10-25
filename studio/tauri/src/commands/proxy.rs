//! Credential-injecting proxy to the bundled server.
//!
//! When this shell launched the server (Full build), client-owned database
//! credentials never enter the renderer. The renderer sends request bodies
//! containing `loom-connection://<id>` references; this module swaps them for
//! real connection URIs, adds the session token, forwards the request to the
//! loopback server, and redacts any credential that comes back.
//!
//! The forwarding target is fixed (`127.0.0.1:<BACKEND_PORT>`), never taken
//! from renderer-writable settings, so a compromised page cannot redirect
//! credentials to a host of its choosing.
//!
//! The HTTP exchange is a minimal HTTP/1.1 client over a loopback TCP socket
//! (the same approach as the readiness probe in `backend.rs`), which avoids an
//! HTTP-client dependency. It only ever talks plain HTTP to `127.0.0.1`.
//!
//! The reference format mirrors `src/platform/connectionUri.ts`; keep the two
//! in step.

use std::collections::HashMap;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::commands::backend::{BackendManager, BACKEND_PORT};
use crate::commands::credentials::{self, DatabaseType, ResolvedConnection};

const REF_PREFIX: &str = "loom-connection://";
const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 256 * 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const ALLOWED_METHODS: [&str; 5] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const LOOPBACK_AUTHORITIES: [&str; 3] = ["localhost", "127.0.0.1", "[::1]"];

/// Request as sent by the renderer.
#[derive(Debug, Deserialize)]
pub struct ProxyRequest {
    pub url: String,
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
}

/// Response handed back to the renderer (rebuilt into a `Response` there).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// A resolved connection: the URI and the secrets to scrub from responses.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedRef {
    pub uri: String,
    pub secrets: Vec<String>,
}

// ---------------------------------------------------------------------------
// URI building (port of buildConnectionUri in src/platform/connectionUri.ts)
// ---------------------------------------------------------------------------

/// `encodeURIComponent`: everything except `A-Z a-z 0-9 - _ . ! ~ * ' ( )`.
fn encode_uri_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => out.push(byte as char),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn build_connection_uri(c: &ResolvedConnection) -> String {
    let user = encode_uri_component(&c.username);
    let password = encode_uri_component(&c.password);
    match c.db_type {
        DatabaseType::Sqlite => {
            let path = encode_uri_component(&c.database).replace("%2F", "/");
            format!("sqlite://{path}")
        }
        DatabaseType::Mssql => format!(
            "mssql://{user}:{password}@{}:{}/{}?encrypt=true&trust_server_certificate=true",
            c.host, c.port, c.database
        ),
        DatabaseType::Postgresql => format!(
            "postgresql://{user}:{password}@{}:{}/{}",
            c.host, c.port, c.database
        ),
        DatabaseType::Mysql => format!(
            "mysql://{user}:{password}@{}:{}/{}",
            c.host, c.port, c.database
        ),
    }
}

/// Raw, percent-encoded and JSON-escaped forms of the password worth scrubbing.
fn secrets_for(c: &ResolvedConnection) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    if !c.password.is_empty() {
        let json_escaped = serde_json::to_string(&c.password)
            .map(|s| s[1..s.len() - 1].to_string())
            .unwrap_or_default();
        for candidate in [
            c.password.clone(),
            encode_uri_component(&c.password),
            json_escaped,
        ] {
            if candidate.chars().count() >= 4 && !out.contains(&candidate) {
                out.push(candidate);
            }
        }
    }
    out
}

fn resolved_ref(c: &ResolvedConnection) -> ResolvedRef {
    ResolvedRef {
        uri: build_connection_uri(c),
        secrets: secrets_for(c),
    }
}

// ---------------------------------------------------------------------------
// Reference substitution and redaction
// ---------------------------------------------------------------------------

/// Extract the connection id from a whole-string reference.
fn parse_ref(value: &Value) -> Option<&str> {
    let id = value.as_str()?.strip_prefix(REF_PREFIX)?;
    let valid = !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
    valid.then_some(id)
}

#[derive(Debug)]
pub struct Substitution {
    pub body: String,
    /// Everything that must be redacted from the response.
    pub secrets: Vec<String>,
    pub replaced: usize,
}

type Resolver<'a> = &'a mut dyn FnMut(&str) -> Result<Option<ResolvedRef>, String>;

/// Accumulates what substitution replaced.
#[derive(Default)]
struct Swapped {
    secrets: Vec<String>,
    replaced: usize,
}

/// Replace `holder.source` if it is a reference to a known connection.
fn swap_source(holder: &mut Value, resolve: Resolver, swapped: &mut Swapped) -> Result<(), String> {
    let Some(id) = holder.get("source").and_then(parse_ref).map(str::to_owned) else {
        return Ok(());
    };
    if let Some(resolved) = resolve(&id)? {
        holder["source"] = Value::String(resolved.uri.clone());
        swapped.secrets.push(resolved.uri);
        swapped.secrets.extend(resolved.secrets);
        swapped.replaced += 1;
    }
    Ok(())
}

/// Replace `config.source` of every database Input tool under `container.tools`.
fn swap_tools(
    container: &mut Value,
    resolve: Resolver,
    swapped: &mut Swapped,
) -> Result<(), String> {
    let Some(tools) = container.get_mut("tools").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    for tool in tools {
        let is_database_input = tool.get("type").and_then(Value::as_str) == Some("Input")
            && tool
                .get("config")
                .and_then(|c| c.get("category"))
                .and_then(Value::as_str)
                == Some("database");
        if is_database_input {
            if let Some(config) = tool.get_mut("config") {
                swap_source(config, resolve, swapped)?;
            }
        }
    }
    Ok(())
}

/// Replace connection references in a JSON request body.
///
/// Substitution is deliberately narrow: only a whole string value equal to a
/// reference is replaced, and only where the server accepts a connection URI:
/// the top-level `source` (datasource endpoints) and `config.source` of
/// database Input tools (under `workflow.tools` or `tools`). A reference
/// anywhere else is left as-is, so a compromised page cannot use a reference
/// to make the server echo credentials into a field it controls. Unknown ids
/// are left untouched and the server rejects them.
fn substitute_refs(body: &str, resolve: Resolver) -> Result<Substitution, String> {
    let unchanged = || Substitution {
        body: body.to_string(),
        secrets: Vec::new(),
        replaced: 0,
    };
    if !body.contains(REF_PREFIX) {
        return Ok(unchanged());
    }
    let Ok(mut parsed) = serde_json::from_str::<Value>(body) else {
        return Ok(unchanged());
    };

    let mut swapped = Swapped::default();
    if parsed.is_object() {
        swap_source(&mut parsed, resolve, &mut swapped)?;
        swap_tools(&mut parsed, resolve, &mut swapped)?;
        if let Some(workflow) = parsed.get_mut("workflow") {
            swap_tools(workflow, resolve, &mut swapped)?;
        }
    }

    if swapped.replaced == 0 {
        return Ok(unchanged());
    }
    let body = serde_json::to_string(&parsed).map_err(|e| e.to_string())?;
    Ok(Substitution {
        body,
        secrets: swapped.secrets,
        replaced: swapped.replaced,
    })
}

/// Replace every occurrence of a secret in `text` with a marker.
fn redact(text: &str, secrets: &[String]) -> String {
    let mut ordered: Vec<&String> = secrets.iter().filter(|s| !s.is_empty()).collect();
    // Longest first so a URI is redacted whole before its password fragment.
    ordered.sort_by_key(|s| std::cmp::Reverse(s.len()));
    let mut out = text.to_string();
    for secret in ordered {
        out = out.replace(secret.as_str(), "[redacted]");
    }
    out
}

// ---------------------------------------------------------------------------
// Target validation
// ---------------------------------------------------------------------------

/// Validate a renderer-supplied URL and reduce it to the request target
/// (`/api/...?query`). Returns `None` unless it addresses the bundled server's
/// `/api/` on its port over plain HTTP on a loopback name.
fn backend_target(raw: &str) -> Option<String> {
    let rest = raw.strip_prefix("http://")?;
    let (authority, path_and_query) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, ""),
    };
    let port = format!(":{BACKEND_PORT}");
    let host = authority.strip_suffix(port.as_str())?;
    if !LOOPBACK_AUTHORITIES.contains(&host) {
        return None;
    }
    // Drop any fragment; refuse anything that could break the request line.
    let target = path_and_query.split('#').next().unwrap_or("");
    if !target.starts_with("/api/") || target.bytes().any(|b| b <= 0x20 || b == 0x7f) {
        return None;
    }
    Some(target.to_string())
}

fn header_value_ok(value: &str) -> bool {
    !value.bytes().any(|b| b == b'\r' || b == b'\n' || b == 0)
}

// ---------------------------------------------------------------------------
// Minimal HTTP/1.1 client
// ---------------------------------------------------------------------------

#[derive(Debug)]
struct RawResponse {
    status: u16,
    status_text: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

/// Decode a `Transfer-Encoding: chunked` body.
fn decode_chunked(mut data: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let line_end = find_subsequence(data, b"\r\n").ok_or("Malformed chunked response")?;
        let size_text = std::str::from_utf8(&data[..line_end])
            .map_err(|_| "Malformed chunk size")?
            .split(';')
            .next()
            .unwrap_or("")
            .trim();
        let size = usize::from_str_radix(size_text, 16).map_err(|_| "Malformed chunk size")?;
        data = &data[line_end + 2..];
        if size == 0 {
            return Ok(out);
        }
        if data.len() < size + 2 {
            return Err("Truncated chunked response".to_string());
        }
        out.extend_from_slice(&data[..size]);
        data = &data[size + 2..];
    }
}

fn parse_response(bytes: &[u8]) -> Result<RawResponse, String> {
    let head_end = find_subsequence(bytes, b"\r\n\r\n").ok_or("Malformed response from server")?;
    let head = String::from_utf8_lossy(&bytes[..head_end]).into_owned();
    let mut lines = head.split("\r\n");

    let status_line = lines.next().ok_or("Malformed response from server")?;
    let mut parts = status_line.splitn(3, ' ');
    let _version = parts.next();
    let status: u16 = parts
        .next()
        .and_then(|code| code.parse().ok())
        .ok_or("Malformed status line from server")?;
    let status_text = parts.next().unwrap_or("").to_string();

    let mut headers = Vec::new();
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            headers.push((name.trim().to_string(), value.trim().to_string()));
        }
    }

    let raw_body = &bytes[head_end + 4..];
    let chunked = headers.iter().any(|(k, v)| {
        k.eq_ignore_ascii_case("transfer-encoding") && v.to_ascii_lowercase().contains("chunked")
    });
    let body = if chunked {
        decode_chunked(raw_body)?
    } else {
        // `Connection: close` means the body runs to EOF; honour
        // Content-Length when present so trailing bytes are not included.
        let declared = headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
            .and_then(|(_, v)| v.parse::<usize>().ok());
        match declared {
            Some(n) if n <= raw_body.len() => raw_body[..n].to_vec(),
            _ => raw_body.to_vec(),
        }
    };

    Ok(RawResponse {
        status,
        status_text,
        headers,
        body,
    })
}

/// Send one request and read the whole response.
async fn send_http(
    addr: &str,
    method: &str,
    target: &str,
    headers: &[(String, String)],
    body: Option<&str>,
) -> Result<RawResponse, String> {
    let mut stream = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(addr))
        .await
        .map_err(|_| "Timed out connecting to the bundled server".to_string())?
        .map_err(|e| format!("Failed to connect to the bundled server: {e}"))?;

    let mut request = format!("{method} {target} HTTP/1.1\r\nHost: {addr}\r\n");
    for (name, value) in headers {
        request.push_str(&format!("{name}: {value}\r\n"));
    }
    if let Some(body) = body {
        request.push_str(&format!("Content-Length: {}\r\n", body.len()));
    }
    request.push_str("Connection: close\r\n\r\n");

    let exchange = async {
        stream
            .write_all(request.as_bytes())
            .await
            .map_err(|e| format!("Failed to send request: {e}"))?;
        if let Some(body) = body {
            stream
                .write_all(body.as_bytes())
                .await
                .map_err(|e| format!("Failed to send request: {e}"))?;
        }

        let mut response = Vec::new();
        let mut chunk = vec![0u8; 16 * 1024];
        loop {
            let n = stream
                .read(&mut chunk)
                .await
                .map_err(|e| format!("Failed to read response: {e}"))?;
            if n == 0 {
                break;
            }
            response.extend_from_slice(&chunk[..n]);
            if response.len() > MAX_RESPONSE_BYTES {
                return Err("Response from the bundled server is too large".to_string());
            }
        }
        Ok::<_, String>(response)
    };

    let bytes = tokio::time::timeout(REQUEST_TIMEOUT, exchange)
        .await
        .map_err(|_| "Timed out waiting for the bundled server".to_string())??;
    parse_response(&bytes)
}

/// Forward a validated request and redact the response. Split from the command
/// so tests can point it at a local listener.
async fn forward(
    addr: &str,
    token: &str,
    target: &str,
    request: &ProxyRequest,
    method: &str,
    body: Option<&str>,
    secrets: &[String],
) -> Result<ProxyResponse, String> {
    let mut headers = vec![
        ("Authorization".to_string(), format!("Bearer {token}")),
        ("Content-Type".to_string(), "application/json".to_string()),
    ];
    for (name, value) in request.headers.iter().flatten() {
        if !header_value_ok(value) {
            return Err("Invalid header value".to_string());
        }
        if name.eq_ignore_ascii_case("accept") {
            headers.push(("Accept".to_string(), value.clone()));
        } else if name.eq_ignore_ascii_case("content-type") {
            headers[1].1 = value.clone();
        }
    }

    let send_body = if method == "GET" { None } else { body };
    let raw = send_http(addr, method, target, &headers, send_body).await?;

    let response_headers = raw
        .headers
        .into_iter()
        .filter(|(name, _)| {
            // The body is re-materialised as text, so transport headers are stale.
            ![
                "content-length",
                "content-encoding",
                "transfer-encoding",
                "connection",
            ]
            .contains(&name.to_ascii_lowercase().as_str())
        })
        .map(|(name, value)| (name, redact(&value, secrets)))
        .collect();

    Ok(ProxyResponse {
        status: raw.status,
        status_text: raw.status_text,
        headers: response_headers,
        body: redact(&String::from_utf8_lossy(&raw.body), secrets),
    })
}

/// Forward a request to the bundled server, swapping connection references
/// for real connection URIs and redacting credentials from the response.
#[tauri::command]
pub async fn backend_request(
    app: AppHandle,
    backend: State<'_, BackendManager>,
    request: ProxyRequest,
) -> Result<ProxyResponse, String> {
    if !backend.is_owned() {
        return Err(
            "Connection proxy is not available: the bundled server is not running".to_string(),
        );
    }
    let token = credentials::session_token().ok_or("Session token not initialized")?;

    let has_refs = request
        .body
        .as_deref()
        .is_some_and(|body| body.contains(REF_PREFIX));
    if !has_refs {
        // Nothing to inject; the renderer should have used plain fetch.
        return Err("Request carries no connection references".to_string());
    }

    let target = backend_target(&request.url)
        .ok_or("Credential proxy only forwards to the bundled server")?;
    let method = request
        .method
        .as_deref()
        .unwrap_or("GET")
        .to_ascii_uppercase();
    if !ALLOWED_METHODS.contains(&method.as_str()) {
        return Err(format!("Unsupported method: {method}"));
    }
    let body = request.body.clone().unwrap_or_default();
    if body.len() > MAX_BODY_BYTES {
        return Err("Request body is too large".to_string());
    }

    // Keychain access blocks, so substitute off the async runtime.
    let app_for_resolve = app.clone();
    let substituted = tauri::async_runtime::spawn_blocking(move || {
        substitute_refs(&body, &mut |id| {
            Ok(credentials::load_resolved(&app_for_resolve, id)?
                .map(|connection| resolved_ref(&connection)))
        })
    })
    .await
    .map_err(|e| format!("Credential substitution failed: {e}"))??;

    println!(
        "[Proxy] Injected {} connection(s) into {method} {target}",
        substituted.replaced
    );

    let addr = format!("127.0.0.1:{BACKEND_PORT}");
    forward(
        &addr,
        &token,
        &target,
        &request,
        &method,
        Some(&substituted.body),
        &substituted.secrets,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;

    fn pg() -> ResolvedConnection {
        ResolvedConnection {
            id: "conn-1".to_string(),
            name: "Sales".to_string(),
            db_type: DatabaseType::Postgresql,
            owner: "client".to_string(),
            host: "db.example.com".to_string(),
            port: 5432,
            database: "sales".to_string(),
            username: "lo om".to_string(),
            password: "p@ss/w:rd".to_string(),
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    fn resolver(id: &str) -> Result<Option<ResolvedRef>, String> {
        Ok((id == "conn-1").then(|| resolved_ref(&pg())))
    }

    #[test]
    fn encodes_like_encode_uri_component() {
        assert_eq!(encode_uri_component("p@ss/w:rd"), "p%40ss%2Fw%3Ard");
        assert_eq!(encode_uri_component("lo om"), "lo%20om");
        assert_eq!(
            encode_uri_component("a-b_c.d!e~f*g'h(i)"),
            "a-b_c.d!e~f*g'h(i)"
        );
        assert_eq!(encode_uri_component("\u{e9}"), "%C3%A9");
    }

    #[test]
    fn builds_uris_for_every_database_type() {
        let mut c = pg();
        assert_eq!(
            build_connection_uri(&c),
            "postgresql://lo%20om:p%40ss%2Fw%3Ard@db.example.com:5432/sales"
        );
        c.db_type = DatabaseType::Mysql;
        c.port = 3306;
        assert!(build_connection_uri(&c).starts_with("mysql://lo%20om:"));
        c.db_type = DatabaseType::Mssql;
        c.port = 1433;
        assert_eq!(
            build_connection_uri(&c),
            "mssql://lo%20om:p%40ss%2Fw%3Ard@db.example.com:1433/sales?encrypt=true&trust_server_certificate=true"
        );
        c.db_type = DatabaseType::Sqlite;
        c.database = "/data/my db.sqlite".to_string();
        let uri = build_connection_uri(&c);
        assert_eq!(uri, "sqlite:///data/my%20db.sqlite");
        assert!(!uri.contains("p%40ss"));
    }

    #[test]
    fn parses_only_whole_string_references() {
        assert_eq!(
            parse_ref(&Value::from("loom-connection://abc-123")),
            Some("abc-123")
        );
        assert_eq!(parse_ref(&Value::from("loom-connection://")), None);
        assert_eq!(parse_ref(&Value::from("loom-connection://a/b")), None);
        assert_eq!(parse_ref(&Value::from("x loom-connection://abc")), None);
        assert_eq!(parse_ref(&Value::from("postgresql://u:p@h/d")), None);
        assert_eq!(parse_ref(&Value::from(42)), None);
    }

    #[test]
    fn substitutes_a_top_level_source() {
        let body = r#"{"source":"loom-connection://conn-1","sourceType":"postgresql"}"#;
        let out = substitute_refs(body, &mut |id| resolver(id)).unwrap();
        assert_eq!(out.replaced, 1);
        let parsed: Value = serde_json::from_str(&out.body).unwrap();
        assert_eq!(parsed["source"], build_connection_uri(&pg()));
        assert!(out.secrets.contains(&build_connection_uri(&pg())));
    }

    #[test]
    fn substitutes_only_database_input_tools() {
        let body = serde_json::json!({
            "workflow": { "tools": [
                { "id": "t1", "type": "Input", "config": { "category": "database", "source": "loom-connection://conn-1" } },
                { "id": "t2", "type": "Input", "config": { "category": "file", "source": "loom-connection://conn-1" } },
                { "id": "t3", "type": "Filter", "config": { "source": "loom-connection://conn-1" } }
            ] }
        })
        .to_string();
        let out = substitute_refs(&body, &mut |id| resolver(id)).unwrap();
        let tools = &serde_json::from_str::<Value>(&out.body).unwrap()["workflow"]["tools"];
        assert_eq!(out.replaced, 1);
        assert_eq!(tools[0]["config"]["source"], build_connection_uri(&pg()));
        assert_eq!(tools[1]["config"]["source"], "loom-connection://conn-1");
        assert_eq!(tools[2]["config"]["source"], "loom-connection://conn-1");
    }

    #[test]
    fn handles_a_bare_workflow_body() {
        let body = serde_json::json!({
            "tools": [ { "id": "t1", "type": "Input", "config": { "category": "database", "source": "loom-connection://conn-1" } } ]
        })
        .to_string();
        assert_eq!(
            substitute_refs(&body, &mut |id| resolver(id))
                .unwrap()
                .replaced,
            1
        );
    }

    #[test]
    fn leaves_unknown_ids_embedded_references_and_non_json_alone() {
        let body = r#"{"source":"loom-connection://missing","name":"loom-connection://conn-1"}"#;
        let out = substitute_refs(body, &mut |id| resolver(id)).unwrap();
        assert_eq!(out.replaced, 0);
        assert_eq!(out.body, body);

        let text = "not json loom-connection://conn-1";
        assert_eq!(
            substitute_refs(text, &mut |id| resolver(id)).unwrap().body,
            text
        );
    }

    #[test]
    fn propagates_resolver_errors() {
        let body = r#"{"source":"loom-connection://conn-1"}"#;
        let err = substitute_refs(body, &mut |_| Err("keychain locked".to_string())).unwrap_err();
        assert_eq!(err, "keychain locked");
    }

    #[test]
    fn redacts_uri_and_password_forms() {
        let mut c = pg();
        c.password = "pa\"ss/word".to_string();
        let uri = build_connection_uri(&c);
        let mut secrets = vec![uri.clone()];
        secrets.extend(secrets_for(&c));
        let text = format!(
            "connect {uri} failed; password pa\"ss/word wrong; enc {}; json {}",
            encode_uri_component("pa\"ss/word"),
            serde_json::to_string("pa\"ss/word").unwrap()
        );
        let out = redact(&text, &secrets);
        assert!(!out.contains("pa\"ss/word"));
        assert!(!out.contains(&encode_uri_component("pa\"ss/word")));
        assert!(!out.contains(&uri));
        assert!(out.contains("[redacted]"));
    }

    #[test]
    fn ignores_very_short_passwords() {
        let mut c = pg();
        c.password = "ab".to_string();
        assert!(secrets_for(&c).is_empty());
    }

    #[test]
    fn validates_the_forwarding_target() {
        let ok = format!("http://localhost:{BACKEND_PORT}/api/workflow/execute?x=1");
        assert_eq!(
            backend_target(&ok).as_deref(),
            Some("/api/workflow/execute?x=1")
        );
        assert_eq!(
            backend_target(&format!("http://127.0.0.1:{BACKEND_PORT}/api/x#frag")).as_deref(),
            Some("/api/x")
        );
        assert!(backend_target(&format!("http://[::1]:{BACKEND_PORT}/api/x")).is_some());

        for bad in [
            "http://evil.example.com:25811/api/x",
            "http://localhost:8080/api/x",
            "https://localhost:25811/api/x",
            "http://localhost:25811/other",
            "http://user:pw@localhost:25811/api/x",
            "http://localhost:25811.evil.com/api/x",
            "http://localhost:25811",
            "http://localhost:25811/api/x\r\nHost: evil",
            "not a url",
        ] {
            assert!(backend_target(bad).is_none(), "{bad} should be refused");
        }
    }

    #[test]
    fn decodes_chunked_bodies() {
        let data = b"5\r\nhello\r\n6;ext=1\r\n world\r\n0\r\n\r\n";
        assert_eq!(decode_chunked(data).unwrap(), b"hello world");
        assert!(decode_chunked(b"zz\r\n").is_err());
        assert!(decode_chunked(b"5\r\nhe").is_err());
    }

    #[test]
    fn parses_content_length_and_chunked_responses() {
        let plain =
            b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 5\r\n\r\nhelloEXTRA";
        let parsed = parse_response(plain).unwrap();
        assert_eq!(parsed.status, 200);
        assert_eq!(parsed.status_text, "OK");
        assert_eq!(parsed.body, b"hello");

        let chunked =
            b"HTTP/1.1 400 Bad Request\r\nTransfer-Encoding: chunked\r\n\r\n3\r\nabc\r\n0\r\n\r\n";
        let parsed = parse_response(chunked).unwrap();
        assert_eq!(parsed.status, 400);
        assert_eq!(parsed.body, b"abc");

        assert!(parse_response(b"garbage").is_err());
    }

    /// Serve one canned response and capture the request bytes.
    async fn serve_once(response: Vec<u8>) -> (String, tokio::task::JoinHandle<Vec<u8>>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        let handle = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut received = Vec::new();
            let mut chunk = [0u8; 4096];
            loop {
                let n = socket.read(&mut chunk).await.unwrap();
                received.extend_from_slice(&chunk[..n]);
                if let Some(head_end) = find_subsequence(&received, b"\r\n\r\n") {
                    let head = String::from_utf8_lossy(&received[..head_end]).to_ascii_lowercase();
                    let length = head
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length:"))
                        .and_then(|v| v.trim().parse::<usize>().ok())
                        .unwrap_or(0);
                    if received.len() >= head_end + 4 + length {
                        break;
                    }
                }
                if n == 0 {
                    break;
                }
            }
            socket.write_all(&response).await.unwrap();
            socket.shutdown().await.ok();
            received
        });
        (addr, handle)
    }

    #[tokio::test]
    async fn forwards_with_the_shell_token_and_redacts_the_response() {
        let uri = build_connection_uri(&pg());
        let body = format!("{{\"detail\":\"cannot reach {uri}\"}}");
        let response = format!(
            "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nX-Debug: {uri}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let (addr, server) = serve_once(response.into_bytes()).await;

        let request = ProxyRequest {
            url: format!("http://localhost:{BACKEND_PORT}/api/datasource/schema"),
            method: Some("POST".to_string()),
            headers: Some(HashMap::from([(
                "Authorization".to_string(),
                "Bearer renderer-token".to_string(),
            )])),
            body: None,
        };
        let secrets: Vec<String> = std::iter::once(uri.clone())
            .chain(secrets_for(&pg()))
            .collect();
        let out = forward(
            &addr,
            "shell-token",
            "/api/datasource/schema",
            &request,
            "POST",
            Some("{\"source\":\"x\"}"),
            &secrets,
        )
        .await
        .unwrap();

        assert_eq!(out.status, 400);
        assert_eq!(out.status_text, "Bad Request");
        assert!(!out.body.contains("p%40ss"));
        assert!(out.body.contains("[redacted]"));
        let debug = out.headers.iter().find(|(k, _)| k == "X-Debug").unwrap();
        assert_eq!(debug.1, "[redacted]");
        assert!(out
            .headers
            .iter()
            .all(|(k, _)| !k.eq_ignore_ascii_case("content-length")));

        let received = String::from_utf8(server.await.unwrap()).unwrap();
        assert!(received.starts_with("POST /api/datasource/schema HTTP/1.1\r\n"));
        assert!(received.contains("Authorization: Bearer shell-token\r\n"));
        assert!(!received.contains("renderer-token"));
        assert!(received.ends_with("{\"source\":\"x\"}"));
    }

    #[tokio::test]
    async fn refuses_header_injection() {
        let request = ProxyRequest {
            url: String::new(),
            method: None,
            headers: Some(HashMap::from([(
                "Content-Type".to_string(),
                "application/json\r\nX-Evil: 1".to_string(),
            )])),
            body: None,
        };
        let err = forward("127.0.0.1:1", "t", "/api/x", &request, "POST", None, &[])
            .await
            .unwrap_err();
        assert_eq!(err, "Invalid header value");
    }

    #[tokio::test]
    async fn reports_connection_failures() {
        // Port 1 (tcpmux) has no listener on any desktop OS. A port that was
        // bound and released is not safe here: other tests bind ephemeral
        // ports in parallel and can be handed the same one.
        let addr = "127.0.0.1:1".to_string();
        let request = ProxyRequest {
            url: String::new(),
            method: None,
            headers: None,
            body: None,
        };
        let err = forward(&addr, "t", "/api/x", &request, "GET", None, &[])
            .await
            .unwrap_err();
        assert!(err.contains("Failed to connect"));
    }
}
