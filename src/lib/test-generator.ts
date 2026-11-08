import { z } from "zod";

const variableNameSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,31}$/);
const integerSchema = z.number().int().safe().min(-1_000_000_000_000).max(1_000_000_000_000);
const dimensionSchema = z.union([
  z.number().int().min(0).max(10_000),
  variableNameSchema,
]);

const variableSchema = z.discriminatedUnion("type", [
  z.object({
    name: variableNameSchema,
    type: z.literal("int"),
    min: integerSchema,
    max: integerSchema,
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("intArray"),
    length: dimensionSchema,
    min: integerSchema,
    max: integerSchema,
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("intMatrix"),
    rows: dimensionSchema,
    columns: dimensionSchema,
    min: integerSchema,
    max: integerSchema,
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("undirectedGraphMatrix"),
    size: dimensionSchema,
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("graphEdgeList"),
    vertices: dimensionSchema,
    directed: z.boolean().default(false),
    weighted: z.boolean().default(false),
    minEdges: z.number().int().min(0).max(10_000).default(0),
    maxEdges: z.number().int().min(0).max(10_000).optional(),
    minWeight: integerSchema.default(1),
    maxWeight: integerSchema.default(1000),
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("graphAdjacencyList"),
    vertices: dimensionSchema,
    directed: z.boolean().default(false),
    includeDegree: z.boolean().default(false),
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("treeEdgeList"),
    vertices: dimensionSchema,
    weighted: z.boolean().default(false),
    minWeight: integerSchema.default(1),
    maxWeight: integerSchema.default(1000),
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("permutation"),
    size: dimensionSchema,
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("characterGrid"),
    rows: dimensionSchema,
    columns: dimensionSchema,
    alphabet: z.string().min(1).max(64).regex(/^\S+$/).default(".#"),
  }),
  z.object({
    name: variableNameSchema,
    type: z.literal("string"),
    minLength: z.number().int().min(0).max(10_000),
    maxLength: z.number().int().min(0).max(10_000),
    alphabet: z.string().min(1).max(64).regex(/^\S+$/).optional(),
  }),
]);

export const testGeneratorSchema = z.object({
  variables: z.array(variableSchema).min(1).max(40),
  template: z.string().min(1).max(8_192),
}).superRefine((specification, context) => {
  const seen = new Set<string>();
  const integerVariables = new Set<string>();
  for (const [index, variable] of specification.variables.entries()) {
    if (seen.has(variable.name)) {
      context.addIssue({ code: "custom", path: ["variables", index, "name"], message: `Tên biến "${variable.name}" bị trùng.` });
    }
    seen.add(variable.name);
    if ("min" in variable && variable.min > variable.max) {
      context.addIssue({ code: "custom", path: ["variables", index, "max"], message: "Giá trị max phải lớn hơn hoặc bằng min." });
    }
    if (variable.type === "string" && variable.minLength > variable.maxLength) {
      context.addIssue({ code: "custom", path: ["variables", index, "maxLength"], message: "Độ dài tối đa phải lớn hơn hoặc bằng tối thiểu." });
    }
    if (variable.type === "graphEdgeList" && variable.minEdges > (variable.maxEdges ?? 10_000)) {
      context.addIssue({ code: "custom", path: ["variables", index, "maxEdges"], message: "Số cạnh tối đa phải lớn hơn hoặc bằng số cạnh tối thiểu." });
    }
    if (
      (variable.type === "graphEdgeList" || variable.type === "treeEdgeList") &&
      variable.minWeight > variable.maxWeight
    ) {
      context.addIssue({ code: "custom", path: ["variables", index, "maxWeight"], message: "Trọng số tối đa phải lớn hơn hoặc bằng tối thiểu." });
    }
    const dimensions = variable.type === "intArray"
      ? [variable.length]
      : variable.type === "intMatrix"
        ? [variable.rows, variable.columns]
        : variable.type === "undirectedGraphMatrix"
          ? [variable.size]
          : variable.type === "graphEdgeList" || variable.type === "graphAdjacencyList" || variable.type === "treeEdgeList"
            ? [variable.vertices]
            : variable.type === "permutation"
              ? [variable.size]
              : variable.type === "characterGrid"
                ? [variable.rows, variable.columns]
        : [];
    for (const dimension of dimensions) {
      if (typeof dimension === "string" && !integerVariables.has(dimension)) {
        context.addIssue({
          code: "custom",
          path: ["variables", index],
          message: `Kích thước "${dimension}" phải tham chiếu biến int đã khai báo trước đó.`,
        });
      }
    }
    if (variable.type === "int") integerVariables.add(variable.name);
    if (
      variable.type === "undirectedGraphMatrix" &&
      typeof variable.size === "number" &&
      variable.size > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["variables", index, "size"],
        message: "Ma trận kề đồ thị không được vượt quá 100 đỉnh.",
      });
    }
    if (
      (variable.type === "graphEdgeList" ||
        variable.type === "graphAdjacencyList" ||
        variable.type === "treeEdgeList") &&
      typeof variable.vertices === "number" &&
      variable.vertices > 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["variables", index, "vertices"],
        message: "Đồ thị không được vượt quá 100 đỉnh.",
      });
    }
  }

  const placeholders = [...specification.template.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
  for (const name of placeholders) {
    if (!seen.has(name)) {
      context.addIssue({ code: "custom", path: ["template"], message: `Template dùng biến chưa khai báo: ${name}.` });
    }
  }
  if (/[{}]/.test(specification.template.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, ""))) {
    context.addIssue({ code: "custom", path: ["template"], message: "Placeholder phải có dạng {ten_bien}." });
  }
});

export type TestGeneratorSpec = z.infer<typeof testGeneratorSchema>;
export type TestGenerationMode = "random" | "edge" | "mixed";

function chooseInteger(min: number, max: number, edge: "min" | "max" | null): number {
  if (edge === "min") return min;
  if (edge === "max") return max;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function resolveDimension(
  dimension: number | string,
  values: Map<string, number | string | number[] | number[][] | string[]>,
): number {
  if (typeof dimension === "number") return dimension;
  const value = values.get(dimension);
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`Kích thước ${dimension} phải nằm trong khoảng 0 đến 10.000.`);
  }
  return value;
}

function edgeFor(mode: TestGenerationMode, testIndex: number): "min" | "max" | null {
  if (mode === "random") return null;
  if (mode === "edge") return testIndex % 2 === 0 ? "min" : "max";
  if (testIndex === 0) return "min";
  if (testIndex === 1) return "max";
  return null;
}

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export function generateTestInputs(
  specification: TestGeneratorSpec,
  count: number,
  mode: TestGenerationMode,
): string[] {
  return Array.from({ length: count }, (_, testIndex) => {
    const values = new Map<string, number | string | number[] | number[][] | string[]>();
    const edge = edgeFor(mode, testIndex);

    for (const variable of specification.variables) {
      if (variable.type === "int") {
        values.set(variable.name, chooseInteger(variable.min, variable.max, edge));
      } else if (variable.type === "intArray") {
        const length = resolveDimension(variable.length, values);
        const array = Array.from({ length }, (_, index) =>
          chooseInteger(variable.min, variable.max, edge && mode === "edge" && index % 2 ? edge === "min" ? "max" : "min" : edge),
        );
        values.set(variable.name, array);
      } else if (variable.type === "undirectedGraphMatrix") {
        const size = resolveDimension(variable.size, values);
        if (size > 100) {
          throw new Error("Ma trận kề đồ thị không được vượt quá 100 đỉnh.");
        }
        const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0));
        for (let row = 0; row < size; row += 1) {
          for (let column = row + 1; column < size; column += 1) {
            const connected = edge === "min"
              ? false
              : edge === "max"
                ? true
                : Math.random() < 0.5;
            const value = Number(connected);
            matrix[row][column] = value;
            matrix[column][row] = value;
          }
        }
        values.set(variable.name, matrix);
      } else if (variable.type === "graphEdgeList") {
        const vertices = resolveDimension(variable.vertices, values);
        if (vertices > 100) throw new Error("Đồ thị không được vượt quá 100 đỉnh.");
        const candidates: [number, number][] = [];
        for (let from = 1; from <= vertices; from += 1) {
          for (let to = variable.directed ? 1 : from + 1; to <= vertices; to += 1) {
            if (from !== to) candidates.push([from, to]);
          }
        }
        const maxEdges = Math.min(
          variable.maxEdges ?? 500,
          candidates.length,
        );
        if (variable.minEdges > maxEdges) {
          throw new Error(`Đồ thị ${variable.name} không thể có ${variable.minEdges} cạnh với ${vertices} đỉnh.`);
        }
        const edgeCount = chooseInteger(variable.minEdges, maxEdges, edge);
        const edges = shuffle(candidates).slice(0, edgeCount);
        const renderedEdges = edges.map(([from, to]) => {
          if (!variable.weighted) return `${from} ${to}`;
          return `${from} ${to} ${chooseInteger(variable.minWeight, variable.maxWeight, edge)}`;
        });
        values.set(variable.name, [String(edgeCount), ...renderedEdges].join("\n"));
      } else if (variable.type === "graphAdjacencyList") {
        const vertices = resolveDimension(variable.vertices, values);
        if (vertices > 100) throw new Error("Đồ thị không được vượt quá 100 đỉnh.");
        const adjacency = Array.from({ length: vertices }, () => new Set<number>());
        for (let from = 0; from < vertices; from += 1) {
          for (let to = variable.directed ? 0 : from + 1; to < vertices; to += 1) {
            if (from === to) continue;
            if (edge === "min" ? false : edge === "max" ? true : Math.random() < 0.5) {
              adjacency[from].add(to + 1);
              if (!variable.directed) adjacency[to].add(from + 1);
            }
          }
        }
        values.set(variable.name, adjacency.map((neighbors) => {
          const list = [...neighbors];
          return variable.includeDegree ? `${list.length} ${list.join(" ")}` : list.join(" ");
        }).join("\n"));
      } else if (variable.type === "treeEdgeList") {
        const vertices = resolveDimension(variable.vertices, values);
        if (vertices < 1 || vertices > 100) {
          throw new Error("Cây phải có từ 1 đến 100 đỉnh.");
        }
        const edges: string[] = [];
        for (let vertex = 2; vertex <= vertices; vertex += 1) {
          const parent = edge === "min"
            ? vertex - 1
            : edge === "max"
              ? 1
              : 1 + Math.floor(Math.random() * (vertex - 1));
          const weight = variable.weighted
            ? ` ${chooseInteger(variable.minWeight, variable.maxWeight, edge)}`
            : "";
          edges.push(`${vertex} ${parent}${weight}`);
        }
        values.set(variable.name, shuffle(edges).join("\n"));
      } else if (variable.type === "permutation") {
        const size = resolveDimension(variable.size, values);
        if (size > 10_000) throw new Error("Hoán vị không được vượt quá 10.000 phần tử.");
        const permutation = Array.from({ length: size }, (_, index) => index + 1);
        if (edge === "min") {
          values.set(variable.name, permutation);
        } else if (edge === "max") {
          values.set(variable.name, permutation.reverse());
        } else {
          values.set(variable.name, shuffle(permutation));
        }
      } else if (variable.type === "characterGrid") {
        const rows = resolveDimension(variable.rows, values);
        const columns = resolveDimension(variable.columns, values);
        if (rows * columns > 10_000) throw new Error("Lưới không được vượt quá 10.000 ô.");
        const alphabet = [...variable.alphabet];
        const grid = Array.from({ length: rows }, () =>
          Array.from({ length: columns }, () => {
            if (edge === "min") return alphabet[0];
            if (edge === "max") return alphabet[alphabet.length - 1];
            return alphabet[Math.floor(Math.random() * alphabet.length)];
          }).join(""),
        );
        values.set(variable.name, grid);
      } else if (variable.type === "intMatrix") {
        const rows = resolveDimension(variable.rows, values);
        const columns = resolveDimension(variable.columns, values);
        if (rows * columns > 10_000) throw new Error("Ma trận không được vượt quá 10.000 phần tử.");
        const matrix = Array.from({ length: rows }, (_, row) =>
          Array.from({ length: columns }, (_, column) =>
            chooseInteger(
              variable.min,
              variable.max,
              edge && mode === "edge" && (row + column) % 2
                ? edge === "min" ? "max" : "min"
                : edge,
            ),
          ),
        );
        values.set(variable.name, matrix);
      } else {
        const length = chooseInteger(variable.minLength, variable.maxLength, edge);
        const alphabet = [...(variable.alphabet ?? "abcdefghijklmnopqrstuvwxyz")];
        const text = Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
        values.set(variable.name, text);
      }
    }

    const renderedValues = new Map<string, string>();
    const inputParts: string[] = [];
    let inputBytes = 0;
    let cursor = 0;
    const append = (part: string) => {
      inputBytes += new TextEncoder().encode(part).byteLength;
      if (inputBytes > 24_000) {
        throw new Error(`Test ${testIndex + 1} vượt quá giới hạn 24 KB.`);
      }
      inputParts.push(part);
    };

    for (const match of specification.template.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
      const start = match.index ?? cursor;
      append(specification.template.slice(cursor, start));
      const name = match[1];
      let rendered = renderedValues.get(name);
      if (rendered === undefined) {
        const value = values.get(name);
        if (value === undefined) throw new Error(`Không tạo được giá trị cho biến ${name}.`);
        rendered = Array.isArray(value)
          ? value.map((item) => Array.isArray(item) ? item.join(" ") : String(item)).join("\n")
          : String(value);
        renderedValues.set(name, rendered);
      }
      append(rendered);
      cursor = start + match[0].length;
    }
    append(specification.template.slice(cursor));
    const renderedInput = inputParts.join("");
    const input = renderedInput.endsWith("\n") ? renderedInput : `${renderedInput}\n`;
    if (new TextEncoder().encode(input).byteLength > 24_000) {
      throw new Error(`Test ${testIndex + 1} vượt quá giới hạn 24 KB.`);
    }
    return input;
  });
}
