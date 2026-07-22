import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { KeyRound, Menu, RotateCcw, Save, TestTube2 } from 'lucide-react';

import { getDisplayName, maskEmail, shortId } from '../../display';
import type { WorkspaceRole } from '../../types';
import { Button } from '../ui/Button';
import { ContextSidebar } from '../ui/ContextSidebar';
import { LoadingState, PermissionDenied } from '../ui/AsyncState';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { DefinitionList, EnterpriseIsolationNotice, Feedback, roleLabel, SectionHeader } from './shared';
import type { EnterpriseSharedProps } from './types';

type SettingsSection = 'basic' | 'model' | 'permission' | 'storage' | 'security';

interface ModelForm {
  provider: string;
  model_name: string;
  api_key: string;
  base_url: string;
  temperature: string;
  max_tokens: string;
  enable_rag: boolean;
  return_sources: boolean;
}

const MODEL_CATALOG = [
  { key: 'deepseek', label: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1', 'deepseek-v3'], baseUrl: 'https://api.deepseek.com' },
  { key: 'chatgpt', label: 'ChatGPT', models: ['gpt-5', 'gpt-4o', 'gpt-4.1', 'o4-mini'], baseUrl: 'https://api.openai.com/v1' },
  { key: 'opus', label: 'Claude', models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-6'], baseUrl: 'https://api.anthropic.com/v1' },
  { key: 'glm', label: 'GLM', models: ['glm-5.2', 'glm-5', 'glm-4.7-flash', 'glm-4.6'], baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { key: 'qianwen', label: '千问', models: ['qwen3-235b-a22b', 'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-coder-plus', 'qwq-32b'], baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { key: 'doubao', label: '豆包', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite'], baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { key: 'gemini', label: 'Gemini', models: ['gemini-3.1-pro', 'gemini-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { key: 'kimi', label: 'Kimi', models: ['moonshot-v1-128k', 'kimi-k2.5'], baseUrl: 'https://api.moonshot.cn/v1' },
  { key: 'minimax', label: 'MiniMax', models: ['minimax-m2.5'], baseUrl: 'https://api.minimax.chat/v1' },
  { key: 'ernie', label: '文心一言', models: ['ernie-4.0'], baseUrl: 'https://qianfan.baidubce.com/v2' },
  { key: 'grok', label: 'Grok', models: ['grok-2'], baseUrl: 'https://api.x.ai/v1' },
];

const DEFAULT_CONFIG: Record<string, unknown> = {
  provider: 'deepseek', model_name: 'deepseek-v4-flash', api_key: '',
  base_url: 'https://api.deepseek.com', temperature: 0.2, max_tokens: 4096,
  enable_rag: true, return_sources: true, api_key_configured: false, api_key_masked: '',
};

function toForm(value: Record<string, unknown>): ModelForm {
  const provider = String(value.provider || 'deepseek');
  const catalog = MODEL_CATALOG.find((item) => item.key === provider) ?? MODEL_CATALOG[0];
  return {
    provider,
    model_name: String(value.model_name || catalog.models[0]),
    api_key: '',
    base_url: catalog.baseUrl,
    temperature: String(value.temperature ?? '0.2'),
    max_tokens: String(value.max_tokens ?? '4096'),
    enable_rag: typeof value.enable_rag === 'boolean' ? value.enable_rag : true,
    return_sources: typeof value.return_sources === 'boolean' ? value.return_sources : true,
  };
}

export function EnterpriseSettings({
  user,
  workspace,
  members,
  profile,
  workspaceSettings,
  loading,
  settingSavingKey,
  settingTestingKey,
  error,
  notice,
  onSaveWorkspaceSetting,
  onTestWorkspaceModelConnection,
}: EnterpriseSharedProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('basic');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const savedConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...(workspaceSettings.find((item) => item.setting_key === 'enterprise_model_api_config')?.setting_value ?? {}),
  }), [workspaceSettings]);
  const [form, setForm] = useState(() => toForm(savedConfig));

  useEffect(() => setForm(toForm(savedConfig)), [savedConfig, workspace.id]);

  const provider = MODEL_CATALOG.find((item) => item.key === form.provider) ?? MODEL_CATALOG[0];
  const saving = settingSavingKey === 'enterprise_model_api_config';
  const testing = settingTestingKey === 'enterprise_model_api_config';
  const keyConfigured = Boolean(savedConfig.api_key_configured);
  const keyMasked = String(savedConfig.api_key_masked || '');
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(savedConfig));

  function updateField(field: keyof ModelForm, value: string | boolean) {
    setForm((current) => {
      if (field !== 'provider') return { ...current, [field]: value };
      const nextProvider = MODEL_CATALOG.find((item) => item.key === value) ?? MODEL_CATALOG[0];
      return { ...current, provider: nextProvider.key, model_name: nextProvider.models[0], base_url: nextProvider.baseUrl };
    });
  }

  function payload() {
    return {
      provider: form.provider,
      model_name: form.model_name,
      api_key: form.api_key,
      base_url: provider.baseUrl,
      temperature: Number(form.temperature),
      max_tokens: Number(form.max_tokens),
      enable_rag: form.enable_rag,
      return_sources: form.return_sources,
    };
  }

  async function saveModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.canManageSettings) return;
    await onSaveWorkspaceSetting('enterprise_model_api_config', payload());
    setForm((current) => ({ ...current, api_key: '' }));
  }

  const sections: Record<SettingsSection, ReactNode> = {
    basic: (
      <section className="personal-section">
        <SectionHeader title="基础信息" description="当前企业空间身份与知识资产概况" />
        <DefinitionList items={[
          ['企业名称', workspace.name], ['当前用户', getDisplayName(user)], ['邮箱', maskEmail(user.email)],
          ['当前空间', '企业工作区'], ['角色', `${workspace.role || 'member'} / ${roleLabel(workspace.role)}`],
          ['工作区 ID', shortId(workspace.id)], ['文档数量', String(profile.documentCount)],
          ['知识片段', String(profile.chunkCount)], ['成员数量', String(profile.memberCount)],
        ]} />
      </section>
    ),
    model: (
      <form className="personal-section personal-config-form" onSubmit={saveModel}>
        <SectionHeader
          title="企业模型 API"
          description="保存后，问答服务会真实读取当前企业工作区配置；Base URL 由供应商白名单固定，降低错误和内网访问风险。"
          action={<StatusBadge status={keyConfigured ? 'configured' : 'missing'} label={keyConfigured ? 'API Key 已配置' : 'API Key 未配置'} />}
        />
        {!profile.canManageSettings ? <PermissionDenied title="无权修改企业模型配置" description="只有企业所有者和管理员可以保存或测试模型 API。" /> : null}
        <div className="personal-config-summary"><KeyRound size={17} aria-hidden="true" /><span>{keyConfigured ? `已保存密钥：${keyMasked || '已加密保存'}` : '尚未保存企业模型 API Key；不会伪装为已接入。'}</span></div>
        {dirty ? <p className="personal-unsaved-note">存在未保存更改。</p> : null}
        <fieldset disabled={!profile.canManageSettings || saving} className="personal-config-fieldset">
          <div className="personal-config-grid">
            <label><span>模型供应商</span><select value={form.provider} onChange={(event) => updateField('provider', event.target.value)}>{MODEL_CATALOG.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label><span>模型版本</span><select value={form.model_name} onChange={(event) => updateField('model_name', event.target.value)}>{provider.models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
            <label className="full"><span>Base URL</span><input value={provider.baseUrl} readOnly aria-readonly="true" /></label>
            <label className="full"><span>API Key</span><input type="password" autoComplete="new-password" value={form.api_key} placeholder={keyConfigured ? '留空则继续使用已保存密钥' : '输入企业模型 API Key'} onChange={(event) => updateField('api_key', event.target.value)} /></label>
            <label><span>温度参数：{form.temperature}</span><input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={(event) => updateField('temperature', event.target.value)} /></label>
            <label><span>最大回答长度</span><input type="number" min="256" max="8192" step="256" value={form.max_tokens} onChange={(event) => updateField('max_tokens', event.target.value)} /></label>
            <label className="personal-toggle-row"><input type="checkbox" checked={form.enable_rag} onChange={(event) => updateField('enable_rag', event.target.checked)} /><span>允许企业 RAG 问答</span></label>
            <label className="personal-toggle-row"><input type="checkbox" checked={form.return_sources} onChange={(event) => updateField('return_sources', event.target.checked)} /><span>返回引用来源</span></label>
          </div>
        </fieldset>
        <div className="personal-config-actions">
          <Button icon={RotateCcw} disabled={!profile.canManageSettings || saving} onClick={() => setForm(toForm(DEFAULT_CONFIG))}>恢复默认</Button>
          <Button icon={TestTube2} loading={testing} disabled={!profile.canManageSettings || saving} onClick={() => void onTestWorkspaceModelConnection('enterprise_model_api_config', payload())}>测试连接</Button>
          <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={!profile.canManageSettings}>保存模型 API</Button>
        </div>
      </form>
    ),
    permission: (
      <section className="personal-section">
        <SectionHeader title="权限配置" description="角色能力以后端真实权限为准" />
        <div className="personal-analysis-grid">
          {([
            ['owner', '所有者：管理成员、文档、设置和审计。'],
            ['admin', '管理员：管理文档、设置、审计及非管理员成员。'],
            ['member', '成员：上传、解析、删除文档，检索知识库并发起问答。'],
            ['viewer', '只读：查看企业知识资产并发起问答，不执行写操作。'],
          ] as Array<[WorkspaceRole, string]>).map(([role, description]) => (
            <article className="personal-analysis-block" key={role}><strong>{roleLabel(role)}</strong><span>{description}</span></article>
          ))}
        </div>
        <p className="personal-muted-note">当前已加载 {members.length} 名可管理成员；普通成员和只读用户不会获得成员或审计数据。</p>
      </section>
    ),
    storage: (
      <section className="personal-section">
        <SectionHeader title="存储配置" description="当前企业知识资产规模" />
        <DefinitionList items={[
          ['企业文档数量', String(profile.documentCount)], ['企业知识片段数量', String(profile.chunkCount)],
          ['存储占用', '暂无'], ['最近清理时间', '暂无'],
        ]} />
        <Button disabled title="暂未开放">清理缓存</Button>
      </section>
    ),
    security: (
      <section className="personal-section personal-security-section">
        <SectionHeader title="安全与隔离说明" description="企业版不可跨工作区的数据边界" />
        <ul>
          <li>当前为企业工作区。</li>
          <li>企业工作区数据仅当前企业成员在权限范围内可见。</li>
          <li>不会同步到个人工作区。</li>
          <li>不支持企业数据复制到个人空间。</li>
          <li>不支持个人数据导入企业空间。</li>
          <li>所有企业问答、文档、知识片段、向量索引和审计日志均限定在当前企业工作区内。</li>
        </ul>
      </section>
    ),
  };

  return (
    <section className="personal-workbench-v2 enterprise-workbench-v2 personal-page-settings">
      <PageHeader eyebrow="企业工作区" title="企业设置" description="管理企业身份、真实模型 API、权限策略、存储信息与安全隔离边界。" actions={<Button icon={Menu} onClick={() => setSidebarOpen(true)}>设置菜单</Button>} />
      <EnterpriseIsolationNotice />
      <Feedback error={error} notice={notice} />
      <div className="personal-context-layout personal-settings-layout">
        <ContextSidebar title="企业设置" open={sidebarOpen} activeKey={activeSection} onClose={() => setSidebarOpen(false)} onSelect={(key) => setActiveSection(key as SettingsSection)} items={[
          { key: 'basic', label: '基础信息' }, { key: 'model', label: '模型 API' },
          { key: 'permission', label: '权限策略' }, { key: 'storage', label: '存储配置' },
          { key: 'security', label: '安全隔离' },
        ]} />
        <div className="personal-context-content">{loading ? <LoadingState label="正在加载企业设置" /> : sections[activeSection]}</div>
      </div>
    </section>
  );
}
