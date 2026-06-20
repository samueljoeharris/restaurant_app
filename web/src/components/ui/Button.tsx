import type { VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../lib/cn";
import { buttonVariants } from "./button-variants";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

type BaseProps = ButtonVariantProps & {
  children: ReactNode;
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined };

type LinkButtonProps = BaseProps & {
  to: string;
  replace?: boolean;
};

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  to,
  replace,
}: LinkButtonProps) {
  return (
    <Link
      to={to}
      replace={replace}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {children}
    </Link>
  );
}

export function ButtonAnchor({
  variant,
  size,
  fullWidth,
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
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
    >
      {children}
    </a>
  );
}
