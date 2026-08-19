import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "Green Book";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/green-book-logo.png"
      alt=""
      width={72}
      height={72}
      className={cn("brand-mark-img", className)}
    />
  );
}

export function BrandLogo({
  href = "/",
  className,
  markClassName,
  textClassName,
  ariaLabel = `${BRAND_NAME} home`,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} className={cn("brand-logo", className)} aria-label={ariaLabel}>
      <span className={cn("brand-logo-mark", markClassName)} aria-hidden>
        <BrandMark />
      </span>
      <span className={cn("brand-logo-text", textClassName)}>{BRAND_NAME}</span>
    </Link>
  );
}
