import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPageRange(start: number, end: number) {
  return start === end ? `p. ${start}` : `pp. ${start}–${end}`;
}

export function uid() {
  return crypto.randomUUID();
}
