import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { KeyRound, Menu, RotateCcw, Save, TestTube2 } from 'lucide-react';

import { maskEmail, shortId } from '../../display';
import type { WorkspaceSettingRecord } from '../../types';
import { Button } from '../ui/Button';
import { ContextSidebar } from '../ui/ContextSidebar';
import { LoadingState } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  DefinitionList,
  Feedback,
  PersonalIsolationNotice,
  SectionHeader,
} from './shared';
import type { PersonalSharedProps } from './types';

type SettingsSection = 'basic' | 'model' | 'vector' | 'storage' | 'security';

interface ModelConfigForm {
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  temperature: string;
  max_tokens: string;
  enable_rag: boolean;
  return_sources: boolean;
}

interface VectorConfigForm {
  embedding_model: string;
  top_k: string;
  score_threshold: string;
  retrieval_mode: string;
  rerank_enabled: boolean;
  chunk_size: string;
  chunk_overlap: string;
}

const MODEL_CATALOG = [
  { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v3'], baseUrl: 'https://api.deepseek.com' },
  { key: 'chatgpt', label: 'ChatGPT', models: ['gpt-5', 'gpt-4o', 'gpt-4.1', 'o4-mini'], baseUrl: 'https://api.openai.com/v1' },
  { key: 'opus', label: 'Claude', models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-6'], baseUrl: 'https://api.anthropic.com/v1' },
  { key: 'glm', label: 'GLM', models: ['glm-5.2', 'glm-5', 'glm-4.7-flash', 'glm-4.6'], baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { key: 'qianwen', label: '千问', models: ['qwen3-235b-a22b', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwq-32b'], baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'doubao', label: '豆包', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite'], baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { key: 'gemini', label: 'Gemini', models: ['gemini-3.1-pro', 'gemini-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { key: 'kimi', label: 'Kimi', models: ['moonshot-v1-128k', 'kimi-k2.5'], baseUrl: 'https://api.moonshot.cn/v1' },
  { key: 'minimax', label: 'MiniMax', models: ['minimax-m2.5'], baseUrl: 'https://api.minimax.chat/v1' },
  { key: 'ernie', label: '文心一言', models: ['ernie-4.0'], baseUrl: 'https://qianfan.baidubce.com/v2' },
  { key: 'grok', label: 'Grok', models: ['grok-2'], baseUrl: 'https://api.x.ai/v1' },
];

function personalModelDefaults(): Record<string, unknown> {
  return {
    provider: 'deepseek',
    model_name: 'deepseek-v4-flash',
    api_key: '',
    base_url: 'https://api.deepseek.com',
    temperature: 0.2,
    max_tokens: 2048,
    enable_rag: true,
    return_sources: true,
    api_key_configured: false,
    api_key_masked: '',
  };
}

function personalVectorDefaults(): Record<string, unknown> {
  return {
    vector_type: 'milvus',
    embedding_model: 'bge-m3:567m',
    top_k: 5,
    score_threshold: 0.35,
    retrieval_mode: 'hybrid',
    rerank_enabled: true,
    chunk_size: 800,
    chunk_overlap: 120,
  };
}

function getSettingValue(settings: WorkspaceSettingRecord[], key: string, fallback: Record<string, unknown>) {
  return { ...fallback, ...(settings.find((item) => item.setting_key === key)?.setting_value ?? {}) };
}

function textValue(value: unknown, fallback: string) {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function toModelForm(value: Record<string, unknown>): ModelConfigForm {
  return {
    provider: textValue(value.provider, 'deepseek'),
    model_name: textValue(value.model_name, 'deepseek-v4-flash'),
    api_key: '',
    base_url: textValue(value.base_url, 'https://api.deepseek.com'),
    temperature: textValue(value.temperature, '0.2'),
    max_tokens: textValue(value.max_tokens, '2048'),
    enable_rag: booleanValue(value.enable_rag, true),
    return_sources: booleanValue(value.return_sources, true),
  };
}

function toVectorForm(value: Record<string, unknown>): VectorConfigForm {
  return {
    embedding_model: textValue(value.embedding_model, 'bge-m3:567m'),
    top_k: textValue(value.top_k, '5'),
    score_threshold: textValue(value.score_threshold, '0.35'),
    retrieval_mode: textValue(value.retrieval_mode, 'hybrid'),
    rerank_enabled: booleanValue(value.rerank_enabled, true),
    chunk_size: textValue(value.chunk_size, '800'),
    chunk_overlap: textValue(value.chunk_overlap, '120'),
  };
}

export function PersonalSettings({
  user,
  workspace,
  profile,
  workspaceSettings,
  loading,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection,
}: PersonalSharedProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('basic');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const modelConfig = useMemo(
    () => getSettingValue(workspaceSettings, 'personal_model_config', personalModelDefaults()),
    [workspaceSettings]
  );
  const vectorConfig = useMemo(
    () => getSettingValue(workspaceSettings, 'personal_vector_config', personalVectorDefaults()),
    [workspaceSettings]
  );
  const [modelForm, setModelForm] = useState(() => toModelForm(modelConfig));
  const [vectorForm, setVectorForm] = useState(() => toVectorForm(vectorConfig));

  useEffect(() => setModelForm(toModelForm(modelConfig)), [modelConfig, workspace.id]);
  useEffect(() => setVectorForm(toVectorForm(vectorConfig)), [vectorConfig, workspace.id]);

  const provider = MODEL_CATALOG.find((item) => item.key === modelForm.provider);
  const modelOptions = provider?.models ?? [];
  const isModelSaving = settingSavingKey === 'personal_model_config';
  const isModelTesting = settingTestingKey === 'personal_model_config';
  const isVectorSaving = settingSavingKey === 'personal_vector_config';
  const modelKeyConfigured = Boolean(modelConfig.api_key_configured);
  const modelKeyMasked = String(modelConfig.api_key_masked || '');
  const modelDirty = JSON.stringify(modelForm) !== JSON.stringify(toModelForm(modelConfig));
  const vectorDirty = JSON.stringify(vectorForm) !== JSON.stringify(toVectorForm(vectorConfig));

  function updateModelField(field: keyof ModelConfigForm, value: string | boolean) {
    setModelForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'provider') {
        const nextProvider = MODEL_CATALOG.find((item) => item.key === value);
        next.model_name = nextProvider?.models[0] ?? current.model_name;
        next.base_url = nextProvider?.baseUrl ?? current.base_url;
      }
      return next;
    });
  }

  function modelPayload() {
    return {
      provider: modelForm.provider,
      model_name: modelForm.model_name,
      api_key: modelForm.api_key,
      base_url: modelForm.base_url,
      temperature: Number(modelForm.temperature),
      max_tokens: Number(modelForm.max_tokens),
      enable_rag: modelForm.enable_rag,
      return_sources: modelForm.return_sources,
    };
  }

  async function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveWorkspaceSetting('personal_model_config', modelPayload());
    setModelForm((current) => ({ ...current, api_key: '' }));
  }

  function saveVector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSaveWorkspaceSetting('personal_vector_config', {
      vector_type: 'milvus',
      embedding_model: vectorForm.embedding_model,
      top_k: Number(vectorForm.top_k),
      score_threshold: Number(vectorForm.score_threshold),
      retrieval_mode: vectorForm.retrieval_mode,
      rerank_enabled: vectorForm.rerank_enabled,
      chunk_size: Number(vectorForm.chunk_size),
      chunk_overlap: Number(vectorForm.chunk_overlap),
    });
  }

  const sectionContent = {
    basic: (
      <section className="personal-section">
        <SectionHeader title="基础信息" description="当前个人空间身份与知识资产概况" />
        <DefinitionList items={[
          ['用户名', user.username || '暂无'],
          ['邮箱', maskEmail(user.email)],
          ['当前空间', '个人工作区'],
          ['角色', workspace.role || 'owner'],
          ['工作区 ID', shortId(workspace.id)],
          ['文档数量', String(profile.documentCount)],
          ['知识片段', String(profile.chunkCount)],
        ]} />
      </section>
    ),
    model: (
      <form className="personal-section personal-config-form" onSubmit={saveModel}>
        <SectionHeader
          title="模型配置"
          description="保存后，问答服务会真实读取当前个人工作区的模型配置；未配置密钥时不会伪装为已接入。"
          action={<StatusBadge status={modelKeyConfigured ? 'configured' : 'missing'} label={modelKeyConfigured ? 'API Key 已配置' : 'API Key 未配置'} />}
        />
        <div className="personal-config-summary">
          <KeyRound size={17} aria-hidden="true" />
          <span>{modelKeyConfigured ? `已保存密钥：${modelKeyMasked || '已安全加密'}` : '尚未保存个人模型 API Key；是否可用取决于服务器系统级模型配置或本地模型。'}</span>
        </div>
        {modelDirty ? <p className="personal-unsaved-note">存在未保存更改。</p> : null}
        <div className="personal-config-grid">
          <label><span>模型供应商</span><select value={modelForm.provider} onChange={(event) => updateModelField('provider', event.target.value)}>{MODEL_CATALOG.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <label><span>模型版本</span><select value={modelForm.model_name} onChange={(event) => updateModelField('model_name', event.target.value)}>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
          <label className="full"><span>Base URL</span><input value={modelForm.base_url} onChange={(event) => updateModelField('base_url', event.target.value)} /></label>
          <label className="full"><span>API Key</span><input type="password" value={modelForm.api_key} autoComplete="off" placeholder={modelKeyConfigured ? '留空则继续使用已保存密钥' : '请输入模型 API Key'} onChange={(event) => updateModelField('api_key', event.target.value)} /></label>
          <label><span>温度参数：{modelForm.temperature}</span><input type="range" min="0" max="2" step="0.1" value={modelForm.temperature} onChange={(event) => updateModelField('temperature', event.target.value)} /></label>
          <label><span>最大回答长度</span><input type="number" min="256" max="8192" step="256" value={modelForm.max_tokens} onChange={(event) => updateModelField('max_tokens', event.target.value)} /></label>
          <label className="personal-toggle-row"><input type="checkbox" checked={modelForm.enable_rag} onChange={(event) => updateModelField('enable_rag', event.target.checked)} /><span>启用 RAG 知识库问答</span></label>
          <label className="personal-toggle-row"><input type="checkbox" checked={modelForm.return_sources} onChange={(event) => updateModelField('return_sources', event.target.checked)} /><span>返回引用来源</span></label>
        </div>
        <div className="personal-config-actions">
          <Button icon={RotateCcw} disabled={isModelSaving} onClick={() => setModelForm(toModelForm(personalModelDefaults()))}>恢复默认</Button>
          <Button icon={TestTube2} loading={isModelTesting} disabled={isModelSaving} onClick={() => void onTestWorkspaceModelConnection('personal_model_config', modelPayload())}>测试连接</Button>
          <Button variant="primary" icon={Save} loading={isModelSaving} type="submit">保存模型配置</Button>
        </div>
      </form>
    ),
    vector: (
      <form className="personal-section personal-config-form" onSubmit={saveVector}>
        <SectionHeader title="向量检索" description="个人区统一使用 Milvus，可调整召回、阈值、切片和 Rerank 参数。" />
        {vectorDirty ? <p className="personal-unsaved-note">存在未保存更改。</p> : null}
        <div className="personal-config-grid">
          <label><span>向量库类型</span><input value="Milvus" readOnly disabled /></label>
          <label><span>Embedding 模型</span><input value={vectorForm.embedding_model} onChange={(event) => setVectorForm((current) => ({ ...current, embedding_model: event.target.value }))} /></label>
          <label><span>Top K</span><input type="number" min="1" max="20" value={vectorForm.top_k} onChange={(event) => setVectorForm((current) => ({ ...current, top_k: event.target.value }))} /></label>
          <label><span>相似度阈值：{Number(vectorForm.score_threshold).toFixed(2)}</span><input type="range" min="0" max="1" step="0.01" value={vectorForm.score_threshold} onChange={(event) => setVectorForm((current) => ({ ...current, score_threshold: event.target.value }))} /></label>
          <label><span>检索模式</span><select value={vectorForm.retrieval_mode} onChange={(event) => setVectorForm((current) => ({ ...current, retrieval_mode: event.target.value }))}><option value="hybrid">混合检索</option><option value="vector">向量检索</option><option value="keyword">关键词检索</option></select></label>
          <label className="personal-toggle-row"><input type="checkbox" checked={vectorForm.rerank_enabled} onChange={(event) => setVectorForm((current) => ({ ...current, rerank_enabled: event.target.checked }))} /><span>启用 Rerank</span></label>
          <label><span>切片长度</span><input type="number" min="200" max="3000" value={vectorForm.chunk_size} onChange={(event) => setVectorForm((current) => ({ ...current, chunk_size: event.target.value }))} /></label>
          <label><span>切片重叠</span><input type="number" min="0" max="1000" value={vectorForm.chunk_overlap} onChange={(event) => setVectorForm((current) => ({ ...current, chunk_overlap: event.target.value }))} /></label>
        </div>
        <div className="personal-config-actions">
          <Button icon={RotateCcw} disabled={isVectorSaving} onClick={() => setVectorForm(toVectorForm(personalVectorDefaults()))}>恢复默认</Button>
          <Button variant="primary" icon={Save} loading={isVectorSaving} type="submit">保存向量配置</Button>
        </div>
      </form>
    ),
    storage: (
      <section className="personal-section">
        <SectionHeader title="存储配置" description="当前个人知识资产规模" />
        <DefinitionList items={[
          ['文档数量', String(profile.documentCount)],
          ['知识片段数量', String(profile.chunkCount)],
          ['存储占用', '暂无'],
          ['最近清理时间', '暂无'],
        ]} />
        <Button disabled title="暂未开放">清理缓存</Button>
      </section>
    ),
    security: (
      <section className="personal-section personal-security-section">
        <SectionHeader title="安全与隔离说明" description="个人版不可跨工作区的数据边界" />
        <ul>
          <li>当前为个人工作区。</li>
          <li>个人工作区数据仅个人可见。</li>
          <li>不会同步到企业工作区。</li>
          <li>不支持企业数据复制到个人空间。</li>
          <li>不支持个人数据导入企业空间。</li>
          <li>所有个人问答、文档、知识片段、向量索引均限定在当前个人工作区内。</li>
        </ul>
      </section>
    ),
  } satisfies Record<SettingsSection, ReactNode>;

  return (
    <section className="personal-workbench-v2 personal-page-settings">
      <PageHeader eyebrow="个人工作区" title="个人设置" description="管理个人身份、真实模型连接、Milvus 检索参数与数据隔离边界。" actions={<Button icon={Menu} onClick={() => setSidebarOpen(true)}>设置菜单</Button>} />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={notice} />
      <div className="personal-context-layout personal-settings-layout">
        <ContextSidebar
          title="个人设置"
          open={sidebarOpen}
          activeKey={activeSection}
          onClose={() => setSidebarOpen(false)}
          onSelect={(key) => setActiveSection(key as SettingsSection)}
          items={[
            { key: 'basic', label: '基础信息' },
            { key: 'model', label: '模型配置' },
            { key: 'vector', label: '向量检索' },
            { key: 'storage', label: '存储配置' },
            { key: 'security', label: '安全隔离' },
          ]}
        />
        <div className="personal-context-content">
          {loading ? <LoadingState label="正在加载个人设置" /> : sectionContent[activeSection]}
        </div>
      </div>
    </section>
  );
}
