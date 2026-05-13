import type { ChatMessage } from "@/types";

export type GenerateMode = "cheatsheet" | "chat" | "practice";

const CHEATSHEET_SYSTEM = `You are PufferStudy, a careful study assistant for a student preparing for a test.

You will receive photos of the student's notes, packets, and homework along with optional captions the student wrote. Your job is to produce a clean, well-organized cheat sheet in Markdown that the student can print and study from.

Rules:
- Output only Markdown — no code fences around the whole sheet.
- Lead with a concise summary heading using the subject name.
- Group content by topic, not by which photo it came from.
- Use ## for top-level sections, ### for sub-topics, bullets for facts.
- Quote definitions in **bold** for the key term, then a one-line explanation.
- Include formulas, dates, and named concepts that look testable.
- Skip social/meta content from the photos (teacher names, page numbers, doodles) unless clearly relevant.
- If a photo is illegible, do not invent content from it — silently skip what you cannot read.
- Aim for one printed page (about 500–800 words). Be dense but readable.
- Do not include preamble like "Here is your cheat sheet". Just start with the heading.`;

const CHAT_SYSTEM = `You are PufferStudy, a homework helper.

You have been given a set of the student's notes and captions for a specific subject. Answer the student's questions using those notes as the primary source.

Rules:
- Be concise. Two or three short paragraphs maximum unless asked to elaborate.
- When the notes don't fully cover a question, say what you can from the notes and then add what is widely accepted from outside the notes, clearly labeled.
- If the question is off-topic for studying (e.g. unrelated chitchat), gently redirect back to the subject.
- Don't praise the student or apologize. Just help.
- Use Markdown for any lists, formulas, or emphasis.`;

const PRACTICE_SYSTEM = `You are PufferStudy, generating practice questions for a student about to take a test.

You will receive photos of the student's notes. Generate practice questions that test understanding of the key concepts in those notes.

Output ONLY a JSON object with this exact shape — no preamble, no Markdown fences:
{ "questions": [ { "q": "...", "a": "..." }, ... ] }

Rules:
- Produce between 6 and 12 questions.
- Mix recall (definitions, dates) and application (one-step problems).
- Each answer is one or two sentences, accurate, and grounded in the notes.
- Do not include multiple-choice options — answers are short-form.
- Do not include any text outside the JSON object.`;

export function systemPromptFor(mode: GenerateMode): string {
  switch (mode) {
    case "cheatsheet": return CHEATSHEET_SYSTEM;
    case "chat":       return CHAT_SYSTEM;
    case "practice":   return PRACTICE_SYSTEM;
  }
}

type CheatsheetUserInput = {
  subjectName: string;
  testLabel?: string;
  captions: string[];
};

type ChatUserInput = {
  subjectName: string;
  history: ChatMessage[];
  question: string;
  captions: string[];
};

type PracticeUserInput = {
  subjectName: string;
  captions: string[];
};

export function userPromptForCheatsheet(input: CheatsheetUserInput): string {
  const captionBlock = input.captions.length
    ? `\n\nStudent's captions (one per photo, in order):\n${input.captions.map((c, i) => `${i + 1}. ${c || "(no caption)"}`).join("\n")}`
    : "";
  const labelLine = input.testLabel ? ` (${input.testLabel})` : "";
  return `Subject: ${input.subjectName}${labelLine}.${captionBlock}\n\nProduce the cheat sheet now.`;
}

export function userPromptForChat(input: ChatUserInput): string {
  const captionBlock = input.captions.length
    ? `\n\nCaptions on the student's notes:\n${input.captions.map((c, i) => `${i + 1}. ${c || "(no caption)"}`).join("\n")}`
    : "";
  return `Subject: ${input.subjectName}.${captionBlock}\n\nQuestion from the student: ${input.question}`;
}

export function userPromptForPractice(input: PracticeUserInput): string {
  const captionBlock = input.captions.length
    ? `\n\nStudent's captions:\n${input.captions.map((c, i) => `${i + 1}. ${c || "(no caption)"}`).join("\n")}`
    : "";
  return `Subject: ${input.subjectName}.${captionBlock}\n\nGenerate the practice JSON now.`;
}
