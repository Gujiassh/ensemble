import { useId, type SelectHTMLAttributes } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label: string;
  hint?: string;
  error?: string | null;
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function Select({
  label,
  hint,
  error,
  options,
  value,
  onValueChange,
  id,
  className,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      <label className="ds-field__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="ds-field__select"
        value={value}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onValueChange(event.target.value)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span id={hintId} className="ds-field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="ds-field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
