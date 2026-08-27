import type { TextareaHTMLAttributes } from "react";
import { FieldGroup, fieldDescriptionIds } from "./field-group";

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextArea({ id, label, hint, error, required, className, ...props }: TextAreaProps) {
  const classes = ["ev-field__control", className].filter(Boolean).join(" ");

  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        {...props}
        id={id}
        className={classes}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescriptionIds(id, hint, error)}
      />
    </FieldGroup>
  );
}
