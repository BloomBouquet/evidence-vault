import type { SelectHTMLAttributes } from "react";
import { FieldGroup, fieldDescriptionIds } from "./field-group";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  options: readonly SelectOption[];
};

export function SelectField({
  id,
  label,
  hint,
  error,
  required,
  className,
  options,
  ...props
}: SelectFieldProps) {
  const classes = ["ev-field__control", className].filter(Boolean).join(" ");

  return (
    <FieldGroup id={id} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={id}
        className={classes}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescriptionIds(id, hint, error)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldGroup>
  );
}
