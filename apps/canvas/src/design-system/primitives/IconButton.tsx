import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tooltip?: string;
  pressed?: boolean;
  loading?: boolean;
  children: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      label,
      tooltip,
      pressed,
      loading = false,
      disabled,
      children,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const classes = ["ds-icon-button", className].filter(Boolean).join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        title={tooltip ?? label}
        aria-pressed={pressed}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? <span className="ds-button__spinner" aria-hidden="true" /> : children}
      </button>
    );
  },
);
