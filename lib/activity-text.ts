import type { ActivityEvent } from "@/lib/activity";

export type ActivityIconKey = "gen" | "edit" | "upload" | "new";

export type RenderedActivity = {
  iconKey: ActivityIconKey;
  text: string;
};

function fileLabel(mimeType: string | undefined, count: number): string {
  if (mimeType === "application/pdf") return count === 1 ? "PDF" : "PDFs";
  return count === 1 ? "photo" : "photos";
}

export function renderActivity(event: ActivityEvent): RenderedActivity {
  const subject = event.subjectName ?? "a subject";
  const data = event.data as Record<string, unknown>;

  switch (event.type) {
    case "cheatsheet_generated":
      return { iconKey: "gen", text: `Generated cheat sheet for ${subject}` };

    case "cheatsheet_refined": {
      const topic = typeof data.topic === "string" && data.topic.length > 0 ? data.topic : "the sheet";
      return { iconKey: "edit", text: `Refined ${topic} in ${subject}` };
    }

    case "chat_question": {
      const topic = typeof data.topic === "string" && data.topic.length > 0 ? data.topic : "a question";
      return { iconKey: "edit", text: `Asked about ${topic} in ${subject}` };
    }

    case "files_uploaded": {
      const count = typeof data.count === "number" ? data.count : 1;
      const mimeType = typeof data.mimeType === "string" ? data.mimeType : undefined;
      return { iconKey: "upload", text: `Uploaded ${count} ${fileLabel(mimeType, count)} to ${subject}` };
    }

    case "subject_created": {
      const name = typeof data.name === "string" ? data.name : subject;
      return { iconKey: "new", text: `Created new subject ${name}` };
    }
  }
}
