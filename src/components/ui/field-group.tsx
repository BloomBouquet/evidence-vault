import type { ReactNode } from "react";

export type FieldMessageProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function fieldDescriptionIds(id: string, hint?: string, error?: string) {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
}

export function FieldGroup({ id, label, hint, error, required = false, children }: FieldMessageProps) {
  return (
    <div className="ev-field">
      <label className="ev-field__label" htmlFor={id}>
        {label}
        {required ? <span className="ev-field__required"> 필수</span> : null}
      </label>
      {children}
      {hint ? <p className="ev-field__hint" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="ev-field__error" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}
