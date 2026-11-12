import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "medium" | "large" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  className = "",
  size = "medium",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props} />;
}
