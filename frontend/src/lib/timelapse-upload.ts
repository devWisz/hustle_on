/**
 * The rules a timelapse upload is held to, in one place.
 *
 * These mirror the API rather than replace it — it is still the authority, and
 * its errors still win. The point of checking here is that the API can only
 * answer after bytes have been requested, and a two-gigabyte round trip is a
 * poor way to learn that a file is a .gif.
 */

/**
 * The storage ceiling, matching the API's default `MaxBytes`. The API only
 * reports its own value after it signs a URL, which is too late to be a warning.
 */
export const MAX_VIDEO_BYTES = 2 * 1024 ** 3;

/** The API's allowlist, so a type rejected here is one it would reject too. */
export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
] as const;

export const ACCEPT_VIDEO_ATTR = ACCEPTED_VIDEO_TYPES.join(",");

/** Matches the summary CHECK constraint, which pads into the column's floor. */
export const MIN_SUMMARY = 40;
export const MAX_SUMMARY = 4000;
export const MIN_TITLE = 3;
export const MAX_TITLE = 120;
export const MIN_SESSION_MINUTES = 1;
export const MAX_SESSION_MINUTES = 10080;

/**
 * Why a file cannot be uploaded, or null when it can.
 *
 * Browsers report an empty type for formats they do not know, which includes
 * plenty of real video, so the extension is consulted as well rather than
 * turning those files away on a technicality.
 */
export function fileProblem(file: File): string | null {
  if (file.type && !isAcceptedType(file.type)) {
    return rejectMessage(file);
  }
  if (!file.type && !hasAcceptedExtension(file.name)) {
    return rejectMessage(file);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `${describeFile(file)} is ${formatBytes(file.size)}. The limit is 2 GiB.`;
  }
  if (file.size === 0) {
    return "That file is empty. Choose the recording itself.";
  }
  return null;
}

function rejectMessage(file: File): string {
  return `${describeFile(file)} is not a video we accept. Use ${acceptedTypesLabel()}.`;
}

function isAcceptedType(type: string): boolean {
  return ACCEPTED_VIDEO_TYPES.some((accepted) => accepted === type);
}

function hasAcceptedExtension(name: string): boolean {
  return /\.(mp4|m4v|mov|webm|mkv)$/i.test(name);
}

export function acceptedTypesLabel(): string {
  return "MP4, MOV, WebM or MKV";
}

/** The duration a clip reports, as whole minutes of work, never below one. */
export function durationToMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/** A file's size in the binary units the limit is stated in. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes % 1024 ** 3 ? 1 : 0)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(bytes % 1024 ** 2 ? 1 : 0)} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

/**
 * Digits only, because a number input still accepts `e`, `+` and `-`, and the
 * API counts the session in whole minutes. Five digits covers the 10080 ceiling.
 */
export function cleanNumber(value: string): string {
  return value.replace(/[^\d]/g, "").slice(0, 5);
}

/**
 * Names the file and its extension, because an operator who dragged the wrong
 * export needs to recognize it here, not guess which one the form means.
 */
function describeFile(file: File): string {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  return `“${file.name}”${extension ? ` (.${extension.toLowerCase()})` : ""}`;
}
