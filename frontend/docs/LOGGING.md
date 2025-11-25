# Logging System

Sigilweaver uses a centralized logging utility for consistent, configurable logging across the application.

## Overview

The logging system provides:
- **Configurable log levels** via environment variables
- **Context-aware logging** with automatic component/module prefixes
- **Zero overhead in production** - debug/info logs are disabled by default
- **Consistent formatting** across the codebase

## Log Levels

| Level | Usage | Production Default |
|-------|-------|-------------------|
| `debug` | Detailed diagnostic information | Disabled |
| `info` | General informational messages | Disabled |
| `warn` | Potentially problematic situations | Enabled |
| `error` | Error conditions | Enabled |

## Usage

### Creating a Logger

```typescript
import { createLogger } from '@utils/logger';

const logger = createLogger('ComponentName');
```

### Logging Messages

```typescript
// Debug - detailed diagnostic info (disabled in production)
logger.debug("User clicked button", { buttonId: 'submit' });

// Info - general information (disabled in production)
logger.info("Workflow loaded successfully", workflowName);

// Warn - potential issues (enabled in production)
logger.warn("Missing optional configuration", configKey);

// Error - error conditions (enabled in production)
logger.error("Failed to save workflow", error);
```

## Configuration

Set the `VITE_LOG_LEVEL` environment variable to control verbosity:

```bash
# Development (show all logs)
VITE_LOG_LEVEL=debug npm run dev

# Production (only warnings and errors)
VITE_LOG_LEVEL=warn npm run build

# Silent (no logs)
VITE_LOG_LEVEL=none npm run build
```

**Defaults:**
- Development mode (`npm run dev`): `debug` level
- Production build (`npm run build`): `warn` level

## Best Practices

### When to Use Each Level

**Debug:**
- Function entry/exit points
- State changes and data flow
- User interactions (clicks, drags, etc.)
- Internal operations (copy/paste, clipboard updates)

```typescript
logger.debug("Adding tool:", type, "at", x, y);
logger.debug("Clipboard data prepared:", clipboardData);
```

**Info:**
- Major workflow events
- Configuration changes
- Tab operations (create, switch, close)
- Successful completions

```typescript
logger.info("Creating new tab:", tabName);
logger.info("Workflow metadata updated:", meta.name);
```

**Warn:**
- Invalid user input (handled gracefully)
- Missing optional data
- Deprecated features
- Potential performance issues

```typescript
logger.warn("Tab not found:", tabId);
logger.warn("Invalid wire ID format:", id);
```

**Error:**
- Exceptions and caught errors
- Failed operations
- Data corruption
- Network errors

```typescript
logger.error("Failed to load workflow:", error);
logger.error("Backend API error:", response.status);
```

### Naming Conventions

Use PascalCase for component/module names:
```typescript
createLogger('CanvasShell')      // Component
createLogger('WorkflowStore')    // Store
createLogger('Clipboard')        // Hook or utility
createLogger('TabStore')         // Store
```

### Context in Messages

The logger automatically prefixes messages with the component name, so don't repeat it:

```typescript
// Good
logger.debug("Adding tool:", type);

// Bad - redundant context
logger.debug("[CanvasShell] Adding tool:", type);
```

### Sensitive Data

Avoid logging sensitive information:
```typescript
// Good - truncate long strings
logger.debug("Field changed:", field, 
  value.length > 50 ? `${value.substring(0, 50)}...` : value);

// Bad - could log passwords, tokens, etc.
logger.debug("User input:", userInput);
```

## Examples from Codebase

### CanvasShell Component
```typescript
const logger = createLogger('CanvasShell');

const handleAddTool = useCallback((type: string, x: number, y: number) => {
  logger.debug("Adding tool:", type, "at", x, y);
  // ...
}, []);
```

### TabStore
```typescript
const logger = createLogger('TabStore');

createTab: (name?: string, workflow?: WorkflowSnapshot) => {
  logger.info("Creating new tab:", tabName);
  // ...
}
```

### Clipboard Hook
```typescript
const logger = createLogger('Clipboard');

const doCopy = useCallback(() => {
  logger.debug("Starting copy operation");
  logger.debug("Selected IDs:", Array.from(selectedIds));
  // ...
}, []);
```

## Debugging Tips

### Enable Verbose Logging
```bash
# See all debug logs during development
VITE_LOG_LEVEL=debug npm run dev
```

### Check Current Log Level
```typescript
import { getLogLevel, isLevelEnabled } from '@utils/logger';

console.log('Current log level:', getLogLevel());
console.log('Debug enabled?', isLevelEnabled('debug'));
```

### Temporary Debugging
For temporary debugging, use `console.log` directly and remove before committing. For permanent diagnostic logging, use `logger.debug`.

## Performance Considerations

- Logger calls with `debug` or `info` level compile to no-ops in production builds
- The check `currentLevel <= levels.debug` short-circuits before evaluating arguments
- No performance impact when logs are disabled

## Migration from console.log

Replace manual console logging:

```typescript
// Before
console.log('[CanvasShell] Adding tool:', type, 'at', x, y);
console.warn('[CanvasShell] Invalid wire ID format:', id);
console.error('[CanvasShell] Failed to load:', error);

// After
const logger = createLogger('CanvasShell');
logger.debug('Adding tool:', type, 'at', x, y);
logger.warn('Invalid wire ID format:', id);
logger.error('Failed to load:', error);
```
