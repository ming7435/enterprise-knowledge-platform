import type { ReactNode } from 'react';
import { EmptyState, LoadingState } from './AsyncState';

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  width?: string;
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  emptyText: string;
}

export function DataTable<Row>({ rows, columns, rowKey, loading = false, emptyText }: DataTableProps<Row>) {
  const columnCount = Math.max(columns.length, 1);

  return (
    <div className="ui-data-table-shell">
      <div className="ui-data-table-scroll">
        <table className="ui-data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="ui-data-table-state-cell" colSpan={columnCount}>
                  <LoadingState compact label="正在加载数据" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="ui-data-table-state-cell" colSpan={columnCount}>
                  <EmptyState title={emptyText} compact />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
