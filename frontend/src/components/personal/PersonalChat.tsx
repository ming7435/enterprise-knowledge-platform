import { useMemo, useState } from 'react';
import { AlertTriangle, Bot, HelpCircle, MessageSquare, Trash2, Upload } from 'lucide-react';

import type { KnowledgeChunk } from '../../types';
import { Button } from '../ui/Button';
import { ChatComposer } from '../ui/ChatComposer';
import { CitationPanel } from '../ui/CitationPanel';
import { EmptyState, LoadingState } from '../ui/AsyncState';
import { KnowledgeSelector } from '../ui/KnowledgeSelector';
import { PageHeader } from '../ui/PageHeader';
import { StatusBadge } from '../ui/StatusBadge';
import {
  ChunkDetailModal,
  copyText,
  Feedback,
  getQuestionTurns,
  PersonalIsolationNotice,
  SectionHeader,
  summarize,
} from './shared';
import type { PersonalSharedProps } from './types';

const RECOMMENDED_QUESTIONS = [
  '这份文档主要讲了什么？',
  '请总结当前知识库的核心内容',
  '这个项目的核心功能是什么？',
  '个人工作区和企业工作区有什么区别？',
  '当前文档中有哪些重要模块？',
  '请提取当前知识库中的关键概念',
];

export interface PersonalChatProps extends PersonalSharedProps {
  question: string;
  chatLoading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onStop: () => void;
  onDeleteChatTurn: (messageId: string) => boolean | Promise<boolean>;
  onClearChatHistory: () => boolean | Promise<boolean>;
}

export function PersonalChat({
  documents,
  selectedKnowledgeDocumentIds,
  useKnowledgeBaseForChat,
  activeChatModelName,
  chatMessages,
  question,
  loading,
  chatLoading,
  error,
  notice,
  profile,
  onNavigate,
  onSelectedKnowledgeDocumentIdsChange,
  onUseKnowledgeBaseForChatChange,
  onQuestionChange,
  onAsk,
  onStop,
  onPrepareQuestion,
  onDeleteChatTurn,
  onClearChatHistory,
}: PersonalChatProps) {
  const [selectedSource, setSelectedSource] = useState<KnowledgeChunk | null>(null);
  const [citationMessageId, setCitationMessageId] = useState<string | null>(null);
  const canAskWithKnowledge = profile.chunkCount > 0 && profile.knowledgeReady;
  const canAsk = !useKnowledgeBaseForChat || canAskWithKnowledge;
  const turns = getQuestionTurns(chatMessages);
  const assistantMessages = chatMessages.filter((message) => message.role === 'assistant');
  const citationMessage = useMemo(
    () => assistantMessages.find((message) => message.id === citationMessageId)
      ?? assistantMessages.at(-1)
      ?? null,
    [assistantMessages, citationMessageId]
  );
  const activeSources = citationMessage?.sources ?? [];

  return (
    <section className="personal-workbench-v2 personal-page-chat">
      <PageHeader
        eyebrow="个人工作区"
        title="智能问答"
        description="默认使用当前模型进行普通对话；开启知识库后进入 RAG 模式并展示真实引用来源。"
        status={<StatusBadge status={loading ? 'processing' : useKnowledgeBaseForChat ? 'ready' : 'configured'} label={loading ? '加载中' : useKnowledgeBaseForChat ? 'RAG 模式' : '普通对话'} />}
      />
      <PersonalIsolationNotice />
      <Feedback error={error} notice={notice} />
      {loading ? <LoadingState compact label="正在加载个人问答上下文" /> : null}

      <div className="personal-chat-status-strip">
        <div><span>当前模型</span><strong>{activeChatModelName || '未获取模型名称'}</strong></div>
        <div><span>回答模式</span><strong>{useKnowledgeBaseForChat ? 'RAG 知识库问答' : '普通大模型对话'}</strong></div>
        <div><span>已入库文档</span><strong>{profile.indexedDocumentCount}</strong></div>
        <div><span>知识片段</span><strong>{profile.chunkCount}</strong></div>
      </div>

      {useKnowledgeBaseForChat && !canAskWithKnowledge ? (
        <div className="personal-warning-bar" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>已开启知识库问答，但当前没有可检索内容。可关闭知识库继续普通对话，或先上传并解析文档。</span>
          <Button size="sm" icon={Upload} onClick={() => onNavigate('documents')}>去上传</Button>
        </div>
      ) : null}

      <section className="personal-section personal-prompt-section">
        <SectionHeader title="推荐问题" description="点击后填入输入框，可继续编辑" />
        <div className="personal-prompt-list">
          {RECOMMENDED_QUESTIONS.map((item) => (
            <button key={item} type="button" disabled={loading || chatLoading} onClick={() => onQuestionChange(item)}>
              <HelpCircle size={15} aria-hidden="true" />
              <span>{item}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="personal-chat-three-column">
        <aside className="personal-chat-history-panel">
          <SectionHeader
            title="历史问答"
            description={`${turns.length} 条当前会话记录`}
            action={turns.length ? (
              <Button size="sm" variant="ghost" icon={Trash2} disabled={loading || chatLoading} onClick={onClearChatHistory}>清空</Button>
            ) : undefined}
          />
          {turns.length === 0 ? (
            <EmptyState compact title="暂无历史问答" description="提出第一个问题后会在这里显示。" />
          ) : (
            <div className="personal-chat-history-list">
              {turns.map((turn) => (
                <article key={turn.id}>
                  <button type="button" onClick={() => onPrepareQuestion(turn.question)}>
                    <MessageSquare size={15} aria-hidden="true" />
                    <span>{turn.question}</span>
                  </button>
                  <div>
                    <small>{turn.timeLabel}</small>
                    <Button size="sm" variant="ghost" icon={Trash2} disabled={loading || chatLoading} onClick={() => void onDeleteChatTurn(turn.id)}>删除</Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </aside>

        <main className="personal-chat-main-panel">
          <div className="personal-chat-thread" aria-live="polite">
            {chatMessages.length === 0 ? (
              <EmptyState
                title={useKnowledgeBaseForChat ? '准备进行个人知识库问答' : '开始普通大模型对话'}
                description={useKnowledgeBaseForChat
                  ? '回答会限定在当前个人工作区，并展示后端真实返回的引用来源。'
                  : '默认不会检索知识库；需要文档引用时再开启右侧知识库开关。'}
                icon={Bot}
              />
            ) : (
              chatMessages.map((message, index) => {
                const isGenerating = chatLoading && index === chatMessages.length - 1 && message.role === 'assistant';
                return (
                  <article className={`personal-chat-message ${message.role}`} key={message.id}>
                    <div className="personal-chat-avatar" aria-hidden="true">{message.role === 'user' ? '你' : 'AI'}</div>
                    <div className="personal-chat-bubble">
                      <header>
                        <strong>{message.role === 'user' ? '你的问题' : 'AI 回答'}</strong>
                        {message.role === 'assistant' ? (
                          <span>
                            {message.useKnowledgeBase ? 'RAG' : '普通对话'}
                            {message.modelName ? ` · ${message.modelName}` : ''}
                          </span>
                        ) : null}
                      </header>
                      {isGenerating && !message.content ? (
                        <div className="personal-answer-skeleton" role="status"><span /><span /><span /></div>
                      ) : (
                        <>
                          <p>{message.content || '当前知识库没有检索到足够相关的内容，请换个问题或先补充文档。'}</p>
                          {isGenerating ? (
                            <span className="personal-generation-indicator" role="status">
                              <i /><i /><i /> 正在生成
                            </span>
                          ) : null}
                        </>
                      )}
                      {message.role === 'assistant' && message.useKnowledgeBase ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCitationMessageId(message.id)}
                        >
                          {message.sources?.length ? `查看 ${message.sources.length} 条引用` : '查看引用状态'}
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <ChatComposer
            value={question}
            loading={chatLoading}
            disabled={loading || !canAsk}
            useKnowledgeBase={useKnowledgeBaseForChat}
            modelName={activeChatModelName || '未获取模型名称'}
            onChange={onQuestionChange}
            onSubmit={onAsk}
            onStop={onStop}
          />
        </main>

        <aside className="personal-chat-context-panel">
          <label className="personal-rag-toggle">
            <input
              type="checkbox"
              checked={useKnowledgeBaseForChat}
              disabled={loading || chatLoading}
              onChange={(event) => onUseKnowledgeBaseForChatChange(event.target.checked)}
            />
            <span>
              <strong>使用知识库回答</strong>
              <small>关闭时为普通大模型对话</small>
            </span>
          </label>
          <SectionHeader
            title="问答知识库范围"
            description={useKnowledgeBaseForChat
              ? selectedKnowledgeDocumentIds.length
                ? `已选择 ${selectedKnowledgeDocumentIds.length} 个知识库`
                : '未选择时使用当前工作区全部知识库'
              : '当前选择不会参与普通对话'}
          />
          <KnowledgeSelector
            documents={documents}
            selectedIds={selectedKnowledgeDocumentIds}
            disabled={!useKnowledgeBaseForChat || loading || chatLoading}
            onChange={onSelectedKnowledgeDocumentIdsChange}
          />
          <CitationPanel
            sources={activeSources}
            emptyMessage={citationMessage?.useKnowledgeBase
              ? '本次回答未返回引用来源'
              : '普通大模型对话不使用知识库引用'}
            onOpenSource={setSelectedSource}
          />
        </aside>
      </div>

      <ChunkDetailModal
        open={Boolean(selectedSource)}
        chunk={selectedSource}
        onClose={() => setSelectedSource(null)}
        onAsk={(source) => {
          onPrepareQuestion(`请基于这个片段继续回答：${summarize(source.content, 80)}`, [source.document_id]);
          setSelectedSource(null);
        }}
        onCopy={(source) => copyText(source.content)}
      />
    </section>
  );
}
