import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function duration(n: number | null) {
  if (n === null) return "Unknown";
  const m = Math.floor(n / 60);
  return `${m}m ${Math.round(n % 60)
    .toString()
    .padStart(2, "0")}s`;
}
