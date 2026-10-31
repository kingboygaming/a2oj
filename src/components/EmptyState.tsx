import Link from "next/link";

export type EmptyStateType =
  | "no-results"
  | "no-submissions"
  | "no-problems"
  | "no-contests"
  | "no-users"
  | "login-required"
  | "generic";

interface EmptyStateProps {
  type: EmptyStateType;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href: string };
}

/* ── SVG Illustrations ─────────────────────────────────────────── */

function NoResultsIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer lens ring */}
      <circle
        cx="42"
        cy="42"
        r="26"
        stroke="var(--teal)"
        strokeOpacity="0.25"
        strokeWidth="3"
        fill="var(--teal)"
        fillOpacity="0.06"
      />
      {/* Inner lens tint */}
      <circle cx="42" cy="42" r="20" fill="var(--teal)" fillOpacity="0.08" />
      {/* Handle */}
      <line
        x1="61"
        y1="61"
        x2="78"
        y2="78"
        stroke="var(--teal)"
        strokeOpacity="0.35"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Question mark stem */}
      <path
        d="M42 50v3"
        stroke="var(--teal)"
        strokeOpacity="0.6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Question mark arc */}
      <path
        d="M37 38.5c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.5-2 3.5-4 5"
        stroke="var(--teal)"
        strokeOpacity="0.6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Question mark dot */}
      <circle cx="42" cy="56" r="1.5" fill="var(--teal)" fillOpacity="0.6" />
    </svg>
  );
}

function NoSubmissionsIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Box bottom */}
      <rect
        x="18"
        y="54"
        width="60"
        height="26"
        rx="4"
        fill="rgb(139 92 246 / 0.1)"
        stroke="rgb(139 92 246 / 0.35)"
        strokeWidth="2"
      />
      {/* Box left flap */}
      <path
        d="M18 54 L30 40 L48 40"
        stroke="rgb(139 92 246 / 0.35)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="rgb(139 92 246 / 0.07)"
      />
      {/* Box right flap */}
      <path
        d="M78 54 L66 40 L48 40"
        stroke="rgb(139 92 246 / 0.35)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="rgb(139 92 246 / 0.07)"
      />
      {/* Flap divider line */}
      <line
        x1="48"
        y1="40"
        x2="48"
        y2="54"
        stroke="rgb(139 92 246 / 0.25)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
      {/* Stars / empty sparkles */}
      <circle cx="36" cy="68" r="2" fill="rgb(139 92 246 / 0.3)" />
      <circle cx="48" cy="68" r="2" fill="rgb(139 92 246 / 0.3)" />
      <circle cx="60" cy="68" r="2" fill="rgb(139 92 246 / 0.3)" />
    </svg>
  );
}

function NoProblemsIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Book cover */}
      <rect
        x="22"
        y="20"
        width="52"
        height="60"
        rx="4"
        fill="rgb(56 189 248 / 0.1)"
        stroke="rgb(56 189 248 / 0.35)"
        strokeWidth="2"
      />
      {/* Spine */}
      <rect
        x="22"
        y="20"
        width="10"
        height="60"
        rx="3"
        fill="rgb(56 189 248 / 0.18)"
        stroke="rgb(56 189 248 / 0.3)"
        strokeWidth="1.5"
      />
      {/* Blank page lines */}
      <line
        x1="40"
        y1="38"
        x2="66"
        y2="38"
        stroke="rgb(56 189 248 / 0.3)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="46"
        x2="66"
        y2="46"
        stroke="rgb(56 189 248 / 0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="40"
        y1="54"
        x2="58"
        y2="54"
        stroke="rgb(56 189 248 / 0.2)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Bookmark */}
      <path
        d="M60 20 L60 33 L66 29 L72 33 L72 20"
        fill="rgb(56 189 248 / 0.2)"
        stroke="rgb(56 189 248 / 0.4)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoContestsIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cup body */}
      <path
        d="M34 24 L62 24 L57 56 L39 56 Z"
        fill="rgb(251 191 36 / 0.12)"
        stroke="rgb(251 191 36 / 0.4)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Left handle */}
      <path
        d="M34 30 Q20 30 20 40 Q20 50 34 50"
        fill="none"
        stroke="rgb(251 191 36 / 0.35)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Right handle */}
      <path
        d="M62 30 Q76 30 76 40 Q76 50 62 50"
        fill="none"
        stroke="rgb(251 191 36 / 0.35)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Pedestal */}
      <rect
        x="40"
        y="56"
        width="16"
        height="6"
        rx="1"
        fill="rgb(251 191 36 / 0.18)"
        stroke="rgb(251 191 36 / 0.4)"
        strokeWidth="1.5"
      />
      {/* Base */}
      <rect
        x="35"
        y="62"
        width="26"
        height="5"
        rx="2"
        fill="rgb(251 191 36 / 0.18)"
        stroke="rgb(251 191 36 / 0.4)"
        strokeWidth="1.5"
      />
      {/* Ellipsis dots */}
      <circle cx="42" cy="40" r="2" fill="rgb(251 191 36 / 0.4)" />
      <circle cx="48" cy="40" r="2" fill="rgb(251 191 36 / 0.4)" />
      <circle cx="54" cy="40" r="2" fill="rgb(251 191 36 / 0.4)" />
    </svg>
  );
}

function NoUsersIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Person 1 head */}
      <circle
        cx="36"
        cy="34"
        r="10"
        fill="rgb(148 163 184 / 0.12)"
        stroke="rgb(148 163 184 / 0.35)"
        strokeWidth="2"
      />
      {/* Person 1 body */}
      <path
        d="M20 70 C20 58 52 58 52 70"
        fill="rgb(148 163 184 / 0.08)"
        stroke="rgb(148 163 184 / 0.3)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Person 2 head (partially hidden) */}
      <circle
        cx="62"
        cy="36"
        r="9"
        fill="rgb(148 163 184 / 0.08)"
        stroke="rgb(148 163 184 / 0.25)"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
      {/* Person 2 body (partially hidden) */}
      <path
        d="M48 70 C48 59 76 59 76 70"
        fill="none"
        stroke="rgb(148 163 184 / 0.2)"
        strokeWidth="2"
        strokeDasharray="4 2"
        strokeLinecap="round"
      />
      {/* Question mark over person 2 */}
      <path
        d="M62 28.5c0-1.66 1.34-3 3-3s3 1.34 3 3c0 1.5-1.2 2.1-2.4 3"
        stroke="rgb(148 163 184 / 0.55)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M65.6 34.5v1.5"
        stroke="rgb(148 163 184 / 0.55)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="65.6" cy="38" r="1" fill="rgb(148 163 184 / 0.55)" />
    </svg>
  );
}

function LoginRequiredIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Glow */}
      <ellipse
        cx="48"
        cy="66"
        rx="20"
        ry="6"
        fill="rgb(52 211 153 / 0.12)"
      />
      {/* Lock body */}
      <rect
        x="28"
        y="48"
        width="40"
        height="30"
        rx="6"
        fill="rgb(52 211 153 / 0.1)"
        stroke="rgb(52 211 153 / 0.45)"
        strokeWidth="2.5"
      />
      {/* Lock shackle */}
      <path
        d="M34 48 L34 36 Q34 24 48 24 Q62 24 62 36 L62 48"
        fill="none"
        stroke="rgb(52 211 153 / 0.45)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Keyhole circle */}
      <circle
        cx="48"
        cy="61"
        r="5"
        fill="rgb(52 211 153 / 0.2)"
        stroke="rgb(52 211 153 / 0.5)"
        strokeWidth="2"
      />
      {/* Keyhole stem */}
      <path
        d="M48 66 L48 72"
        stroke="rgb(52 211 153 / 0.5)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Light shine on lock body */}
      <path
        d="M36 54 Q42 52 46 56"
        stroke="rgb(52 211 153 / 0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Box */}
      <rect
        x="22"
        y="36"
        width="52"
        height="40"
        rx="5"
        fill="rgb(148 163 184 / 0.08)"
        stroke="rgb(148 163 184 / 0.3)"
        strokeWidth="2"
      />
      {/* Lid */}
      <rect
        x="18"
        y="28"
        width="60"
        height="12"
        rx="4"
        fill="rgb(148 163 184 / 0.1)"
        stroke="rgb(148 163 184 / 0.3)"
        strokeWidth="2"
      />
      {/* Ribbon horizontal */}
      <line
        x1="22"
        y1="56"
        x2="74"
        y2="56"
        stroke="rgb(148 163 184 / 0.2)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* Handle on lid */}
      <path
        d="M42 28 Q48 20 54 28"
        fill="none"
        stroke="rgb(148 163 184 / 0.35)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getIllustration(type: EmptyStateType) {
  switch (type) {
    case "no-results":
      return <NoResultsIllustration />;
    case "no-submissions":
      return <NoSubmissionsIllustration />;
    case "no-problems":
      return <NoProblemsIllustration />;
    case "no-contests":
      return <NoContestsIllustration />;
    case "no-users":
      return <NoUsersIllustration />;
    case "login-required":
      return <LoginRequiredIllustration />;
    case "generic":
    default:
      return <GenericIllustration />;
  }
}

/* ── EmptyState Component ──────────────────────────────────────── */

export function EmptyState({
  type,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 opacity-90">{getIllustration(type)}</div>

      <h2 className="text-base font-semibold text-[var(--navy)]">{title}</h2>

      {description && (
        <p className="mt-1 max-w-xs text-sm text-[var(--muted)]">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              {action.label}
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center rounded-md bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              {action.label}
            </button>
          )}
        </div>
      )}

      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="mt-3 text-sm text-[var(--teal)] hover:underline"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  );
}
