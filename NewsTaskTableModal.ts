import { App, Modal, Notice, Setting, TFile } from "obsidian";

type TaskStatus = "ToDo" | "Waiting" | "Done";

interface TaskRow {
  file: TFile;
  title: string;
  status: TaskStatus;
}

export class NewsTaskTableModal extends Modal {
  private rows: TaskRow[] = [];

  constructor(app: App) {
    super(app);
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "News Task Table" });

    await this.loadRows();
    this.renderRows();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async loadRows(): Promise<void> {
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.startsWith("News Tasks/"));

    const rows: TaskRow[] = [];
    files.forEach((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const status = this.normalizeStatus(frontmatter?.["Status"] ?? frontmatter?.["status"]);
      const titleRaw = frontmatter?.["Title"] ?? frontmatter?.["title"];
      const title = typeof titleRaw === "string" && titleRaw.trim().length > 0
        ? titleRaw.trim()
        : file.basename;
      rows.push({ file, title, status });
    });

    this.rows = rows.sort((a, b) => a.title.localeCompare(b.title));
  }

  private renderRows(): void {
    if (this.rows.length === 0) {
      this.contentEl.createEl("p", { text: "No News Tasks found." });
      return;
    }

    this.rows.forEach((row) => {
      new Setting(this.contentEl)
        .setName(row.title)
        .addToggle((toggle) => {
          toggle.setValue(row.status === "Done");
          if (row.status === "Waiting") {
            toggle.toggleEl.style.accentColor = "orange";
          }

          toggle.onChange(async (checked) => {
            const nextStatus: TaskStatus = checked ? "Done" : "ToDo";
            await this.updateStatus(row.file, nextStatus);
            row.status = nextStatus;
            toggle.toggleEl.style.accentColor = "";
          });
        })
        .addButton((button) => {
          button.setButtonText("Open").onClick(async () => {
            await this.app.workspace.getLeaf(true).openFile(row.file);
          });
        });
    });
  }

  private normalizeStatus(value: unknown): TaskStatus {
    if (value === "Done" || value === "Waiting" || value === "ToDo") {
      return value;
    }

    return "ToDo";
  }

  private async updateStatus(file: TFile, status: TaskStatus): Promise<void> {
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["Status"] = status;
      });
    } catch (error) {
      new Notice(`Failed to update status: ${String(error)}`);
    }
  }
}
