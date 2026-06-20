import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold font-[inherit] cursor-pointer transition-[transform,background,box-shadow,border-color,color] duration-fast disabled:opacity-55 disabled:cursor-not-allowed active:enabled:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "border-0 bg-brand text-text-inverse shadow-brand hover:enabled:bg-brand-hover",
        secondary:
          "border border-border-strong bg-surface text-text hover:enabled:border-brand/40",
        ghost:
          "border-0 bg-transparent text-text-muted hover:enabled:bg-brand-soft hover:enabled:text-brand",
        danger: "border-0 bg-error-soft text-error",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-[1.1rem] py-2.5 text-base",
        lg: "px-[1.35rem] py-3 text-lg",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);
