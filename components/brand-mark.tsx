import type { SVGProps } from "react";

/**
 * The compact Vocab Learning mark.
 *
 * A speech bubble makes the language purpose readable at compact navigation scale; the inset V is
 * both the product initial and an open-book gesture. The doubled ink/sun stroke keeps the
 * bright accent crisp against the white bubble without giving up the app's outlined,
 * cut-paper visual language.
 */
export function BrandMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-testid="brand-mark"
      {...props}
    >
      <rect
        x="1.25"
        y="1.25"
        width="37.5"
        height="37.5"
        rx="10.75"
        fill="var(--brand)"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />

      <path
        d="M11 8.5h18a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5h-7.2L16 32v-4.5h-5a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5Z"
        fill="white"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="m12.5 15.25 7.5 7.5 7.5-7.5"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12.5 15.25 7.5 7.5 7.5-7.5"
        fill="none"
        stroke="var(--accent-sun)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
