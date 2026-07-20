import type { KnowledgeChunk } from '../../types';
import { Button } from './Button';

export interface CitationPanelProps {
  sources: KnowledgeChunk[];
  emptyMessage: string;
  onOpenSource: (source: KnowledgeChunk) => void;
}

export function CitationPanel({ sources, emptyMessage, onOpenSource }: CitationPanelProps) {
  return (
    <section className="ui-citation-panel" aria-label="引用来源">
      <header>
        <strong>引用来源</strong>
        <span>{sources.length} 条</span>
      </header>
      {sources.length === 0 ? (
        <p className="ui-citation-empty">{emptyMessage}</p>
      ) : (
        <div className="ui-citation-list">
          {sources.map((source) => (
            <article key={source.id}>
              <div>
                <strong title={source.filename}>{source.filename}</strong>
                <span>
                  片段 #{source.chunk_index + 1}
                  {typeof source.score === 'number' ? ` · 相似度 ${source.score.toFixed(2)}` : ''}
                </span>
              </div>
              <p>{source.content.replace(/\s+/g, ' ').slice(0, 120)}{source.content.length > 120 ? '...' : ''}</p>
              <Button size="sm" variant="ghost" onClick={() => onOpenSource(source)}>查看片段</Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
