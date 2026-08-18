import {
  useId,
  useRef,
  type ChangeEvent,
  type CompositionEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  hint?: string;
  error?: string | null;
  value: string;
  onValueChange: (value: string) => void;
  onSubmitIntent?: () => void;
};

export function TextField({
  label,
  hint,
  error,
  value,
  onValueChange,
  onSubmitIntent,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const composingRef = useRef(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value);
  }

  function handleCompositionStart() {
    composingRef.current = true;
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    composingRef.current = false;
    onValueChange((event.target as HTMLInputElement).value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    if (composingRef.current || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    onSubmitIntent?.();
  }

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["ds-field", className].filter(Boolean).join(" ")}>
      <label className="ds-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="ds-field__input"
        value={value}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy || undefined}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        {...rest}
      />
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
