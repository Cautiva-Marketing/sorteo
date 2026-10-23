import type { SVGProps } from "react";

/** Íconos de línea (trazo 1.75, 24×24) hechos a mano: decorativos y heredan `currentColor`. */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 5.5v13l11-6.5z" />
  </Icon>
);
export const GiftIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v7.5h14V12M12 8v11.5M12 8c-2.5 0-4.5-.6-4.5-2.2S9 3.5 12 8Zm0 0c2.5 0 4.5-.6 4.5-2.2S15 3.5 12 8Z" />
  </Icon>
);
export const UsersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 19.5c.4-3.2 2.8-5 6-5s5.6 1.8 6 5M16 5.5a3 3 0 0 1 0 6M17.5 14.8c2 .5 3.2 2 3.5 4.7" />
  </Icon>
);
export const TrophyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4.5c0 2.5 1.2 3.8 3.5 4M16 6h3.5c0 2.5-1.2 3.8-3.5 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
  </Icon>
);
export const MegaphoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 10v4h3l7 4V6l-7 4H4ZM17.5 9.5a4 4 0 0 1 0 5" />
  </Icon>
);
export const QrIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <path d="M14 14h2.5v2.5H14zM18.5 14H20M14 19h2M18 18.5V20" />
  </Icon>
);
export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h4M14 8l4 4-4 4M18 12H9.5" />
  </Icon>
);
export const VolumeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5v5h3.5l4.5 3.5V6L7.5 9.5H4ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);
export const VolumeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 9.5v5h3.5l4.5 3.5V6L7.5 9.5H4ZM16 9.5l5 5M21 9.5l-5 5" />
  </Icon>
);
export const ExpandIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
  </Icon>
);
export const ShrinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7" />
  </Icon>
);
export const SparklesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9 12 3.5ZM19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </Icon>
);
export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
  </Icon>
);
export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 11a7.5 7.5 0 1 1 2.2 5.3M4.5 5.5V11H10" />
  </Icon>
);
export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v10M8 10.5l4 4 4-4M5 19.5h14" />
  </Icon>
);
