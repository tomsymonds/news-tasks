import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import {
  NewsTaskNote,
  parseCommaSeparatedList,
} from "./NewsTaskNote";

interface NewsTaskNoteModalOptions {
  onSubmit: (note: NewsTaskNote) => Promise<void>;
  initialValues?: Partial<ReturnType<NewsTaskNote["toProps"]>>;
  mode?: "create" | "edit";
}

export class NewsTaskNoteModal extends Modal {
  private readonly options: NewsTaskNoteModalOptions;

  private title = "";
  private story = "";
  private done = false;
  private goal = "";
  private startDate = "";
  private dueDate = "";
  private waitFor = "";
  private people = "";
  private organisations = "";
  private tags = "";
  private mode: "create" | "edit";
  private startDateInputEl: HTMLInputElement | null = null;
  private dueDateInputEl: HTMLInputElement | null = null;
  private storyInputEl: HTMLInputElement | null = null;
  private goalInputEl: HTMLInputElement | null = null;
  private waitForInputEl: HTMLInputElement | null = null;
  private peopleInputEl: HTMLInputElement | null = null;
  private organisationsInputEl: HTMLInputElement | null = null;
  private readonly dateFormat: string;

  constructor(app: App, options: NewsTaskNoteModalOptions) {
    super(app);
    this.options = options;
    this.dateFormat = getObsidianDateFormat(app);
    const initial = options.initialValues ?? {};
    this.title = initial.title ?? "";
    this.story = initial.story ?? "";
    this.done = initial.done ?? false;
    this.goal = initial.goal ?? "";
    this.startDate = initial.startDate ?? "";
    this.dueDate = initial.dueDate ?? "";
    this.waitFor = initial.waitFor ?? "";
    this.people = (initial.people ?? []).join(", ");
    this.organisations = (initial.organisations ?? []).join(", ");
    this.tags = (initial.tags ?? []).join(", ");
    this.mode = options.mode ?? "create";
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("news-task-modal");
    contentEl.createEl("h2", { text: this.mode === "create" ? "Create News Task" : "Edit News Task" });

    new Setting(contentEl)
      .setName("Title")
      .addText((text) => {
        text.setValue(this.title);
        text.onChange((value) => {
          this.title = value;
        });
      });

    new Setting(contentEl)
      .setName("Story")
      .addText((text) => {
        this.storyInputEl = text.inputEl;
        attachLinkClickToInput(this.app, text.inputEl, true);
        text.setValue(wikilinkToDisplay(this.story)).onChange((value) => {
          this.story = ensureWikilink(value);
        });
      })
      .addButton((button) => {
        button.setButtonText("Select").onClick(() => {
          this.selectStoryFromPicker();
        });
      });

    const doneSetting = new Setting(contentEl).setName("Done");
    const doneCheckbox = doneSetting.controlEl.createEl("input", {
      type: "checkbox",
      cls: "news-task-done-checkbox",
    });
    doneCheckbox.checked = this.done;
    doneCheckbox.addEventListener("change", () => {
      this.done = doneCheckbox.checked;
    });
    doneSetting.settingEl.addClass("news-task-status-row");

    new Setting(contentEl)
      .setName("Goal")
      .addText((text) => {
        this.goalInputEl = text.inputEl;
        text.setValue(this.goal);
        text.onChange((value) => {
          this.goal = value;
        });
      })
      .addButton((button) => {
        button.setButtonText("Select").onClick(() => {
          this.selectGoalFromPicker();
        });
      });

    const startDateSetting = new Setting(contentEl)
      .setName("Start Date")
      .addText((text) => {
        this.startDateInputEl = configureDateInput(
          text.inputEl,
          this.startDate,
          this.dateFormat,
          (newValue) => {
            this.startDate = newValue;
          },
        );
      })
      .addButton((button) => {
        button.setButtonText("Today").onClick(() => {
          this.startDate = offsetDateIso(0);
          if (this.startDateInputEl) {
            this.startDateInputEl.value = isoDateToDisplay(this.startDate, this.dateFormat);
          }
        });
      })
      .addButton((button) => {
        button.setButtonText("Tomorrow").onClick(() => {
          this.startDate = offsetDateIso(1);
          if (this.startDateInputEl) {
            this.startDateInputEl.value = isoDateToDisplay(this.startDate, this.dateFormat);
          }
        });
      });
    startDateSetting.settingEl.addClass("news-task-date-row");

    const dueDateSetting = new Setting(contentEl)
      .setName("Due Date")
      .addText((text) => {
        this.dueDateInputEl = configureDateInput(
          text.inputEl,
          this.dueDate,
          this.dateFormat,
          (newValue) => {
            this.dueDate = newValue;
          },
        );
      })
      .addButton((button) => {
        button.setButtonText("Today").onClick(() => {
          this.dueDate = offsetDateIso(0);
          if (this.dueDateInputEl) {
            this.dueDateInputEl.value = isoDateToDisplay(this.dueDate, this.dateFormat);
          }
        });
      })
      .addButton((button) => {
        button.setButtonText("Tomorrow").onClick(() => {
          this.dueDate = offsetDateIso(1);
          if (this.dueDateInputEl) {
            this.dueDateInputEl.value = isoDateToDisplay(this.dueDate, this.dateFormat);
          }
        });
      });
    dueDateSetting.settingEl.addClass("news-task-date-row");

    new Setting(contentEl)
      .setName("Wait For")
      .addText((text) => {
        this.waitForInputEl = text.inputEl;
        attachLinkClickToInput(this.app, text.inputEl, true);
        text.setValue(this.waitFor);
        text.onChange((value) => {
          this.waitFor = value;
        });
      })
      .addButton((button) => {
        button.setButtonText("Select").onClick(() => {
          this.selectWaitForFromPicker();
        });
      });

    new Setting(contentEl)
      .setName("People")
      .addText((text) => {
        this.peopleInputEl = text.inputEl;
        attachLinkClickToInput(this.app, text.inputEl, true);
        text.setValue(wikilinkListToDisplay(this.people)).onChange((value) => {
          this.people = displayListToWikilinkList(value);
        });
      })
      .addButton((button) => {
        button.setButtonText("Add").onClick(() => {
          this.selectPersonFromPicker();
        });
      });

    new Setting(contentEl)
      .setName("Organisations")
      .addText((text) => {
        this.organisationsInputEl = text.inputEl;
        attachLinkClickToInput(this.app, text.inputEl, true);
        text.setValue(wikilinkListToDisplay(this.organisations)).onChange((value) => {
          this.organisations = displayListToWikilinkList(value);
        });
      })
      .addButton((button) => {
        button.setButtonText("Add").onClick(() => {
          this.selectOrganisationFromPicker();
        });
      });

    new Setting(contentEl)
      .setName("Tags")
      .addText((text) => {
        text.setValue(this.tags).onChange((value) => {
          this.tags = value;
        });
      });

    new Setting(contentEl).addButton((button) => {
      button.setButtonText(this.mode === "create" ? "Create Task" : "Save Task").setCta().onClick(async () => {
        const note = new NewsTaskNote({
          title: this.title,
          story: this.story,
          done: this.done,
          goal: this.goal || undefined,
          startDate: this.startDate || undefined,
          dueDate: this.dueDate || undefined,
          waitFor: this.waitFor || undefined,
          people: parseCommaSeparatedList(this.people),
          organisations: parseCommaSeparatedList(this.organisations),
          tags: parseCommaSeparatedList(this.tags),
        });

        const errors = note.validate();
        if (errors.length > 0) {
          new Notice(errors.join(" "));
          return;
        }

        await this.options.onSubmit(note);
        this.close();
      });
    });

  }

  onClose(): void {
    this.startDateInputEl = null;
    this.dueDateInputEl = null;
    this.storyInputEl = null;
    this.goalInputEl = null;
    this.waitForInputEl = null;
    this.peopleInputEl = null;
    this.organisationsInputEl = null;
    this.contentEl.empty();
  }

  private selectStoryFromPicker(): void {
    const storyFiles = this.getMarkdownFilesInFolder("Stories")
      .filter((file) => hasFrontmatterType(this.app, file, "Story"));
    const storyTitles = storyFiles.map((file) => file.basename).sort((a, b) => a.localeCompare(b));

    if (storyTitles.length === 0) {
      new Notice("No Story notes found in Stories folder.");
      return;
    }

    openFuzzyPicker(this.app, storyTitles, "Select Story", (selected) => {
      this.story = `[[${selected}]]`;
      if (this.storyInputEl) {
        this.storyInputEl.value = wikilinkToDisplay(this.story);
      }
    });
  }

  private selectGoalFromPicker(): void {
    const story = normalizeStoryForMatch(this.story);
    if (!story) {
      new Notice("Select Story first to choose a Goal.");
      return;
    }

    const goals = this.getMarkdownFilesInFolder("News Tasks")
      .map((file) => this.app.metadataCache.getFileCache(file)?.frontmatter)
      .map((frontmatter) => {
        const taskStory = normalizeStoryForMatch(String(frontmatter?.["Story"] ?? frontmatter?.["story"] ?? ""));
        const goal = String(frontmatter?.["Goal"] ?? frontmatter?.["goal"] ?? "").trim();
        if (!taskStory || taskStory !== story || goal.length === 0) {
          return null;
        }

        return goal;
      })
      .filter((value): value is string => Boolean(value));

    const uniqueGoals = Array.from(new Set(goals)).sort((a, b) => a.localeCompare(b));
    if (uniqueGoals.length === 0) {
      new Notice("No Goals found for the selected Story.");
      return;
    }

    openFuzzyPicker(this.app, uniqueGoals, "Select Goal", (selected) => {
      this.goal = selected;
      if (this.goalInputEl) {
        this.goalInputEl.value = this.goal;
      }
    });
  }

  private selectPersonFromPicker(): void {
    const peopleFiles = this.getMarkdownFilesInFolder("People")
      .filter((file) => hasFrontmatterType(this.app, file, "Person"));
    const people = peopleFiles.map((file) => file.basename).sort((a, b) => a.localeCompare(b));

    if (people.length === 0) {
      new Notice("No Person notes found in People folder.");
      return;
    }

    openFuzzyPicker(this.app, people, "Add Person", (selected) => {
      this.people = appendUniqueListEntry(this.people, `[[${selected}]]`);
      if (this.peopleInputEl) {
        this.peopleInputEl.value = wikilinkListToDisplay(this.people);
      }
    });
  }

  private selectOrganisationFromPicker(): void {
    const organisationFiles = this.getMarkdownFilesInFolder("Organisations")
      .filter((file) => hasFrontmatterType(this.app, file, "organisation"));
    const organisations = organisationFiles.map((file) => file.basename).sort((a, b) => a.localeCompare(b));

    if (organisations.length === 0) {
      new Notice("No Organisation notes found in Organisations folder.");
      return;
    }

    openFuzzyPicker(this.app, organisations, "Add Organisation", (selected) => {
      this.organisations = appendUniqueListEntry(this.organisations, `[[${selected}]]`);
      if (this.organisationsInputEl) {
        this.organisationsInputEl.value = wikilinkListToDisplay(this.organisations);
      }
    });
  }

  private selectWaitForFromPicker(): void {
    const story = normalizeStoryForMatch(this.story);
    if (!story) {
      new Notice("Select Story first to choose Wait For.");
      return;
    }

    const titles = this.getMarkdownFilesInFolder("News Tasks")
      .filter((file) => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const taskStory = normalizeStoryForMatch(String(frontmatter?.["Story"] ?? frontmatter?.["story"] ?? ""));
        return taskStory === story;
      })
      .map((file) => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const title = String(frontmatter?.["Title"] ?? frontmatter?.["title"] ?? file.basename).trim();
        return title.length > 0 ? title : file.basename;
      })
      .filter((title) => title !== this.title)
      .sort((a, b) => a.localeCompare(b));

    if (titles.length === 0) {
      new Notice("No related News Task notes found for the selected Story.");
      return;
    }

    openFuzzyPicker(this.app, Array.from(new Set(titles)), "Select Wait For Task", (selected) => {
      this.waitFor = selected;
      if (this.waitForInputEl) {
        this.waitForInputEl.value = this.waitFor;
      }
    });
  }

  private getMarkdownFilesInFolder(folderPath: string): TFile[] {
    const prefix = `${folderPath}/`;
    return this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(prefix));
  }
}

function offsetDateIso(offsetDays: number): string {
  const m = getMoment();
  if (m) {
    return m().startOf("day").add(offsetDays, "day").format("YYYY-MM-DD");
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function configureDateInput(
  inputEl: HTMLInputElement,
  currentIsoDate: string,
  dateFormat: string,
  onValueChange: (newValue: string) => void,
): HTMLInputElement {
  inputEl.type = "text";
  inputEl.value = isoDateToDisplay(currentIsoDate, dateFormat);
  inputEl.onchange = () => {
    const raw = inputEl.value.trim();
    if (raw.length === 0) {
      onValueChange("");
      inputEl.value = "";
      return;
    }

    const isoValue = parseDateToIso(raw, dateFormat);
    const nextValue = isoValue ?? raw;
    onValueChange(nextValue);
    if (isoValue) {
      inputEl.value = isoDateToDisplay(isoValue, dateFormat);
    }
  };

  return inputEl;
}

function isoDateToDisplay(isoDate: string, dateFormat: string): string {
  if (!isoDate) {
    return "";
  }

  const m = getMoment();
  if (!m) {
    return isoDate;
  }

  const parsed = m(isoDate, "YYYY-MM-DD", true);
  if (!parsed.isValid()) {
    return isoDate;
  }

  return parsed.format(dateFormat);
}

function parseDateToIso(value: string, dateFormat: string): string | null {
  const m = getMoment();
  if (!m) {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return iso ? value : null;
  }

  const parsed = m(value, [dateFormat, "YYYY-MM-DD", "DD-MM-YYYY"], true);
  if (!parsed.isValid()) {
    return null;
  }

  return parsed.format("YYYY-MM-DD");
}

function getObsidianDateFormat(app: App): string {
  const configValue = (app.vault as { getConfig?: (key: string) => unknown }).getConfig?.("dateFormat");
  if (typeof configValue === "string" && configValue.trim().length > 0) {
    return configValue;
  }

  return "YYYY-MM-DD";
}

function getMoment(): ((value?: unknown, format?: unknown, strict?: unknown) => any) | null {
  const candidate = (globalThis as unknown as { moment?: unknown }).moment;
  if (typeof candidate === "function") {
    return candidate as (value?: unknown, format?: unknown, strict?: unknown) => any;
  }

  return null;
}

function hasFrontmatterType(app: App, file: TFile, expectedType: string): boolean {
  const typeRaw = app.metadataCache.getFileCache(file)?.frontmatter?.["type"];
  if (typeof typeRaw !== "string") {
    return false;
  }

  return typeRaw.trim().toLowerCase() === expectedType.trim().toLowerCase();
}

function extractWikilinkTargets(value: string): string[] {
  const matches = value.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  const targets: string[] = [];
  for (const match of matches) {
    const target = match[1]?.trim();
    if (target && target.length > 0) {
      targets.push(target);
    }
  }

  return targets;
}

function attachLinkClickToInput(app: App, inputEl: HTMLInputElement, allowPlainTitle = false): void {
  const openTargetFromInput = (event: MouseEvent): void => {
    const value = inputEl.value;
    const cursor = inputEl.selectionStart ?? 0;
    const target = findWikilinkAtCursor(value, cursor)
      ?? extractWikilinkTargets(value)[0]
      ?? (allowPlainTitle ? value.trim() : null);

    if (!target || target.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void app.workspace.openLinkText(target, "", true);
  };

  inputEl.addEventListener("dblclick", (event: MouseEvent) => {
    openTargetFromInput(event);
  });

  inputEl.addEventListener("click", (event: MouseEvent) => {
    if (!event.metaKey && !event.ctrlKey) {
      return;
    }

    openTargetFromInput(event);
  });
}

function findWikilinkAtCursor(value: string, cursor: number): string | null {
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match = regex.exec(value);

  while (match) {
    const fullMatch = match[0];
    const target = (match[1] ?? "").trim();
    const start = match.index;
    const end = start + fullMatch.length;
    if (cursor >= start && cursor <= end && target.length > 0) {
      return target;
    }
    match = regex.exec(value);
  }

  return null;
}

function ensureWikilink(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const match = trimmed.match(/^\[\[([^\]]+)\]\]$/);
  if (match) {
    const target = (match[1] ?? "").split("|")[0]?.trim();
    return target ? `[[${target}]]` : "";
  }

  return `[[${trimmed}]]`;
}

function wikilinkToDisplay(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }

  const match = trimmed.match(/^\[\[([^\]]+)\]\]$/);
  if (!match) {
    return trimmed;
  }

  return (match[1] ?? "").split("|")[0]?.trim() ?? trimmed;
}

function displayListToWikilinkList(value: string): string {
  return parseCommaSeparatedList(value)
    .map((item) => ensureWikilink(item))
    .filter((item) => item.length > 0)
    .join(", ");
}

function wikilinkListToDisplay(value: string): string {
  return parseCommaSeparatedList(value)
    .map((item) => wikilinkToDisplay(item))
    .filter((item) => item.length > 0)
    .join(", ");
}

function normalizeStoryForMatch(storyValue: string): string {
  const linkMatch = storyValue.match(/\[\[[^\]]+\]\]/);
  const normalized = (linkMatch?.[0] ?? storyValue).trim();
  return normalized.toLowerCase();
}

function appendUniqueListEntry(existingList: string, newEntry: string): string {
  const normalizedEntry = newEntry.trim();
  if (normalizedEntry.length === 0) {
    return existingList;
  }

  const items = parseCommaSeparatedList(existingList);
  const hasEntry = items.some((item) => item.toLowerCase() === normalizedEntry.toLowerCase());
  if (hasEntry) {
    return items.join(", ");
  }

  return [...items, normalizedEntry].join(", ");
}

function openFuzzyPicker(app: App, items: string[], title: string, onChoose: (value: string) => void): void {
  const picker = new StringPickerModal(app, items, title, onChoose);
  picker.open();
}

class StringPickerModal extends FuzzySuggestModal<string> {
  private readonly items: string[];
  private readonly onChoose: (value: string) => void;

  constructor(app: App, items: string[], title: string, onChoose: (value: string) => void) {
    super(app);
    this.items = items;
    this.onChoose = onChoose;
    this.setPlaceholder(title);
  }

  getItems(): string[] {
    return this.items;
  }

  getItemText(item: string): string {
    return item;
  }

  onChooseItem(item: string): void {
    this.onChoose(item);
  }
}
