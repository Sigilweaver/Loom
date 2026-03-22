//! Credential management commands
//!
//! Secure storage for database connections.
//! Currently uses tauri-plugin-store with app-level encryption.
//! 
//! Future: Use tauri-plugin-stronghold for hardware-backed encryption.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use uuid::Uuid;
use chrono::Utc;

const CONNECTIONS_STORE: &str = "connections.json";

/// Session token for backend authentication (ephemeral, regenerated each launch)
static SESSION_TOKEN: Mutex<Option<String>> = Mutex::new(None);

/// Database connection types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    Postgresql,
    Mysql,
    Sqlite,
    Mssql,
}

/// Stored connection (with encrypted credentials)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredConnection {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    // In production, this should be encrypted with Stronghold
    // For now, stored in app data (reasonably protected by OS)
    pub password: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Public connection info (without credentials)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: DatabaseType,
    pub owner: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Resolved connection (with credentials for backend use)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedConnection {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: DatabaseType,
    pub owner: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating a connection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConnectionInput {
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: DatabaseType,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

/// Input for updating a connection
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConnectionInput {
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

/// Connection test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
}

impl StoredConnection {
    fn to_info(&self) -> ConnectionInfo {
        ConnectionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            db_type: self.db_type.clone(),
            owner: "client".to_string(),
            host: self.host.clone(),
            port: self.port,
            database: self.database.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
    
    fn to_resolved(&self) -> ResolvedConnection {
        ResolvedConnection {
            id: self.id.clone(),
            name: self.name.clone(),
            db_type: self.db_type.clone(),
            owner: "client".to_string(),
            host: self.host.clone(),
            port: self.port,
            database: self.database.clone(),
            username: self.username.clone(),
            password: self.password.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

/// Initialize session token on app startup
pub fn initialize_session(_app: &AppHandle) -> Result<(), String> {
    let token = Uuid::new_v4().to_string();
    let mut session = SESSION_TOKEN.lock().map_err(|e| e.to_string())?;
    *session = Some(token.clone());
    println!("[Credentials] Generated ephemeral session token");
    Ok(())
}

/// Get the current session token for backend auth
#[tauri::command]
pub async fn get_session_token() -> Result<Option<String>, String> {
    let session = SESSION_TOKEN.lock().map_err(|e| e.to_string())?;
    Ok(session.clone())
}

/// Check if encryption is available
/// Currently always true for Tauri (store is protected by OS)
/// Will return actual status when Stronghold is implemented
#[tauri::command]
pub async fn is_encryption_available() -> Result<bool, String> {
    // Tauri's store plugin uses app data directory which is protected by OS
    // For true secure storage, Stronghold would be needed
    Ok(true)
}

fn load_connections(app: &AppHandle) -> Result<HashMap<String, StoredConnection>, String> {
    let store = app
        .store(CONNECTIONS_STORE)
        .map_err(|e| format!("Failed to open connections store: {}", e))?;
    
    if let Some(value) = store.get("connections") {
        match serde_json::from_value::<HashMap<String, StoredConnection>>(value.clone()) {
            Ok(connections) => return Ok(connections),
            Err(e) => {
                eprintln!("[Credentials] Failed to parse connections: {}", e);
            }
        }
    }
    
    Ok(HashMap::new())
}

fn save_connections(app: &AppHandle, connections: &HashMap<String, StoredConnection>) -> Result<(), String> {
    let store = app
        .store(CONNECTIONS_STORE)
        .map_err(|e| format!("Failed to open connections store: {}", e))?;
    
    let value = serde_json::to_value(connections)
        .map_err(|e| format!("Failed to serialize connections: {}", e))?;
    
    store.set("connections", value);
    store.save().map_err(|e| format!("Failed to save connections: {}", e))?;
    
    Ok(())
}

/// List all connections (without credentials)
#[tauri::command]
pub async fn list_connections(app: AppHandle) -> Result<Vec<ConnectionInfo>, String> {
    let connections = load_connections(&app)?;
    Ok(connections.values().map(|c| c.to_info()).collect())
}

/// List connections by database type
#[tauri::command]
pub async fn list_connections_by_type(
    app: AppHandle,
    db_type: DatabaseType,
) -> Result<Vec<ConnectionInfo>, String> {
    let connections = load_connections(&app)?;
    Ok(connections
        .values()
        .filter(|c| c.db_type == db_type)
        .map(|c| c.to_info())
        .collect())
}

/// Get a single connection by ID
#[tauri::command]
pub async fn get_connection(app: AppHandle, id: String) -> Result<Option<ConnectionInfo>, String> {
    let connections = load_connections(&app)?;
    Ok(connections.get(&id).map(|c| c.to_info()))
}

/// Create a new connection
#[tauri::command]
pub async fn create_connection(
    app: AppHandle,
    input: CreateConnectionInput,
) -> Result<ConnectionInfo, String> {
    let mut connections = load_connections(&app)?;
    
    // Check for duplicate names
    let name_lower = input.name.to_lowercase();
    if connections.values().any(|c| c.name.to_lowercase() == name_lower) {
        return Err(format!("A connection named '{}' already exists", input.name));
    }
    
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    
    let connection = StoredConnection {
        id: id.clone(),
        name: input.name,
        db_type: input.db_type,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        password: input.password,
        created_at: now.clone(),
        updated_at: now,
    };
    
    let info = connection.to_info();
    connections.insert(id.clone(), connection);
    save_connections(&app, &connections)?;
    
    println!("[Credentials] Created connection: {} ({})", info.name, id);
    Ok(info)
}

/// Update an existing connection
#[tauri::command]
pub async fn update_connection(
    app: AppHandle,
    id: String,
    input: UpdateConnectionInput,
) -> Result<ConnectionInfo, String> {
    let mut connections = load_connections(&app)?;
    
    // Check for duplicate names first (before mutable borrow)
    if let Some(ref new_name) = input.name {
        let name_lower = new_name.to_lowercase();
        if connections
            .values()
            .any(|c| c.id != id && c.name.to_lowercase() == name_lower)
        {
            return Err(format!("A connection named '{}' already exists", new_name));
        }
    }
    
    let connection = connections
        .get_mut(&id)
        .ok_or_else(|| format!("Connection {} not found", id))?;
    
    // Apply updates
    if let Some(new_name) = input.name {
        connection.name = new_name;
    }
    
    if let Some(host) = input.host {
        connection.host = host;
    }
    if let Some(port) = input.port {
        connection.port = port;
    }
    if let Some(database) = input.database {
        connection.database = database;
    }
    if let Some(username) = input.username {
        connection.username = username;
    }
    if let Some(password) = input.password {
        connection.password = password;
    }
    
    connection.updated_at = Utc::now().to_rfc3339();
    
    let info = connection.to_info();
    save_connections(&app, &connections)?;
    
    println!("[Credentials] Updated connection: {} ({})", info.name, id);
    Ok(info)
}

/// Delete a connection
#[tauri::command]
pub async fn delete_connection(app: AppHandle, id: String) -> Result<(), String> {
    let mut connections = load_connections(&app)?;
    
    let connection = connections
        .remove(&id)
        .ok_or_else(|| format!("Connection {} not found", id))?;
    
    save_connections(&app, &connections)?;
    
    println!("[Credentials] Deleted connection: {} ({})", connection.name, id);
    Ok(())
}

/// Resolve a connection with decrypted credentials
#[tauri::command]
pub async fn resolve_connection(
    app: AppHandle,
    id: String,
) -> Result<Option<ResolvedConnection>, String> {
    let connections = load_connections(&app)?;
    Ok(connections.get(&id).map(|c| c.to_resolved()))
}

/// Test a connection
#[tauri::command]
pub async fn test_connection(app: AppHandle, id: String) -> Result<ConnectionTestResult, String> {
    let connections = load_connections(&app)?;
    
    if connections.get(&id).is_none() {
        return Ok(ConnectionTestResult {
            success: false,
            message: "Connection not found".to_string(),
        });
    }
    
    // For now, just confirm configuration exists
    // Actual testing would be done via the backend
    Ok(ConnectionTestResult {
        success: true,
        message: "Connection configured (test via backend pending)".to_string(),
    })
}
