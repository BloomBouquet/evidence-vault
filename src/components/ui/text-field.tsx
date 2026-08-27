import type { InputHTMLAttributes } from "react";
import { FieldGroup, fieldDescriptionIds } from "./field-group";

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ id, label, hint, error, required, className, ...props }: TextFieldProps) {
  const classes = ["ev-field__control", className].filter(Boolean).join(" ");

  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required}>
      <input
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
