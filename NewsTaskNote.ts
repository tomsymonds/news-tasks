export type NewsTaskDone = boolean;

export interface NewsTaskNoteProps {
  title: string;
  story: string;
  done: NewsTaskDone;
  goal?: string;
  startDate?: string;
  dueDate?: string;
  waitFor?: string;
  people?: string[];
  organisations?: string[];
  tags?: string[];
}

export const NEWS_TASKS_FOLDER = "News Tasks";

export class NewsTaskNote {
  private readonly props: NewsTaskNoteProps;

  constructor(props: NewsTaskNoteProps) {
    this.props = {
      ...props,
      people: props.people ?? [],
      organisations: props.organisations ?? [],
      tags: props.tags ?? [],
    };
  }

  public validate(): string[] {
    const errors: string[] = [];

    if (!this.props.title || this.props.title.trim().length === 0) {
      errors.push("Title is required.");
    }

    if (!this.props.story || this.props.story.trim().length === 0) {
      errors.push("Story is required.");
    } else if (!containsObsidianLink(this.props.story)) {
      errors.push("Story must contain at least one Obsidian link like [[Story Title]].");
    }

    if (typeof this.props.done !== "boolean") {
      errors.push("Done must be a checkbox value (true/false).");
    }

    if (this.props.startDate && !isSupportedTaskDate(this.props.startDate)) {
      errors.push("Start Date must be in YYYY-MM-DD format.");
    }

    if (this.props.dueDate && !isSupportedTaskDate(this.props.dueDate)) {
      errors.push("Due Date must be in YYYY-MM-DD format.");
    }

    return errors;
  }

  public toProps(): NewsTaskNoteProps {
    return {
      title: this.props.title,
      story: this.props.story,
      done: this.props.done,
      goal: this.props.goal,
      startDate: this.props.startDate,
      dueDate: this.props.dueDate,
      waitFor: this.props.waitFor,
      people: [...(this.props.people ?? [])],
      organisations: [...(this.props.organisations ?? [])],
      tags: [...(this.props.tags ?? [])],
    };
  }

  public fileName(): string {
    return sanitizeFileName(this.props.title || "Untitled Task");
  }

  public folderPath(): string {
    return NEWS_TASKS_FOLDER;
  }

  public filePath(): string {
    return `${this.folderPath()}/${this.fileName()}.md`;
  }

  public toMarkdown(): string {
    const frontmatter: string[] = [
      `Title: ${yamlScalar(this.props.title)}`,
      `Story: ${yamlScalar(this.props.story)}`,
      `Done: ${yamlValue(this.props.done)}`,
      `Goal: ${yamlScalar(this.props.goal ?? "")}`,
      `Start Date: ${yamlScalar(this.props.startDate ?? "")}`,
      `Due Date: ${yamlScalar(this.props.dueDate ?? "")}`,
      `Wait For: ${yamlScalar(this.props.waitFor ?? "")}`,
      `People: ${yamlArray(this.props.people ?? [])}`,
      `Organisations: ${yamlArray(this.props.organisations ?? [])}`,
      `Tags: ${yamlArray(this.props.tags ?? [])}`,
      "type: News Task",
    ];

    return `---\n${frontmatter.join("\n")}\n---\n`;
  }
}

export function newsTaskFromFrontmatter(frontmatter: Record<string, unknown> | null | undefined, fallbackTitle: string): NewsTaskNote {
  const fm = frontmatter ?? {};
  const done = normalizeDone(fm["Done"] ?? fm["done"] ?? fm["Status"] ?? fm["status"] ?? "false");

  return new NewsTaskNote({
    title: String(fm["Title"] ?? fm["title"] ?? fallbackTitle),
    story: String(fm["Story"] ?? fm["story"] ?? ""),
    done,
    goal: normalizeOptionalString(fm["Goal"] ?? fm["goal"]),
    startDate: normalizeOptionalString(fm["Start Date"] ?? fm["start date"] ?? fm["startDate"]),
    dueDate: normalizeOptionalString(fm["Due Date"] ?? fm["due date"] ?? fm["dueDate"]),
    waitFor: normalizeOptionalString(fm["Wait For"] ?? fm["wait for"] ?? fm["waitFor"]),
    people: normalizeStringList(fm["People"] ?? fm["people"]),
    organisations: normalizeStringList(fm["Organisations"] ?? fm["organisations"]),
    tags: normalizeStringList(fm["Tags"] ?? fm["tags"]),
  });
}

export function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function containsObsidianLink(value: string): boolean {
  return /\[\[[^\]]+\]\]/.test(value);
}

export function isDdMmYyyyDate(value: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(value);
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isSupportedTaskDate(value: string): boolean {
  return isIsoDate(value) || isDdMmYyyyDate(value);
}

function sanitizeFileName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function yamlScalar(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function yamlValue(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return yamlScalar(String(value ?? ""));
}

function yamlArray(values: string[]): string {
  if (values.length === 0) {
    return "[]";
  }

  return `[${values.map((value) => yamlScalar(value)).join(", ")}]`;
}

function normalizeDone(value: unknown): NewsTaskDone {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "done") {
    return true;
  }

  if (normalized === "false" || normalized === "todo" || normalized === "waiting") {
    return false;
  }

  return false;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return parseCommaSeparatedList(value);
  }

  return [];
}