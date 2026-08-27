import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
};

export function Button({
  type = "button",
  variant = "primary",
  size = "md",
  busy = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    "ev-button",
    `ev-button--${variant}`,
    `ev-button--${size}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    />
  );
}
