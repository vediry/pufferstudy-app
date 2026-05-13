"use client";

import type { Subject, Settings } from "@/types";

const SUBJECTS_KEY = "pufferstudy:subjects";
const SETTINGS_KEY = "pufferstudy:settings";

const DEFAULT_SETTINGS: Settings = {
  geminiKey: null,
  theme: "system",
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getSubjects(): Subject[] {
  if (!isBrowser()) return [];
  const parsed = safeParse<Subject[]>(localStorage.getItem(SUBJECTS_KEY), []);
  return Array.isArray(parsed) ? parsed.filter(isValidSubject) : [];
}

export function saveSubjects(subjects: Subject[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
}

export function getSubject(id: string): Subject | null {
  return getSubjects().find((s) => s.id === id) ?? null;
}

export function upsertSubject(subject: Subject): void {
  const all = getSubjects();
  const idx = all.findIndex((s) => s.id === subject.id);
  if (idx >= 0) all[idx] = subject;
  else all.unshift(subject);
  saveSubjects(all);
}

export function deleteSubject(id: string): void {
  saveSubjects(getSubjects().filter((s) => s.id !== id));
}

export function getSettings(): Settings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  const parsed = safeParse<Settings>(localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...parsed };
}

export function saveSettings(settings: Partial<Settings>): void {
  if (!isBrowser()) return;
  const next = { ...getSettings(), ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function isValidSubject(value: unknown): value is Subject {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Subject>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.createdAt === "string" &&
    Array.isArray(s.imageIds) &&
    typeof s.captions === "object" &&
    s.captions !== null
  );
}
