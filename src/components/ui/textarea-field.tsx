
import {
  forwardRef,
  useId,
  type TextareaHTMLAttributes,
} from "react";

export type TextareaFieldProps =
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    error?: string;
    hint?: string;
    label: string;
    labelHidden?: boolean;
  };

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(function TextareaField(
  {
    className = "",
    error,
    hint,
    id,
    label,
    labelHidden = false,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = error || hint ? `${inputId}-description` : undefined;

  return (
    <label className="ui-field" htmlFor={inputId}>
      <span className={labelHidden ? "visually-hidden" : "ui-field-label"}>{label}</span>
      <textarea
        className={["ui-input", "ui-textarea", "custom-scrollbar", className]
          .filter(Boolean)
          .join(" ")}
        id={inputId}
        ref={ref}
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error || hint ? (
        <span
          className={`ui-field-message${error ? " ui-field-message--error" : ""}`}
          id={descriptionId}
        >
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});
