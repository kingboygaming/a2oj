/* ── Formation logic for army units ── */

export type FormationType = "line" | "wedge" | "square" | "column";

export interface FormationSlot {
  x: number;
  z: number;
  row: number;
  col: number;
}

const UNIT_SPACING = 0.6;

export function calculateFormation(
  count: number,
  type: FormationType = "square"
): FormationSlot[] {
  if (count <= 0) return [];

  switch (type) {
    case "line":
      return lineFormation(count);
    case "wedge":
      return wedgeFormation(count);
    case "column":
      return columnFormation(count);
    case "square":
    default:
      return squareFormation(count);
  }
}

function squareFormation(count: number): FormationSlot[] {
  const cols = Math.ceil(Math.sqrt(count));
  const slots: FormationSlot[] = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = row < Math.floor(count / cols) ? cols : count % cols || cols;

    slots.push({
      x: (col - (rowCount - 1) / 2) * UNIT_SPACING,
      z: (row - Math.floor(count / cols) / 2) * UNIT_SPACING,
      row,
      col,
    });
  }

  return slots;
}

function lineFormation(count: number): FormationSlot[] {
  const slots: FormationSlot[] = [];
  for (let i = 0; i < count; i++) {
    slots.push({
      x: (i - (count - 1) / 2) * UNIT_SPACING,
      z: 0,
      row: 0,
      col: i,
    });
  }
  return slots;
}

function wedgeFormation(count: number): FormationSlot[] {
  const slots: FormationSlot[] = [];
  let placed = 0;
  let row = 0;

  while (placed < count) {
    const rowSize = row + 1;
    for (let col = 0; col < rowSize && placed < count; col++) {
      slots.push({
        x: (col - row / 2) * UNIT_SPACING,
        z: row * UNIT_SPACING,
        row,
        col,
      });
      placed++;
    }
    row++;
  }

  return slots;
}

function columnFormation(count: number): FormationSlot[] {
  const cols = 2;
  const slots: FormationSlot[] = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    slots.push({
      x: (col - (cols - 1) / 2) * UNIT_SPACING,
      z: row * UNIT_SPACING,
      row,
      col,
    });
  }

  return slots;
}

/* ── Choose formation based on troop type ── */
export function getFormationForTroop(
  troopType: "infantry" | "archers" | "cavalry" | "siege",
  count: number
): FormationSlot[] {
  switch (troopType) {
    case "infantry":
      return calculateFormation(count, "square");
    case "archers":
      return calculateFormation(count, "line");
    case "cavalry":
      return calculateFormation(count, "wedge");
    case "siege":
      return calculateFormation(count, "column");
  }
}
