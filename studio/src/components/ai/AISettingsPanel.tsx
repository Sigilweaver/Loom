/**
 * AI Settings Panel
 *
 * Configuration UI for AI provider, model, API key, and other settings.
 * Rendered as a section inside the main SettingsPane.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAIStore, type AIProvider } from '@state/aiStore';
import { testProviderConnection, fetchProviderModels, PROVIDER_MODELS, PROVIDER_LABELS } from '../../ai/providers';
import { Checkbox } from '@components/ui/Checkbox';
import { Loader2, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';

const AISettingsPanel: React.FC = () => {
  const {
    enabled,
    provider,
    model,
    apiKey,
    baseUrl,
    maxIterations,
    useExpressionModel,
    expressionProvider,
    expressionModel,
    expressionApiKey,
    expressionBaseUrl,
    useAudit,
    useAuditModel,
    auditProvider,
    auditModel,
    auditApiKey,
    auditBaseUrl,
    updateEnabled,
    updateProvider,
    updateModel,
    updateApiKey,
    updateBaseUrl,
    updateMaxIterations,
    updateUseExpressionModel,
    updateExpressionProvider,
    updateExpressionModel,
    updateExpressionApiKey,
    updateExpressionBaseUrl,
    updateUseAudit,
    updateUseAuditModel,
    updateAuditProvider,
    updateAuditModel,
    updateAuditApiKey,
    updateAuditBaseUrl,
  } = useAIStore();

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Dynamic model list state
  const [fetchedModels, setFetchedModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [modelsFetching, setModelsFetching] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Fetch models when provider or API key changes (debounced)
  const fetchModels = useCallback(async () => {
    if (!enabled) return;

    // For cloud providers, need an API key to list models
    if (provider !== 'openai-compatible' && !apiKey) {
      setFetchedModels(PROVIDER_MODELS[provider].map((id) => ({ id })));
      return;
    }

    setModelsFetching(true);
    setModelsError(null);

    try {
      const models = await fetchProviderModels(provider, apiKey, baseUrl || undefined);
      setFetchedModels(models);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Failed to fetch models');
      // Fall back to static list
      setFetchedModels(PROVIDER_MODELS[provider].map((id) => ({ id })));
    } finally {
      setModelsFetching(false);
    }
  }, [enabled, provider, apiKey, baseUrl]);

  // Auto-fetch models when key fields change
  useEffect(() => {
    if (!enabled) return;

    // Use static list initially
    setFetchedModels(PROVIDER_MODELS[provider].map((id) => ({ id })));

    // Auto-fetch for openai-compatible (always available) or cloud providers when API key is set
    if (provider === 'openai-compatible' || apiKey) {
      const timer = setTimeout(fetchModels, 500);
      return () => clearTimeout(timer);
    }
  }, [enabled, provider, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestError(null);

    const result = await testProviderConnection(
      provider,
      model,
      apiKey,
      baseUrl || undefined,
    );

    if (result.success) {
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } else {
      setTestStatus('error');
      setTestError(result.error ?? 'Unknown error');
    }
  }, [provider, model, apiKey, baseUrl]);

  // Build display list for model selector
  const modelOptions: Array<{ id: string; name?: string }> = fetchedModels.length > 0
    ? fetchedModels
    : PROVIDER_MODELS[provider].map((id) => ({ id }));

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <div>
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => updateEnabled(checked === true)}
          label="Enable AI features"
          description="Connect to an LLM provider for AI-assisted workflow building and expression writing."
        />
      </div>

      {enabled && (
        <>
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => updateProvider(e.target.value as AIProvider)}
              className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
            >
              {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-theme-text-primary">
                Model
              </label>
              <button
                onClick={fetchModels}
                disabled={modelsFetching || (!apiKey && provider !== 'openai-compatible')}
                className="flex items-center gap-1 text-xs text-theme-text-secondary
                  hover:text-theme-text-primary transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
                title="Fetch available models from provider"
              >
                <RefreshCw className={`w-3 h-3 ${modelsFetching ? 'animate-spin' : ''}`} />
                Fetch
              </button>
            </div>
            {modelOptions.length > 0 ? (
              <>
                <select
                  value={modelOptions.some((m) => m.id === model) ? model : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') {
                      updateModel(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                >
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ? `${m.name} (${m.id})` : m.id}
                    </option>
                  ))}
                  {!modelOptions.some((m) => m.id === model) && model && (
                    <option value="__custom__">Custom: {model}</option>
                  )}
                  <option value="__custom__">Enter custom model...</option>
                </select>
                {(!modelOptions.some((m) => m.id === model) || model === '') && (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => updateModel(e.target.value)}
                    placeholder="e.g. gpt-4o"
                    className="w-full mt-1.5 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                  />
                )}
              </>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => updateModel(e.target.value)}
                placeholder="e.g. gpt-4o"
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
              />
            )}
            {modelsError && (
              <p className="mt-1 text-xs text-theme-status-error-text">{modelsError}</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => updateApiKey(e.target.value)}
                placeholder={provider === 'openai-compatible' ? 'Optional for local models' : 'sk-...'}
                className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary font-mono"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2.5 py-2 text-xs border rounded
                  bg-theme-surface-page border-theme-border-primary text-theme-text-secondary
                  hover:bg-theme-surface-hover transition-colors"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Base URL (only for openai-compatible) */}
          {provider === 'openai-compatible' && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => updateBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
              />
              <p className="mt-1 text-xs text-theme-text-tertiary">
                Ollama: http://localhost:11434/v1 &middot; LM Studio: http://localhost:1234/v1
              </p>
            </div>
          )}

          {/* Max Iterations */}
          <div>
            <label className="block text-xs font-medium mb-1.5 text-theme-text-primary">
              Max Agent Iterations
            </label>
            <input
              type="number"
              value={maxIterations}
              onChange={(e) => updateMaxIterations(parseInt(e.target.value, 10) || 25)}
              min={1}
              max={100}
              className="w-24 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
            />
            <p className="mt-1 text-xs text-theme-text-tertiary">
              Max tool-use steps per conversation turn (1-100)
            </p>
          </div>

          {/* Expression Assist Model Override */}
          <ExpressionModelSection
            useExpressionModel={useExpressionModel}
            expressionProvider={expressionProvider}
            expressionModel={expressionModel}
            expressionApiKey={expressionApiKey}
            expressionBaseUrl={expressionBaseUrl}
            mainApiKey={apiKey}
            updateUseExpressionModel={updateUseExpressionModel}
            updateExpressionProvider={updateExpressionProvider}
            updateExpressionModel={updateExpressionModel}
            updateExpressionApiKey={updateExpressionApiKey}
            updateExpressionBaseUrl={updateExpressionBaseUrl}
          />

          {/* Audit Model Override */}
          <AuditModelSection
            useAudit={useAudit}
            useAuditModel={useAuditModel}
            auditProvider={auditProvider}
            auditModel={auditModel}
            auditApiKey={auditApiKey}
            auditBaseUrl={auditBaseUrl}
            mainApiKey={apiKey}
            updateUseAudit={updateUseAudit}
            updateUseAuditModel={updateUseAuditModel}
            updateAuditProvider={updateAuditProvider}
            updateAuditModel={updateAuditModel}
            updateAuditApiKey={updateAuditApiKey}
            updateAuditBaseUrl={updateAuditBaseUrl}
          />

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={!model || testStatus === 'testing'}
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded
                border border-theme-border-primary bg-theme-surface-page text-theme-text-primary
                hover:bg-theme-surface-hover transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {testStatus === 'success' && <CheckCircle className="w-3.5 h-3.5 text-theme-status-success-text" />}
              {testStatus === 'error' && <XCircle className="w-3.5 h-3.5 text-theme-status-error-text" />}
              {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {testStatus === 'success' && (
              <p className="mt-1 text-xs text-theme-status-success-text">Connection successful!</p>
            )}
            {testStatus === 'error' && testError && (
              <p className="mt-1 text-xs text-theme-status-error-text">{testError}</p>
            )}
          </div>

          {/* Privacy note */}
          <div className="pt-2 border-t border-theme-border-primary">
            <p className="text-xs text-theme-text-tertiary leading-relaxed">
              AI calls are proxied through the Sigilweaver Loom Server to your chosen provider. No data is stored or logged. For full privacy, use a local model via Ollama or LM Studio.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expression Model Override Section
// ---------------------------------------------------------------------------

interface ExpressionModelSectionProps {
  useExpressionModel: boolean;
  expressionProvider: AIProvider;
  expressionModel: string;
  expressionApiKey: string;
  expressionBaseUrl: string;
  mainApiKey: string;
  updateUseExpressionModel: (use: boolean) => Promise<void>;
  updateExpressionProvider: (provider: AIProvider) => Promise<void>;
  updateExpressionModel: (model: string) => Promise<void>;
  updateExpressionApiKey: (apiKey: string) => Promise<void>;
  updateExpressionBaseUrl: (baseUrl: string) => Promise<void>;
}

const ExpressionModelSection: React.FC<ExpressionModelSectionProps> = ({
  useExpressionModel,
  expressionProvider,
  expressionModel,
  expressionApiKey,
  expressionBaseUrl,
  mainApiKey,
  updateUseExpressionModel,
  updateExpressionProvider,
  updateExpressionModel,
  updateExpressionApiKey,
  updateExpressionBaseUrl,
}) => {
  const [expanded, setExpanded] = useState(useExpressionModel);

  // Expression model list
  const [exprModels, setExprModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [exprModelsFetching, setExprModelsFetching] = useState(false);

  const fetchExprModels = useCallback(async () => {
    const key = expressionApiKey || mainApiKey;
    if (expressionProvider !== 'openai-compatible' && !key) {
      setExprModels(PROVIDER_MODELS[expressionProvider].map((id) => ({ id })));
      return;
    }
    setExprModelsFetching(true);
    try {
      const models = await fetchProviderModels(expressionProvider, key, expressionBaseUrl || undefined);
      setExprModels(models);
    } catch {
      setExprModels(PROVIDER_MODELS[expressionProvider].map((id) => ({ id })));
    } finally {
      setExprModelsFetching(false);
    }
  }, [expressionProvider, expressionApiKey, expressionBaseUrl, mainApiKey]);

  useEffect(() => {
    if (!useExpressionModel) return;
    setExprModels(PROVIDER_MODELS[expressionProvider].map((id) => ({ id })));
    const key = expressionApiKey || mainApiKey;
    if (expressionProvider === 'openai-compatible' || key) {
      const timer = setTimeout(fetchExprModels, 500);
      return () => clearTimeout(timer);
    }
  }, [useExpressionModel, expressionProvider, expressionApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const exprModelOptions: Array<{ id: string; name?: string }> = exprModels.length > 0
    ? exprModels
    : PROVIDER_MODELS[expressionProvider].map((id) => ({ id }));

  return (
    <div className="border border-theme-border-secondary rounded">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (!useExpressionModel && next) {
            updateUseExpressionModel(true);
          }
        }}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-theme-text-primary hover:bg-theme-surface-hover transition-colors rounded"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Expression Assist Model
        {useExpressionModel && expressionModel && (
          <span className="ml-auto text-theme-text-tertiary font-normal truncate max-w-[120px]">
            {expressionModel}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-theme-border-secondary">
          <div className="pt-2">
            <Checkbox
              checked={useExpressionModel}
              onCheckedChange={(checked) => updateUseExpressionModel(checked === true)}
              label="Use separate model"
              description="Use a different model for expression and condition generation (Filter/Formula inline assists). Useful for running a smaller local model for quick tasks."
            />
          </div>

          {useExpressionModel && (
            <>
              {/* Provider */}
              <div>
                <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                  Provider
                </label>
                <select
                  value={expressionProvider}
                  onChange={(e) => updateExpressionProvider(e.target.value as AIProvider)}
                  className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                >
                  {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                    <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-theme-text-secondary">Model</label>
                  <button
                    onClick={fetchExprModels}
                    disabled={exprModelsFetching}
                    className="flex items-center gap-1 text-xs text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${exprModelsFetching ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                {exprModelOptions.length > 0 ? (
                  <>
                    <select
                      value={exprModelOptions.some((m) => m.id === expressionModel) ? expressionModel : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value !== '__custom__') updateExpressionModel(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                    >
                      {exprModelOptions.map((m) => (
                        <option key={m.id} value={m.id}>{m.id}</option>
                      ))}
                      {!exprModelOptions.some((m) => m.id === expressionModel) && expressionModel && (
                        <option value="__custom__">Custom: {expressionModel}</option>
                      )}
                      <option value="__custom__">Enter custom model...</option>
                    </select>
                    {!exprModelOptions.some((m) => m.id === expressionModel) && (
                      <input
                        type="text"
                        value={expressionModel}
                        onChange={(e) => updateExpressionModel(e.target.value)}
                        placeholder="e.g. llama3.2"
                        className="w-full mt-1 px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={expressionModel}
                    onChange={(e) => updateExpressionModel(e.target.value)}
                    placeholder="e.g. llama3.2"
                    className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                  />
                )}
              </div>

              {/* API Key override */}
              <div>
                <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                  API Key
                </label>
                <input
                  type="password"
                  value={expressionApiKey}
                  onChange={(e) => updateExpressionApiKey(e.target.value)}
                  placeholder="Leave blank to use main key"
                  className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary font-mono"
                />
              </div>

              {/* Base URL (openai-compatible) */}
              {expressionProvider === 'openai-compatible' && (
                <div>
                  <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={expressionBaseUrl}
                    onChange={(e) => updateExpressionBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Audit Model Section
// ---------------------------------------------------------------------------

interface AuditModelSectionProps {
  useAudit: boolean;
  useAuditModel: boolean;
  auditProvider: AIProvider;
  auditModel: string;
  auditApiKey: string;
  auditBaseUrl: string;
  mainApiKey: string;
  updateUseAudit: (use: boolean) => Promise<void>;
  updateUseAuditModel: (use: boolean) => Promise<void>;
  updateAuditProvider: (provider: AIProvider) => Promise<void>;
  updateAuditModel: (model: string) => Promise<void>;
  updateAuditApiKey: (apiKey: string) => Promise<void>;
  updateAuditBaseUrl: (baseUrl: string) => Promise<void>;
}

const AuditModelSection: React.FC<AuditModelSectionProps> = ({
  useAudit,
  useAuditModel,
  auditProvider,
  auditModel,
  auditApiKey,
  auditBaseUrl,
  mainApiKey,
  updateUseAudit,
  updateUseAuditModel,
  updateAuditProvider,
  updateAuditModel,
  updateAuditApiKey,
  updateAuditBaseUrl,
}) => {
  const [expanded, setExpanded] = useState(useAudit);

  // Audit model list
  const [auditModels, setAuditModels] = useState<Array<{ id: string; name?: string }>>([]);
  const [auditModelsFetching, setAuditModelsFetching] = useState(false);

  const fetchAuditModels = useCallback(async () => {
    const key = auditApiKey || mainApiKey;
    if (auditProvider !== 'openai-compatible' && !key) {
      setAuditModels(PROVIDER_MODELS[auditProvider].map((id) => ({ id })));
      return;
    }
    setAuditModelsFetching(true);
    try {
      const models = await fetchProviderModels(auditProvider, key, auditBaseUrl || undefined);
      setAuditModels(models);
    } catch {
      setAuditModels(PROVIDER_MODELS[auditProvider].map((id) => ({ id })));
    } finally {
      setAuditModelsFetching(false);
    }
  }, [auditProvider, auditApiKey, auditBaseUrl, mainApiKey]);

  useEffect(() => {
    if (!useAuditModel) return;
    setAuditModels(PROVIDER_MODELS[auditProvider].map((id) => ({ id })));
    const key = auditApiKey || mainApiKey;
    if (auditProvider === 'openai-compatible' || key) {
      const timer = setTimeout(fetchAuditModels, 500);
      return () => clearTimeout(timer);
    }
  }, [useAuditModel, auditProvider, auditApiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const auditModelOptions: Array<{ id: string; name?: string }> = auditModels.length > 0
    ? auditModels
    : PROVIDER_MODELS[auditProvider].map((id) => ({ id }));

  return (
    <div className="border border-theme-border-secondary rounded">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (!useAudit && next) {
            updateUseAudit(true);
          }
        }}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-theme-text-primary hover:bg-theme-surface-hover transition-colors rounded"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Post-Turn Audit
        {useAudit && (
          <span className="ml-auto text-theme-text-tertiary font-normal truncate max-w-[120px]">
            {useAuditModel && auditModel ? auditModel : 'main model'}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-theme-border-secondary">
          <div className="pt-2">
            <Checkbox
              checked={useAudit}
              onCheckedChange={(checked) => updateUseAudit(checked === true)}
              label="Enable audit"
              description="After each agent turn, a second model reviews the work and flags potential issues. Adds one extra LLM call per turn."
            />
          </div>

          {useAudit && (
            <>
              <div className="pt-1">
                <Checkbox
                  checked={useAuditModel}
                  onCheckedChange={(checked) => updateUseAuditModel(checked === true)}
                  label="Use separate model"
                  description="Use a different model for auditing. If unchecked, the main model is used."
                />
              </div>

              {useAuditModel && (
                <>
                  {/* Provider */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                      Provider
                    </label>
                    <select
                      value={auditProvider}
                      onChange={(e) => updateAuditProvider(e.target.value as AIProvider)}
                      className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                    >
                      {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                        <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Model */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-theme-text-secondary">Model</label>
                      <button
                        onClick={fetchAuditModels}
                        disabled={auditModelsFetching}
                        className="flex items-center gap-1 text-xs text-theme-text-tertiary hover:text-theme-text-primary disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3 h-3 ${auditModelsFetching ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {auditModelOptions.length > 0 ? (
                      <>
                        <select
                          value={auditModelOptions.some((m) => m.id === auditModel) ? auditModel : '__custom__'}
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') updateAuditModel(e.target.value);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary"
                        >
                          {auditModelOptions.map((m) => (
                            <option key={m.id} value={m.id}>{m.id}</option>
                          ))}
                          {!auditModelOptions.some((m) => m.id === auditModel) && auditModel && (
                            <option value="__custom__">Custom: {auditModel}</option>
                          )}
                          <option value="__custom__">Enter custom model...</option>
                        </select>
                        {!auditModelOptions.some((m) => m.id === auditModel) && (
                          <input
                            type="text"
                            value={auditModel}
                            onChange={(e) => updateAuditModel(e.target.value)}
                            placeholder="e.g. gpt-4o-mini"
                            className="w-full mt-1 px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                          />
                        )}
                      </>
                    ) : (
                      <input
                        type="text"
                        value={auditModel}
                        onChange={(e) => updateAuditModel(e.target.value)}
                        placeholder="e.g. gpt-4o-mini"
                        className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                      />
                    )}
                  </div>

                  {/* API Key override */}
                  <div>
                    <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={auditApiKey}
                      onChange={(e) => updateAuditApiKey(e.target.value)}
                      placeholder="Leave blank to use main key"
                      className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary font-mono"
                    />
                  </div>

                  {/* Base URL (openai-compatible) */}
                  {auditProvider === 'openai-compatible' && (
                    <div>
                      <label className="block text-xs font-medium mb-1 text-theme-text-secondary">
                        Base URL
                      </label>
                      <input
                        type="text"
                        value={auditBaseUrl}
                        onChange={(e) => updateAuditBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full px-2.5 py-1.5 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-theme-border-focus bg-theme-bg-input border-theme-border-primary text-theme-text-primary placeholder:text-theme-text-tertiary"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AISettingsPanel;
