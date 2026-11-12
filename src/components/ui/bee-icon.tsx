import type { SVGProps } from 'react';

type BeeIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export function BeeIcon({ size = 20, ...props }: BeeIconProps) {
  return (
    <svg
      {...props}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M11.35 8.85c-3.1.05-5.85-1.55-6.1-3.65-.17-1.45 1.05-2.35 2.45-1.95 2.2.65 3.5 2.85 3.65 5.6Z"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M11.55 8.85c.35-2.8 1.9-5 4.05-5.35 1.4-.2 2.4.85 2.05 2.25-.45 2-2.9 3.25-6.1 3.1Z"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path d="m5.85 12.25-2.45 1.4 2.45 1.35Z" fill="currentColor" />
      <rect
        fill="currentColor"
        fillOpacity="0.12"
        height="10.8"
        rx="5.4"
        width="15"
        x="5.7"
        y="8.15"
      />
      <path d="M9.15 8.75c-.55 1.35-.8 2.95-.8 4.8s.25 3.45.8 4.8" />
      <path d="M12.1 8.2c-.55 1.5-.8 3.3-.8 5.35s.25 3.85.8 5.35" />
      <path d="m16.85 8.45-.45-1.85" />
      <path d="m18.9 8.7.95-1.7" />
      <circle cx="16.3" cy="6.25" fill="currentColor" r="0.65" stroke="none" />
      <circle cx="20.05" cy="6.65" fill="currentColor" r="0.65" stroke="none" />
      <circle cx="16.75" cy="12.25" fill="currentColor" r="0.65" stroke="none" />
      <circle cx="18.75" cy="12.25" fill="currentColor" r="0.65" stroke="none" />
      <path d="M16.85 15c.55.55 1.25.55 1.8 0" />
    </svg>
  );
}
