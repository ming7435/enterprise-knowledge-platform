import { Bot, Square, Trash2 } from 'lucide-react';

import { Button } from './Button';

export interface ChatComposerProps {
  value: string;
  loading: boolean;
  disabled?: boolean;
  useKnowledgeBase: boolean;
  modelName: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatComposer({
  value,
  loading,
  disabled = false,
  useKnowledgeBase,
  modelName,
  onChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const submitDisabled = disabled || loading || !value.trim();
  return (
    <form
      className="ui-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitDisabled) onSubmit();
      }}
    >
      <textarea
        value={value}
        disabled={disabled || loading}
        aria-label="输入问题"
        placeholder={useKnowledgeBase ? '输入你要问个人知识库的问题' : '输入问题，直接使用当前大模型正常对话'}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="ui-chat-composer-footer">
        <span>当前模型：{modelName} · {useKnowledgeBase ? 'RAG 知识库问答' : '普通大模型对话'}</span>
        <div>
          <Button size="sm" variant="ghost" icon={Trash2} disabled={!value || loading} onClick={() => onChange('')}>清空</Button>
          {loading ? (
            <Button size="sm" variant="danger" icon={Square} onClick={onStop}>停止</Button>
          ) : (
            <Button size="sm" variant="primary" icon={Bot} disabled={submitDisabled} type="submit">提问</Button>
          )}
        </div>
      </div>
    </form>
  );
}
