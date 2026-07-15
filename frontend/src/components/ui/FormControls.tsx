import { useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

export interface SegmentedControlOption<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<Value extends string> {
  value: Value;
  options: Array<SegmentedControlOption<Value>>;
  onChange: (value: Value) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel = '选项切换',
  disabled = false,
  className = '',
}: SegmentedControlProps<Value>) {
  return (
    <div className={`ui-segmented-control ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`ui-segmented-option ${active ? 'active' : ''}`}
            aria-pressed={active}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  onClear?: () => void;
}

export function SearchInput({
  label,
  hint,
  onClear,
  className = '',
  disabled,
  value,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SearchInputProps) {
  const generatedId = useId();
  const inputId = id ?? `search-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [ariaDescribedBy, hintId].filter(Boolean).join(' ') || undefined;
  const hasValue = typeof value === 'string' ? value.length > 0 : typeof value === 'number';
  const input = (
    <div className={`ui-input-shell ${disabled ? 'disabled' : ''} ${className}`.trim()}>
      <Search size={16} aria-hidden="true" />
      <input
        {...props}
        id={inputId}
        className="ui-input-control"
        type="search"
        disabled={disabled}
        value={value}
        aria-label={ariaLabel ?? (label ? undefined : '搜索')}
        aria-describedby={describedBy}
      />
      {onClear && hasValue && !disabled ? (
        <button type="button" className="ui-input-clear" aria-label="清空搜索" onClick={onClear}>
          <X size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  if (!label && !hint) return input;
  return (
    <div className="ui-field">
      {label ? <label className="ui-field-label" htmlFor={inputId}>{label}</label> : null}
      {input}
      {hint ? <span id={hintId} className="ui-field-hint">{hint}</span> : null}
    </div>
  );
}

export interface SelectFieldOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  hint?: string;
  options: SelectFieldOption[];
}

export function SelectField({ label, hint, options, className = '', ...props }: SelectFieldProps) {
  const select = (
    <select className={`ui-select-field ${className}`.trim()} aria-label={label ?? props['aria-label'] ?? '选择'} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!label && !hint) return select;
  return (
    <label className="ui-field">
      {label ? <span className="ui-field-label">{label}</span> : null}
      {select}
      {hint ? <span className="ui-field-hint">{hint}</span> : null}
    </label>
  );
}
