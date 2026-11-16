export function MarksIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v7a9 9 0 0 0 18 0V3M3 22h18" />
      <g strokeWidth="1.5" transform="translate(0 -1)">
        <path d="M12 7.5c-3.5 0-5.1-2.1-4.1-3.5C9.2 2.3 11.8 4.3 12 7.5Zm0 0c.2-3.2 2.8-5.2 4.1-3.5 1 1.4-.6 3.5-4.1 3.5Z" />
        <rect x="6.7" y="7.5" width="10.6" height="6.5" rx="3.25" />
        <path d="m5.2 10.8 1.5-.1m3.8-2.8a9 9 0 0 0 0 5.6" />
        <circle cx="14.8" cy="10.2" r=".8" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
