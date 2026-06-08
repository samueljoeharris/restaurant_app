import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };

type LinkButtonProps = BaseProps & {
  to: string;
  replace?: boolean;
};

function classes(variant: Variant, size: Size, fullWidth: boolean, extra?: string) {
  return [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    fullWidth ? "ui-btn--full" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={classes(variant, size, fullWidth, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  to,
  replace,
}: LinkButtonProps) {
  return (
    <Link to={to} replace={replace} className={classes(variant, size, fullWidth, className)}>
      {children}
    </Link>
  );
}

export function ButtonAnchor({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  href,
  target,
  rel,
}: BaseProps & {
  href: string;
  target?: string;
  rel?: string;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={classes(variant, size, fullWidth, className)}
    >
      {children}
    </a>
  );
}
