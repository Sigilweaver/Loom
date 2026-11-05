/**
 * Add or edit a database or filesystem connection.
 *
 * Mount it only while open (give it a `key` per connection) so the form starts
 * from the connection being edited each time.
 */

import { useState, type FormEvent } from "react";
import { Database, RefreshCw } from "lucide-react";
import {
  createConnection,
  testConnectionPreCreate,
  updateConnection,
  type ConnectionResponse,
  type ConnectionTestResult,
  type ConnectionType,
  type DatabaseType,
  type PathType,
  type UpdateConnectionRequest,
} from "@api";
import { errorMessage, fieldError } from "@utils/errors";
import { Alert, Button, Checkbox, Field, Input, Modal, Select } from "@components/ui";
import { CONNECTION_TYPES, DATABASE_TYPES, PATH_TYPES, defaultPort } from "./options";

const FIELD_KEYS = ["name", "description", "host", "port", "database", "username", "password", "path"];

interface ConnectionDialogProps {
  /** The connection being edited, or null to create one. */
  connection: ConnectionResponse | null;
  onClose: () => void;
  onSaved: (connection: ConnectionResponse) => void;
}

export function ConnectionDialog({ connection, onClose, onSaved }: ConnectionDialogProps) {
  const isEditing = connection !== null;
  const dbConfig = connection?.database_config;
  const fsConfig = connection?.filesystem_config;

  const [connectionType, setConnectionType] = useState<ConnectionType>(connection?.type ?? "database");
  const [name, setName] = useState(connection?.name ?? "");
  const [description, setDescription] = useState(connection?.description ?? "");
  const [readOnly, setReadOnly] = useState(connection?.read_only ?? false);

  const [dbType, setDbType] = useState<DatabaseType>(dbConfig?.db_type ?? "postgresql");
  const [host, setHost] = useState(dbConfig?.host ?? "");
  const [port, setPort] = useState(dbConfig?.port ?? defaultPort("postgresql"));
  const [database, setDatabase] = useState(dbConfig?.database ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [path, setPath] = useState(fsConfig?.path ?? "");
  const [pathType, setPathType] = useState<PathType>(fsConfig?.path_type ?? "local");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isSqlite = dbType === "sqlite";
  const keepHint = isEditing ? "Leave blank to keep the current value." : undefined;

  const changeDbType = (next: DatabaseType) => {
    // Follow the default port only while the user has not typed their own.
    if (port === defaultPort(dbType)) setPort(defaultPort(next));
    setDbType(next);
  };

  const changeConnectionType = (next: ConnectionType) => {
    setConnectionType(next);
    setTestResult(null);
    setError(null);
  };

  const handleTest = async () => {
    if (!username || !password) {
      setError("Enter a username and password to test the connection.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      setTestResult(
        await testConnectionPreCreate({ type: dbType, host, port, database, username, password })
      );
    } catch (err) {
      setTestResult({ success: false, message: errorMessage(err, "Connection test failed") });
    } finally {
      setTesting(false);
    }
  };

  /** Client-side checks that give a quicker answer than a round trip. */
  const validate = (): Record<string, string> => {
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Name is required";
    if (connectionType === "database") {
      if (!isSqlite && !host.trim()) problems.host = "Host is required";
      if (!database.trim()) {
        problems.database = isSqlite ? "File path is required" : "Database name is required";
      }
      if (!isEditing && !isSqlite) {
        if (!username) problems.username = "Username is required";
        if (!password) problems.password = "Password is required";
      }
    } else if (!path.trim()) {
      problems.path = "Path is required";
    }
    return problems;
  };

  /** Only send what changed when editing. */
  const buildUpdate = (existing: ConnectionResponse): UpdateConnectionRequest => {
    const updates: Record<string, unknown> = {};
    if (name !== existing.name) updates.name = name;
    if (description !== (existing.description ?? "")) updates.description = description;
    if (readOnly !== existing.read_only) updates.read_only = readOnly;

    if (existing.database_config) {
      const cfg = existing.database_config;
      if (host !== cfg.host) updates.host = host;
      if (port !== cfg.port) updates.port = port;
      if (database !== cfg.database) updates.database = database;
      if (username) updates.username = username;
      if (password) updates.password = password;
    } else if (existing.filesystem_config) {
      const cfg = existing.filesystem_config;
      if (path !== cfg.path) updates.path = path;
      if (pathType !== cfg.path_type) updates.path_type = pathType;
    }
    return updates as UpdateConnectionRequest;
  };

  const save = (): Promise<ConnectionResponse> => {
    if (connection) return updateConnection(connection.id, buildUpdate(connection));
    if (connectionType === "database") {
      return createConnection({
        type: "database",
        name,
        description,
        read_only: readOnly,
        db_type: dbType,
        host,
        port,
        database,
        username,
        password,
      });
    }
    return createConnection({
      type: "filesystem",
      name,
      description,
      read_only: readOnly,
      path,
      path_type: pathType,
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problems = validate();
    setFieldErrors(problems);
    setError(null);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    try {
      onSaved(await save());
      onClose();
    } catch (err) {
      const fromServer: Record<string, string> = {};
      for (const key of FIELD_KEYS) {
        const message = fieldError(err, key);
        if (message) fromServer[key] = message;
      }
      setFieldErrors(fromServer);
      if (Object.keys(fromServer).length === 0) setError(errorMessage(err, "Failed to save connection"));
    } finally {
      setSubmitting(false);
    }
  };

  const canTest = connectionType === "database" && !isSqlite && !!host && !!database;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? "Edit connection" : "Add connection"}
      description="Credentials are encrypted at rest and only sent to servers while a workflow runs."
      icon={<Database className="h-5 w-5" />}
      dismissable={!submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          {connectionType === "database" && (
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleTest}
              loading={testing}
              disabled={!canTest || submitting}
              className="mr-auto"
            >
              Test connection
            </Button>
          )}
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {isEditing ? "Save changes" : "Add connection"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Connection type">
          <Select
            value={connectionType}
            onChange={(e) => changeConnectionType(e.target.value as ConnectionType)}
            disabled={isEditing}
          >
            {CONNECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Name" required error={fieldErrors.name}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={connectionType === "database" ? "Production database" : "Shared data folder"}
          />
        </Field>

        <Field label="Description (optional)" error={fieldErrors.description}>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this connection"
          />
        </Field>

        {connectionType === "database" ? (
          <>
            <Field label="Database type">
              <Select
                value={dbType}
                onChange={(e) => changeDbType(e.target.value as DatabaseType)}
                disabled={isEditing}
              >
                {DATABASE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            {!isSqlite && (
              <div className="grid grid-cols-3 gap-4">
                <Field label="Host" required error={fieldErrors.host} className="col-span-2">
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
                </Field>
                <Field label="Port" error={fieldErrors.port}>
                  <Input
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 0)}
                  />
                </Field>
              </div>
            )}

            <Field
              label={isSqlite ? "Database file path" : "Database name"}
              required
              error={fieldErrors.database}
            >
              <Input
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder={isSqlite ? "/path/to/database.db" : "mydb"}
              />
            </Field>

            {!isSqlite && (
              <>
                <Field label="Username" required={!isEditing} error={fieldErrors.username} hint={keepHint}>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                    placeholder={isEditing ? "Keep current" : "postgres"}
                  />
                </Field>
                <div>
                  <Field label="Password" required={!isEditing} error={fieldErrors.password} hint={keepHint}>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder={isEditing ? "Keep current" : ""}
                    />
                  </Field>
                  <Checkbox
                    label="Show password"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <Field label="Path type">
              <Select value={pathType} onChange={(e) => setPathType(e.target.value as PathType)}>
                {PATH_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Path"
              required
              error={fieldErrors.path}
              hint={
                pathType === "unc"
                  ? "Network path in UNC format, for example \\\\server\\share."
                  : "Local filesystem path the servers can reach."
              }
            >
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={pathType === "unc" ? "\\\\server\\share\\folder" : "/path/to/data"}
              />
            </Field>
          </>
        )}

        <Checkbox
          label="Read-only connection"
          checked={readOnly}
          onChange={(e) => setReadOnly(e.target.checked)}
        />

        {testResult && (
          <Alert tone={testResult.success ? "success" : "danger"}>{testResult.message}</Alert>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
