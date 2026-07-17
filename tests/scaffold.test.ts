import { describe, expect, it } from "vitest";
import { NEWS_TASKS_FOLDER, NewsTaskNote } from "../NewsTaskNote";

describe("NewsTaskNote", () => {
  it("requires title and story link", () => {
    const note = new NewsTaskNote({
      title: "",
      story: "Story without wikilink",
      done: false,
    });

    const errors = note.validate();
    expect(errors).toContain("Title is required.");
    expect(errors).toContain(
      "Story must contain at least one Obsidian link like [[Story Title]].",
    );
  });

  it("renders expected frontmatter keys and values", () => {
    const note = new NewsTaskNote({
      title: "Check council records",
      story: "[[Budget Overspend Investigation]]",
      done: true,
      goal: "Publish accountability piece",
      startDate: "2026-07-16",
      dueDate: "2026-07-18",
      waitFor: "Interview finance director",
      people: ["[[Jane Doe]]"],
      organisations: ["[[City Council]]"],
      tags: ["public-spending", "urgent"],
    });

    const md = note.toMarkdown();
    expect(md).toContain('Title: "Check council records"');
    expect(md).toContain('Story: "[[Budget Overspend Investigation]]"');
    expect(md).toContain("Done: true");
    expect(md).toContain('Goal: "Publish accountability piece"');
    expect(md).toContain("Start Date: 2026-07-16");
    expect(md).toContain("Due Date: 2026-07-18");
    expect(md).toContain('Wait For: "Interview finance director"');
    expect(md).toContain('People: ["[[Jane Doe]]"]');
    expect(md).toContain('Organisations: ["[[City Council]]"]');
    expect(md).toContain('Tags: ["public-spending", "urgent"]');
    expect(md).toContain("type: News Task");
  });

  it("always resolves paths inside News Tasks folder", () => {
    const note = new NewsTaskNote({
      title: "FOI request follow-up",
      story: "[[Town Hall Contracts]]",
      done: false,
    });

    expect(note.folderPath()).toBe(NEWS_TASKS_FOLDER);
    expect(note.filePath()).toBe("News Tasks/FOI request follow-up.md");
  });
});
