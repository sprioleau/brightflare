import Image from "next/image";
import { cn } from "@/lib/utils";

export type LogoVariant = "mark" | "wordmark" | "stacked" | "full";

type LogoProps = {
  size?: number;
  variant?: LogoVariant;
  className?: string;
};

export function Logo({ size = 32, variant = "wordmark", className }: LogoProps) {
  const isMarkOnly = variant === "mark";
  const isFullLogo = variant === "full";
  const imageWidth = isFullLogo ? Math.round(size * (698 / 128)) : size;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2.5 text-foreground",
        variant === "stacked" && "flex-col gap-1.5",
        className,
      )}
      data-variant={variant}
    >
      <Image
        src={isFullLogo ? "/assets/brightflare-logo-full.svg" : "/assets/brightflare-logo.svg"}
        alt={isMarkOnly || isFullLogo ? "brightflare" : ""}
        width={imageWidth}
        height={size}
        priority
      />
      {!isMarkOnly && !isFullLogo && (
        <span
          className="font-bold leading-none tracking-tight"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          brightflare
        </span>
      )}
    </span>
  );
}
