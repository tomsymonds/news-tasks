import { Notice, Plugin, TFile, TFolder } from "obsidian";
import { NEWS_TASKS_FOLDER, NewsTaskNote, newsTaskFromFrontmatter } from "./NewsTaskNote";
import { NewsTaskNoteModal } from "./NewsTaskNoteModal";

export default class NewsTasksPlugin extends Plugin {
  async onload(): Promise<void> {
    this.addCommand({
      id: "create-news-task-note",
      name: "Create News Task Note",
      callback: () => {
        const initialStoryLink = this.getActiveStoryLink();
        new NewsTaskNoteModal(this.app, {
          mode: "create",
          initialValues: {
            story: initialStoryLink ?? undefined,
          },
          onSubmit: async (note: NewsTaskNote) => {
            await this.saveNewsTaskNote(note);
          },
        }).open();
      },
    });

    this.addCommand({
      id: "edit-news-task-note",
      name: "Edit News Task Note",
      callback: async () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
          new Notice("Open a News Task note to edit.");
          return;
        }

        if (!this.isNewsTaskFile(activeFile)) {
          new Notice("Active file is not a News Task note in News Tasks folder.");
          return;
        }

        this.openEditModalForFile(activeFile);
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, abstractFile) => {
        if (!(abstractFile instanceof TFile)) {
          return;
        }

        if (!this.isNewsTaskFile(abstractFile)) {
          return;
        }

        menu.addItem((item) => {
          item
            .setTitle("Edit News Task Note")
            .setIcon("pencil")
            .onClick(() => {
              this.openEditModalForFile(abstractFile);
            });
        });
      }),
    );

  }

  onunload(): void {
    // No-op.
  }

  private async saveNewsTaskNote(note: NewsTaskNote): Promise<void> {
    await this.ensureNewsTasksFolder();

    const outputPath = this.resolveUniqueTaskPath(note);
    const file = await this.app.vault.create(outputPath, note.toMarkdown());
    await this.app.workspace.getLeaf(true).openFile(file);
    new Notice(`Created task: ${file.basename}`);
  }

  private async updateNewsTaskNote(file: TFile, note: NewsTaskNote): Promise<void> {
    await this.ensureNewsTasksFolder();

    const currentText = await this.app.vault.read(file);
    const body = this.extractBody(currentText);
    await this.app.vault.modify(file, `${note.toMarkdown()}${body}`);

    const desiredPath = this.resolveUniqueTaskPath(note, file.path);
    if (desiredPath !== file.path) {
      await this.app.fileManager.renameFile(file, desiredPath);
    }

    new Notice("Updated News Task note.");
  }

  private async ensureNewsTasksFolder(): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(NEWS_TASKS_FOLDER);
    if (existing && !(existing instanceof TFolder)) {
      throw new Error(`${NEWS_TASKS_FOLDER} exists but is not a folder.`);
    }

    if (!existing) {
      await this.app.vault.createFolder(NEWS_TASKS_FOLDER);
    }
  }

  private resolveUniqueTaskPath(note: NewsTaskNote, currentPath?: string): string {
    const baseName = note.fileName() || "Untitled Task";
    const folderPath = note.folderPath();
    let candidate = `${folderPath}/${baseName}.md`;
    let counter = 2;

    while (this.app.vault.getAbstractFileByPath(candidate) && candidate !== currentPath) {
      candidate = `${folderPath}/${baseName} ${counter}.md`;
      counter += 1;
    }

    return candidate;
  }

  private isNewsTaskFile(file: TFile): boolean {
    if (!file.path.startsWith(`${NEWS_TASKS_FOLDER}/`)) {
      return false;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const type = cache?.frontmatter?.["type"];
    return type === "News Task";
  }

  private getActiveStoryLink(): string | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      return null;
    }

    const cache = this.app.metadataCache.getFileCache(activeFile);
    const type = cache?.frontmatter?.["type"];
    if (typeof type !== "string" || type.trim().toLowerCase() !== "story") {
      return null;
    }

    return `[[${activeFile.basename}]]`;
  }

  private extractBody(markdown: string): string {
    if (!markdown.startsWith("---")) {
      return markdown;
    }

    const endIndex = markdown.indexOf("\n---", 3);
    if (endIndex === -1) {
      return "";
    }

    return markdown.slice(endIndex + 4).replace(/^\n/, "");
  }

  private openEditModalForFile(file: TFile): void {
    const cache = this.app.metadataCache.getFileCache(file);
    const note = newsTaskFromFrontmatter(cache?.frontmatter, file.basename);

    new NewsTaskNoteModal(this.app, {
      mode: "edit",
      initialValues: note.toProps(),
      onSubmit: async (updated: NewsTaskNote) => {
        await this.updateNewsTaskNote(file, updated);
      },
    }).open();
  }
}
    