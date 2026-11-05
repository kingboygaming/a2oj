export type ChessTimeControl = {
  id: string;
  label: string;
  name: string;
  group: "siêu chớp" | "chớp" | "cờ chớp";
  initialSeconds: number;
  incrementSeconds: number;
};

export const CHESS_TIME_CONTROLS: ChessTimeControl[] = [
  {
    id: "super-1",
    label: "1 phút",
    name: "Siêu Chớp",
    group: "siêu chớp",
    initialSeconds: 60,
    incrementSeconds: 0,
  },
  {
    id: "super-1-1",
    label: "1 + 1",
    name: "Siêu Chớp",
    group: "siêu chớp",
    initialSeconds: 60,
    incrementSeconds: 1,
  },
  {
    id: "super-2-1",
    label: "2 + 1",
    name: "Siêu Chớp",
    group: "siêu chớp",
    initialSeconds: 2 * 60,
    incrementSeconds: 1,
  },
  {
    id: "blitz-3",
    label: "3 phút",
    name: "Chớp",
    group: "chớp",
    initialSeconds: 3 * 60,
    incrementSeconds: 0,
  },
  {
    id: "blitz-3-2",
    label: "3 + 2",
    name: "Chớp",
    group: "chớp",
    initialSeconds: 3 * 60,
    incrementSeconds: 2,
  },
  {
    id: "blitz-5",
    label: "5 phút",
    name: "Chớp",
    group: "chớp",
    initialSeconds: 5 * 60,
    incrementSeconds: 0,
  },
  {
    id: "rapid-10",
    label: "10 phút",
    name: "Cờ Chớp",
    group: "cờ chớp",
    initialSeconds: 10 * 60,
    incrementSeconds: 0,
  },
  {
    id: "rapid-10-5",
    label: "10 + 5",
    name: "Cờ Chớp",
    group: "cờ chớp",
    initialSeconds: 10 * 60,
    incrementSeconds: 5,
  },
  {
    id: "rapid-15-10",
    label: "15 + 10",
    name: "Cờ Chớp",
    group: "cờ chớp",
    initialSeconds: 15 * 60,
    incrementSeconds: 10,
  },
];

const CUSTOM_TIME_CONTROL_PATTERN = /^custom-(\d{1,3})-(\d{1,2})$/;

export function getChessTimeControl(id: string): ChessTimeControl | null {
  const preset = CHESS_TIME_CONTROLS.find((control) => control.id === id);
  if (preset) return preset;

  const customMatch = CUSTOM_TIME_CONTROL_PATTERN.exec(id);
  if (!customMatch) return null;

  const minutes = Number(customMatch[1]);
  const incrementSeconds = Number(customMatch[2]);
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 180 ||
    !Number.isInteger(incrementSeconds) ||
    incrementSeconds < 0 ||
    incrementSeconds > 60
  ) {
    return null;
  }

  return {
    id,
    label: `${minutes} + ${incrementSeconds}`,
    name: "Tùy chỉnh",
    group: "cờ chớp",
    initialSeconds: minutes * 60,
    incrementSeconds,
  };
}
