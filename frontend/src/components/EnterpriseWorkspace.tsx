import { useMemo } from 'react';

import { EnterpriseAdvanced } from './enterprise/EnterpriseAdvanced';
import { EnterpriseAudit } from './enterprise/EnterpriseAudit';
import { EnterpriseChat } from './enterprise/EnterpriseChat';
import { EnterpriseDocuments } from './enterprise/EnterpriseDocuments';
import { EnterpriseHome } from './enterprise/EnterpriseHome';
import { EnterpriseKnowledge } from './enterprise/EnterpriseKnowledge';
import { EnterpriseMembers } from './enterprise/EnterpriseMembers';
import { EnterpriseSettings } from './enterprise/EnterpriseSettings';
import { buildEnterpriseProfile } from './enterprise/shared';
import type { EnterpriseSharedProps, EnterpriseWorkspacePanelProps } from './enterprise/types';

export type { EnterprisePageKey } from './enterprise/types';

export function EnterpriseWorkspacePanel(props: EnterpriseWorkspacePanelProps) {
  const {
    activePage,
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    members,
    auditLogs,
    advancedOverview,
    knowledgeGraph,
    notifications,
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
    memberEmail,
    memberDepartment,
    memberRole,
    loading,
    uploading,
    searching,
    chatLoading,
    memberSaving,
    deletingDocumentId,
    deletingDocumentIds,
    memberActionId,
    deletingAuditLogId,
    auditBulkDeleting,
    auditRetentionDeleting,
    settingSavingKey,
    settingTestingKey,
    error,
    notice,
    knowledgeDocumentFilter,
    canManageMembers,
    canGrantAdmin,
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
    onRefreshEnterpriseDashboard,
    onRefreshAdvanced,
    onRebuildGraph,
    onRefreshMembers,
    onRefreshAuditLogs,
    onDeleteAuditLog,
    onDeleteAllAuditLogs,
    onDeleteAuditLogsByRetention,
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
    onEmailChange,
    onDepartmentChange,
    onRoleChange,
    onAddMember,
    onUpdateRole,
    onUpdateDepartment,
    onRemoveMember,
  } = props;

  const profile = useMemo(
    () => buildEnterpriseProfile(
      workspace,
      documents,
      knowledgeBase,
      chunks,
      members,
      auditLogs,
      chatMessages,
      notifications,
      canManageMembers
    ),
    [auditLogs, canManageMembers, chatMessages, chunks, documents, knowledgeBase, members, notifications, workspace]
  );

  const shared: EnterpriseSharedProps = {
    currentNavLabel,
    user,
    workspace,
    documents,
    knowledgeBase,
    chunks,
    members,
    auditLogs,
    documentContents,
    chatMessages,
    selectedKnowledgeDocumentIds,
    selectedGraphDocumentIds,
    useKnowledgeBaseForChat,
    activeChatModelName,
    workspaceSettings,
    notifications,
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
      <EnterpriseDocuments
        {...shared}
        selectedFile={selectedFile}
        selectedFiles={selectedFiles}
        uploading={uploading}
        deletingDocumentId={deletingDocumentId}
        deletingDocumentIds={deletingDocumentIds}
        onFileChange={onFileChange}
        onUpload={onUpload}
        onDeleteDocument={onDeleteDocument}
        onDeleteDocuments={onDeleteDocuments}
        onReprocessDocument={onReprocessDocument}
        onRefresh={onRefreshModules}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  if (activePage === 'knowledge') {
    return (
      <EnterpriseKnowledge
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
      <EnterpriseChat
        {...shared}
        question={chatQuestion}
        chatLoading={chatLoading}
        onQuestionChange={onQuestionChange}
        onAsk={onAsk}
        onStop={onStop}
        onDeleteChatTurn={onDeleteChatTurn}
        onClearChatHistory={onClearChatHistory}
      />
    );
  }

  if (activePage === 'settings') return <EnterpriseSettings {...shared} />;

  if (activePage === 'advanced') {
    return (
      <EnterpriseAdvanced
        {...shared}
        overview={advancedOverview}
        graph={knowledgeGraph}
        onRefresh={onRefreshAdvanced}
        onRebuildGraph={onRebuildGraph}
        onSearchQueryChange={onSearchQueryChange}
        onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
      />
    );
  }

  if (activePage === 'members') {
    return (
      <EnterpriseMembers
        {...shared}
        saving={memberSaving}
        actionMemberId={memberActionId}
        email={memberEmail}
        department={memberDepartment}
        role={memberRole}
        canManageMembers={canManageMembers}
        canGrantAdmin={canGrantAdmin}
        onEmailChange={onEmailChange}
        onDepartmentChange={onDepartmentChange}
        onRoleChange={onRoleChange}
        onAddMember={onAddMember}
        onUpdateRole={onUpdateRole}
        onUpdateDepartment={onUpdateDepartment}
        onRemoveMember={onRemoveMember}
        onRefresh={onRefreshMembers}
      />
    );
  }

  if (activePage === 'audit') {
    return (
      <EnterpriseAudit
        {...shared}
        canManageMembers={canManageMembers}
        deletingAuditLogId={deletingAuditLogId}
        auditBulkDeleting={auditBulkDeleting}
        auditRetentionDeleting={auditRetentionDeleting}
        onRefresh={onRefreshAuditLogs}
        onDeleteAuditLog={onDeleteAuditLog}
        onDeleteAllAuditLogs={onDeleteAllAuditLogs}
        onDeleteAuditLogsByRetention={onDeleteAuditLogsByRetention}
      />
    );
  }

  return (
    <EnterpriseHome
      {...shared}
      overview={advancedOverview}
      onRefresh={onRefreshEnterpriseDashboard}
      onKnowledgeDocumentFilterChange={onKnowledgeDocumentFilterChange}
    />
  );
}
