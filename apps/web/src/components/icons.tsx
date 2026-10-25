/** One consistent line icon set (16px grid, 1.4 stroke). Always decorative: the label sits next to it. */
const PATHS: Record<string, string> = {
  briefing: "M3 2.5h10v11H3zM5.5 5.5h5M5.5 8h5M5.5 10.5h3",
  priorities: "M3 4.5h1.5M3 8h1.5M3 11.5h1.5M7 4.5h6M7 8h6M7 11.5h6",
  structure:
    "M2.5 3h4v3h-4zM9.5 2h4v3h-4zM9.5 8h4v3h-4zM2.5 10h4v3h-4zM6.5 4.5h3M6.5 4.5v7M6.5 9.5h3",
  impact:
    "M8 8m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M8 8m-4 0a4 4 0 108 0 4 4 0 10-8 0M8 1v2M8 13v2M1 8h2M13 8h2",
  risk: "M8 2L14.5 13.5h-13zM8 6.5v3.2M8 11.4v.2",
  quality: "M2.5 13.5V9M6.5 13.5V5M10.5 13.5V7.5M14 13.5H2",
  security: "M8 1.8l5 1.8v4.2c0 3-2.2 5-5 6.4C5.2 12.8 3 10.8 3 7.8V3.6z",
  practices: "M3 8.2l3 3L13 4.5",
  history: "M8 3v5l3 2M2.5 8a5.5 5.5 0 105.5-5.5A6 6 0 003.6 5M2.5 2.5V5.5H5.5",
  rules: "M3 3h10v10H3zM3 6.5h10M6.5 6.5V13",
  compare: "M5 3v10M11 3v10M2.5 5.5L5 3l2.5 2.5M8.5 10.5L11 13l2.5-2.5",
  export: "M8 2v8M4.8 6.8L8 10l3.2-3.2M3 13h10",
  more: "M3.5 8h.1M8 8h.1M12.5 8h.1",
  search: "M7 12a5 5 0 100-10 5 5 0 000 10zM14 14l-3.5-3.5",
  close: "M3.5 3.5l9 9M12.5 3.5l-9 9",
  glossary: "M3 2.5h8a2 2 0 012 2v9H5a2 2 0 01-2-2zM5.5 6h5M5.5 8.5h3",
  back: "M10 3L5 8l5 5",
  file: "M4 1.8h5l3 3v9.4H4zM9 1.8v3h3",
  link: "M7 9a2.5 2.5 0 003.5 0l2-2a2.5 2.5 0 00-3.5-3.5l-.6.6M9 7a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 007 12.5l.6-.6",
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className="icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name] ?? PATHS.more} />
    </svg>
  );
}
