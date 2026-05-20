export type Subject = {
  id: string;
  name: string;
  testDate: string | null;
  testLabel?: string;
  createdAt: string;
  imageIds: string[];
  captions: Record<string, string>;
  cheatSheet?: { markdown: string; generatedAt: string };
  chatHistory?: ChatMessage[];
  practice?: { questions: PracticeQ[]; generatedAt: string };
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
  sheetEdited?: boolean;
};

export type PracticeQ = { q: string; a: string };

export type ImageRef = {
  id: string;
  blob: Blob;
  mimeType: string;
  addedAt: string;
};

export type Settings = {
  geminiKey: string | null;
  theme: "light" | "dark" | "system";
};
