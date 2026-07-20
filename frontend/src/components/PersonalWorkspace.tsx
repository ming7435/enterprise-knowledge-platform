import { useMemo } from 'react';

import { PersonalAdvanced } from './personal/PersonalAdvanced';
import { PersonalChat } from './personal/PersonalChat';
import { PersonalDocuments } from './personal/PersonalDocuments';
import { PersonalHome } from './personal/PersonalHome';
import { PersonalKnowledge } from './personal/PersonalKnowledge';
import { PersonalSettings } from './personal/PersonalSettings';
import { buildPersonalProfile } from './personal/shared';
import type { PersonalSharedProps, PersonalWorkspacePanelProps } from './personal/types';

export type { PersonalPageKey } from './personal/types';

export function PersonalWorkspacePanel(props: PersonalWorkspacePanelProps) {
  const {
    activePage,
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    searchQuery,
    searchResults,
    selectedFile,
    selectedFiles,
    documentContents,
    chatQuestion,
    chatMessages,
    selectedKnowledgeDocumentIds,
    selectedGraphDocumentIds,
    useKnowledgeBaseForChat,
    activeChatModelName,
    workspaceSettings,
    advancedOverview,
    knowledgeGraph,
    notifications,
    loading,
    uploading,
    searching,
    chatLoading,
    deletingDocumentId,
    deletingDocumentIds,
    settingSavingKey,
    settingTestingKey,
    error,
    notice,
    knowledgeDocumentFilter,
    onNavigate,
    onFileChange,
    onUpload,
    onDeleteDocument,
    onDeleteDocuments,
    onReprocessDocument,
    onLoadDocumentContent,
    onSaveWorkspaceSetting,
    onTestWorkspaceModelConnection,
    onRefreshModules,
    onRefreshAdvanced,
    onRebuildGraph,
    onSearchQueryChange,
    onKnowledgeDocumentFilterChange,
    onSearch,
    onClearSearch,
    onQuestionChange,
    onSelectedKnowledgeDocumentIdsChange,
    onSelectedGraphDocumentIdsChange,
    onSearchGraphNodes,
    onLoadGraphNodeDetail,
    onLoadGraphNeighbors,
    onUseKnowledgeBaseForChatChange,
    onAsk,
    onStop,
    onPrepareQuestion,
    onDeleteChatTurn,
    onClearChatHistory,
  } = props;

  const profile = useMemo(
    () => buildPersonalProfile(documents, knowledgeBase, chunks, chatMessages, notifications),
    [chatMessages, chunks, documents, knowledgeBase, notifications]
  );

  const shared: PersonalSharedProps = {
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    documentContents,
    chatMessages,
    selectedKnowledgeDocumentIds,
    selectedGraphDocumentIds,
    useKnowledgeBaseForChat,
    activeChatModelName,
    workspaceSettings,
    profile,
    loading,
    error,
    notice,
    settingSavingKey,
    settingTestingKey,
    onNavigate,
    onPrepareQuestion,
    onLoadDocumentContent,
    onSaveWorkspaceSetting,
    onTestWorkspaceModelConnection,
    onSelectedKnowledgeDocumentIdsChange,
    onSelectedGraphDocumentIdsChange,
    onSearchGraphNodes,
    onLoadGraphNodeDetail,
    onLoadGraphNeighbors,
    onUseKnowledgeBaseForChatChange,
  };

  if (activePage === 'documents') {
    return (
      <PersonalDocuments
        {...shared}
        selectedFile={selectedFile}
        selectedFiles={selectedFiles}
        uploading={uploading}
        deletingDocumentId={deletingDocumentId}
        deletingDocumentIds={deletingDocumentIds}
        onFileChange={onFileChange}
        onUpload={onUpload}
        onDeleteDocument={async (document) => (await onDeleteDocument(document)) === true}
        onDeleteDocuments={async (selectedDocuments) => (await onDeleteDocuments(selectedDocuments)) === true}
        onReprocessDocument={async (document) => (await onReprocessDocument(document)) === true}
        onRefresh={onRefreshModules}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  if (activePage === 'knowledge') {
    return (
      <PersonalKnowledge
        {...shared}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searching={searching}
        documentFilter={knowledgeDocumentFilter}
        onSearchQueryChange={onSearchQueryChange}
        onDocumentFilterChange={onKnowledgeDocumentFilterChange}
        onSearch={onSearch}
        onClearSearch={onClearSearch}
        onRefresh={onRefreshModules}
      />
    );
  }

  if (activePage === 'chat') {
    return (
      <PersonalChat
        {...shared}
        question={chatQuestion}
        chatLoading={chatLoading}
        onQuestionChange={onQuestionChange}
        onAsk={onAsk}
        onStop={onStop}
        onDeleteChatTurn={async (messageId) => (await onDeleteChatTurn(messageId)) === true}
        onClearChatHistory={async () => (await onClearChatHistory()) === true}
      />
    );
  }

  if (activePage === 'settings') return <PersonalSettings {...shared} />;

  if (activePage === 'advanced') {
    return (
      <PersonalAdvanced
        {...shared}
        overview={advancedOverview}
        graph={knowledgeGraph}
        notifications={notifications}
        loading={loading}
        onRefresh={onRefreshAdvanced}
        onRebuildGraph={onRebuildGraph}
        onSearchQueryChange={onSearchQueryChange}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  return (
    <PersonalHome
      {...shared}
      loading={loading}
      onRefresh={onRefreshModules}
      onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
    />
  );
}
