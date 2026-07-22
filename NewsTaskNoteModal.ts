import { App, FuzzySuggestModal, Modal, Notice, Setting, TFile } from "obsidian";
import { NewsTaskNote, NewsTaskNoteProps, containsObsidianLink, parseCommaSeparatedList } from "./NewsTaskNote";

interface NewsTaskNoteModalOptions {
	onSubmit: (note: NewsTaskNote) => Promise<void>;
	initialValues?: Partial<NewsTaskNoteProps>;
	mode?: "create" | "edit";
}

class StringSuggestModal extends FuzzySuggestModal<string> {
	private readonly items: string[];
	private readonly onChooseValue: (value: string) => void;

	constructor(app: App, items: string[], onChooseValue: (value: string) => void) {
		super(app);
		this.items = items;
		this.onChooseValue = onChooseValue;
	}

	getItems(): string[] {
		return this.items;
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.onChooseValue(item);
	}
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
	private people: string[] = [];
	private organisations: string[] = [];
	private tags = "";

	constructor(app: App, options: NewsTaskNoteModalOptions) {
		super(app);
		this.options = options;
		const initial = options.initialValues;
		this.title = initial?.title ?? "";
		this.story = linkDisplayValue(initial?.story ?? "");
		this.done = initial?.done ?? false;
		this.goal = initial?.goal ?? "";
		this.startDate = initial?.startDate ?? "";
		this.dueDate = initial?.dueDate ?? "";
		this.waitFor = initial?.waitFor ?? "";
		this.people = linkListToTitles(initial?.people ?? []);
		this.organisations = linkListToTitles(initial?.organisations ?? []);
		this.tags = (initial?.tags ?? []).join(", ");
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("news-task-modal");
		contentEl.addClass("news-task-modal__content");
		contentEl.empty();
		contentEl.createEl("h2", {
			text: this.options.mode === "edit" ? "Edit News Task" : "Create News Task",
		});

		new Setting(contentEl)
			.setName("Title")
			.addText((text) => {
				text.setValue(this.title).onChange((value) => {
					this.title = value;
				});
				text.inputEl.style.width = "100%";
			});

		const storySetting = new Setting(contentEl)
			.setName("Story")
			.addButton((button) => {
				button.setButtonText("Pick").onClick(() => {
					this.openStoryPicker();
				});
			});
		this.renderSelectedLinks(storySetting, this.story ? [this.story] : [], (value) => {
			if (this.story === value) {
				this.story = "";
				this.rerender();
			}
		});

		new Setting(contentEl)
			.setName("Done")
			.addToggle((toggle) => {
				toggle.setValue(this.done).onChange((value) => {
					this.done = value;
				});
			});

		new Setting(contentEl)
			.setName("Goal")
			.addText((text) => {
				text.setValue(this.goal).onChange((value) => {
					this.goal = value;
				});
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key !== "Enter") {
						return;
					}

					event.preventDefault();
					event.stopPropagation();
					this.goal = text.inputEl.value.trim();
				});
				text.inputEl.style.width = "100%";
			})
			.addButton((button) => {
				button.setButtonText("Pick").onClick(() => {
					this.openGoalPicker();
				});
			});

		new Setting(contentEl)
			.setName("Tags")
			.addText((text) => {
				text.setValue(this.tags).onChange((value) => {
					this.tags = value;
				});
				text.inputEl.style.width = "100%";
			})
			.addButton((button) => {
				button.setButtonText("Wait").onClick(() => {
					this.tags = toggleWaitTag(this.tags);
					this.rerender();
				});
			});

		let dateFormat = "DD-MM-YYYY";
		try {
			dateFormat = this.getObsidianDateFormat();
		} catch {
			dateFormat = "DD-MM-YYYY";
		}

		try {
			new Setting(contentEl)
				.setName("Start Date")
				.addText((text) => {
					const initialIso = dateToIso(this.startDate, dateFormat);
					text.inputEl.type = "date";
					text.inputEl.value = initialIso ?? "";
					text.onChange((value) => {
						this.startDate = value;
					});
					text.inputEl.style.width = "100%";
				})
				.addButton((button) => {
					button.setButtonText("Today").onClick(() => {
						this.startDate = formatTodayOffset(0);
						this.rerender();
					});
				})
				.addButton((button) => {
					button.setButtonText("Tomorrow").onClick(() => {
						this.startDate = formatTodayOffset(1);
						this.rerender();
					});
				});

			new Setting(contentEl)
				.setName("Due Date")
				.addText((text) => {
					const initialIso = dateToIso(this.dueDate, dateFormat);
					text.inputEl.type = "date";
					text.inputEl.value = initialIso ?? "";
					text.onChange((value) => {
						this.dueDate = value;
					});
					text.inputEl.style.width = "100%";
				})
				.addButton((button) => {
					button.setButtonText("Today").onClick(() => {
						this.dueDate = formatTodayOffset(0);
						this.rerender();
					});
				})
				.addButton((button) => {
					button.setButtonText("Tomorrow").onClick(() => {
						this.dueDate = formatTodayOffset(1);
						this.rerender();
					});
				});
		} catch {
			new Setting(contentEl)
				.setName("Start Date")
				.addText((text) => {
					text.setPlaceholder("DD-MM-YYYY").setValue(this.startDate).onChange((value) => {
						this.startDate = value;
					});
					text.inputEl.style.width = "100%";
				});

			new Setting(contentEl)
				.setName("Due Date")
				.addText((text) => {
					text.setPlaceholder("DD-MM-YYYY").setValue(this.dueDate).onChange((value) => {
						this.dueDate = value;
					});
					text.inputEl.style.width = "100%";
				});
		}

		new Setting(contentEl)
			.setName("Wait For")
			.addText((text) => {
				text.setValue(this.waitFor).onChange((value) => {
					this.waitFor = value;
				});
				text.inputEl.style.width = "100%";
			})
			.addButton((button) => {
				button.setButtonText("Pick").onClick(() => {
					this.openWaitForPicker();
				});
			});

		const peopleSetting = new Setting(contentEl)
			.setName("People")
			.addButton((button) => {
				button.setButtonText("Pick").onClick(() => {
					this.openPeoplePicker();
				});
			});
		this.renderSelectedLinks(peopleSetting, this.people, (value) => {
			this.people = this.people.filter((item) => item !== value);
			this.rerender();
		});

		const organisationsSetting = new Setting(contentEl)
			.setName("Organisations")
			.addButton((button) => {
				button.setButtonText("Pick").onClick(() => {
					this.openOrganisationPicker();
				});
			});
		this.renderSelectedLinks(organisationsSetting, this.organisations, (value) => {
			this.organisations = this.organisations.filter((item) => item !== value);
			this.rerender();
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText(this.options.mode === "edit" ? "Update Task" : "Create Task").setCta().onClick(async () => {
					await this.submit();
				});
			})
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			});
	}

	onClose(): void {
		this.modalEl.removeClass("news-task-modal");
		this.contentEl.removeClass("news-task-modal__content");
		this.contentEl.empty();
	}

	private rerender(): void {
		this.onOpen();
	}

	private async submit(): Promise<void> {
		try {
			const dateFormat = this.getObsidianDateFormat();
			const note = new NewsTaskNote({
				title: this.title.trim(),
				story: toWikiLink(this.story.trim()),
				done: this.done,
				goal: normalizeOptionalLink(this.goal),
				startDate: normalizeDateForModel(this.startDate, dateFormat),
				dueDate: normalizeDateForModel(this.dueDate, dateFormat),
				waitFor: normalizeOptional(this.waitFor),
				people: this.people.map((value) => toWikiLink(value)),
				organisations: this.organisations.map((value) => toWikiLink(value)),
				tags: parseCommaSeparatedList(this.tags),
			});

			const errors = note.validate();
			if (errors.length > 0) {
				new Notice(errors.join("\n"));
				return;
			}

			await this.options.onSubmit(note);
			this.close();
		} catch (error) {
			new Notice(`Failed to save task: ${String(error)}`);
		}
	}

	private openStoryPicker(): void {
		const choices = this.getFilesByType("Stories/", "story")
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
			.map((file) => file.basename);
		this.openPicker(choices, (value) => {
			this.story = value;
			this.rerender();
		});
	}

	private openPeoplePicker(): void {
		const choices = this.getFilesByType("People/", "person")
			.sort((a, b) => a.basename.localeCompare(b.basename))
			.map((file) => file.basename);
		this.openPicker(choices, (value) => {
			this.people = appendUnique(this.people, value);
			this.rerender();
		});
	}

	private openOrganisationPicker(): void {
		const choices = this.getFilesByType("Organisations/", "organisation")
			.sort((a, b) => a.basename.localeCompare(b.basename))
			.map((file) => file.basename);
		this.openPicker(choices, (value) => {
			this.organisations = appendUnique(this.organisations, value);
			this.rerender();
		});
	}

	private openGoalPicker(): void {
		const goals = uniqueSorted(this.getNewsTaskFrontmattersForCurrentStory()
			.map((fm) => String(fm["Goal"] ?? fm["goal"] ?? "").trim())
			.filter((value) => value.length > 0)
			.map((value) => linkDisplayValue(value)));
		this.openPicker(goals, (value) => {
			this.goal = linkDisplayValue(value);
			this.rerender();
		});
	}

	private openWaitForPicker(): void {
		const waitFors = this.getNewsTaskFrontmattersForCurrentStory()
			.map((fm) => String(fm["Title"] ?? fm["title"] ?? "").trim())
			.filter((value) => value.length > 0 && value !== this.title.trim());
		this.openPicker(uniqueSorted(waitFors), (value) => {
			this.waitFor = value;
			this.rerender();
		});
	}

	private openPicker(items: string[], onChoose: (value: string) => void): void {
		if (items.length === 0) {
			new Notice("No matching items found.");
			return;
		}

		new StringSuggestModal(this.app, items, onChoose).open();
	}

	private getFilesByType(pathPrefix: string, type: string): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(pathPrefix))
			.filter((file) => {
				const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.["type"];
				return typeof value === "string" && value.toLowerCase() === type.toLowerCase();
			});
	}

	private getNewsTaskFrontmattersForCurrentStory(): Array<Record<string, unknown>> {
		const storyTarget = normalizeLinkTarget(this.story);
		if (!storyTarget) {
			new Notice("Choose a Story first.");
			return [];
		}

		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith("News Tasks/"))
			.map((file) => this.app.metadataCache.getFileCache(file)?.frontmatter)
			.filter((frontmatter): frontmatter is Record<string, unknown> => Boolean(frontmatter))
			.filter((frontmatter) => {
				const story = String(frontmatter["Story"] ?? frontmatter["story"] ?? "");
				return normalizeLinkTarget(story) === storyTarget;
			});
	}

	private getObsidianDateFormat(): string {
		const fallback = "DD-MM-YYYY";

		try {
			const appAny = this.app as unknown as {
				vault?: {
					getConfig?: (key: string) => unknown;
					config?: Record<string, unknown>;
				};
			};

			const fromGetter = appAny.vault?.getConfig?.("dateFormat");
			if (typeof fromGetter === "string" && fromGetter.trim().length > 0) {
				return fromGetter;
			}

			const fromConfig = appAny.vault?.config?.["dateFormat"];
			if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
				return fromConfig;
			}
		} catch {
			return fallback;
		}

		return fallback;
	}

	private renderSelectedLinks(setting: Setting, values: string[], onRemove: (value: string) => void): void {
		if (values.length === 0) {
			return;
		}

		const wrapper = createDiv({ cls: "news-task-selected-list" });
		const firstButton = setting.controlEl.querySelector("button");
		if (firstButton) {
			setting.controlEl.insertBefore(wrapper, firstButton);
		} else {
			setting.controlEl.appendChild(wrapper);
		}

		values.forEach((value) => {
			const item = wrapper.createDiv({ cls: "news-task-selected-item" });
			const chip = item.createDiv({ cls: "news-task-selected-chip" });
			const link = chip.createEl("a", {
				cls: "news-task-selected-link",
				text: value,
				href: "#",
			});
			link.addEventListener("click", (event) => {
				event.preventDefault();
				this.app.workspace.openLinkText(value, "", true);
			});

			const remove = item.createEl("button", {
				cls: "news-task-selected-remove",
				text: "x",
			});
			remove.type = "button";
			remove.addEventListener("click", () => {
				onRemove(value);
			});
		});
	}

}

function normalizeOptional(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueSorted(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function appendUnique(existing: string[], next: string): string[] {
	if (existing.includes(next)) {
		return existing;
	}

	return [...existing, next];
}

function linkDisplayValue(value: string): string {
	const target = normalizeLinkTarget(value);
	return target ?? value;
}

function toWikiLink(value: string): string {
	if (!value) {
		return value;
	}

	if (containsObsidianLink(value)) {
		return value;
	}

	return `[[${value}]]`;
}

function normalizeLinkTarget(value: string): string | null {
	const match = value.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
	if (match?.[1]) {
		return match[1].trim();
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function linkListToTitles(values: string[]): string[] {
	return values.map((value) => linkDisplayValue(value)).filter((value) => value.trim().length > 0);
}

function normalizeOptionalLink(value: string): string | undefined {
	const normalized = normalizeOptional(value);
	if (!normalized) {
		return undefined;
	}

	return toWikiLink(normalized);
}

function formatTodayOffset(offsetDays: number): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	return formatAsIsoDate(date);
}

function toggleWaitTag(value: string): string {
	const parts = parseCommaSeparatedList(value);
	const hasWait = parts.some((part) => normalizeTag(part) === "wait");

	if (hasWait) {
		return parts
			.filter((part) => normalizeTag(part) !== "wait")
			.join(", ");
	}

	return [...parts, "#Wait"].join(", ");
}

function normalizeTag(value: string): string {
	const trimmed = value.trim();
	if (trimmed.startsWith("#")) {
		return trimmed.slice(1).toLowerCase();
	}

	return trimmed.toLowerCase();
}

function normalizeDateForModel(value: string, dateFormat: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	const native = parseNativeDate(trimmed);
	if (native) {
		return formatAsDdMmYyyy(native);
	}

	const parsed = parseWithGlobalMoment(trimmed, [dateFormat, "DD-MM-YYYY", "YYYY-MM-DD", getIso8601Token()], true);
	if (parsed.isValid()) {
		return parsed.format("DD-MM-YYYY");
	}

	return trimmed;
}

function toDisplayDate(value: string, dateFormat: string): string {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return "";
	}

	const parsed = parseWithGlobalMoment(trimmed, ["DD-MM-YYYY", "YYYY-MM-DD", dateFormat, getIso8601Token()], true);
	if (!parsed.isValid()) {
		return trimmed;
	}

	return parsed.format(dateFormat);
}

function isoToDisplayDate(isoDate: string, dateFormat: string): string {
	const parsed = parseWithGlobalMoment(isoDate, "YYYY-MM-DD", true);
	if (!parsed.isValid()) {
		return isoDate;
	}

	return parsed.format(dateFormat);
}

function dateToIso(value: string, dateFormat: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	const native = parseNativeDate(trimmed);
	if (native) {
		return formatAsIsoDate(native);
	}

	const parsed = parseWithGlobalMoment(trimmed, [dateFormat, "DD-MM-YYYY", "YYYY-MM-DD", getIso8601Token()], true);
	if (!parsed.isValid()) {
		return undefined;
	}

	return parsed.format("YYYY-MM-DD");
}

function parseWithGlobalMoment(input: string, formats: unknown, strict: boolean): {
	isValid: () => boolean;
	format: (fmt: string) => string;
} {
	const momentFn = getGlobalMomentFn();
	if (typeof momentFn === "function") {
		try {
			const parsed: unknown = momentFn(input, formats, strict);
			const candidate = parsed as { isValid?: () => boolean; format?: (fmt: string) => string };
			if (candidate && typeof candidate.isValid === "function" && typeof candidate.format === "function") {
				return {
					isValid: candidate.isValid,
					format: candidate.format,
				};
			}
		} catch {
			// Fall through to non-moment fallback when runtime moment is not callable.
		}
	}

	return {
		isValid: () => false,
		format: () => input,
	};
}

function getGlobalMomentNow(): { add: (amount: number, unit: string) => { format: (fmt: string) => string } } | null {
	const momentFn = getGlobalMomentFn();
	if (typeof momentFn === "function") {
		try {
			const now: unknown = momentFn();
			const candidate = now as { add?: (amount: number, unit: string) => { format: (fmt: string) => string } };
			if (candidate && typeof candidate.add === "function") {
				return {
					add: candidate.add,
				};
			}
		} catch {
			// Fall through to native Date fallback when runtime moment is not callable.
		}
	}

	return null;
}

function getGlobalMomentFn(): ((...args: unknown[]) => unknown) | undefined {
	const globalObj = globalThis as { moment?: (...args: unknown[]) => unknown };
	return globalObj.moment;
}

function getIso8601Token(): string {
	const momentFn = getGlobalMomentFn() as { ISO_8601?: string } | undefined;
	return momentFn?.ISO_8601 ?? "YYYY-MM-DDTHH:mm:ssZ";
}

function parseNativeDate(value: string): Date | null {
	const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		const year = Number(isoMatch[1]);
		const month = Number(isoMatch[2]) - 1;
		const day = Number(isoMatch[3]);
		const date = new Date(year, month, day);
		if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
			return date;
		}
	}

	const ddmmyyyy = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (ddmmyyyy) {
		const day = Number(ddmmyyyy[1]);
		const month = Number(ddmmyyyy[2]) - 1;
		const year = Number(ddmmyyyy[3]);
		const date = new Date(year, month, day);
		if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
			return date;
		}
	}

	return null;
}

function formatAsIsoDate(date: Date): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatAsDdMmYyyy(date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = String(date.getFullYear());
	return `${day}-${month}-${year}`;
}
