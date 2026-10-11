import { apiUrl, csrfHeader } from "./api/client";

/**
 * Sending a file to a URL the API issued.
 *
 * Videos and poster images go straight to storage rather than through our API,
 * and both are uploaded with XMLHttpRequest rather than fetch for one reason:
 * it is the only interface that reports progress, and a multi-gigabyte recording
 * with no progress indicator reads as a broken page.
 *
 * The one header this adds is the CSRF token, and only when the destination is
 * our own API. That matters in two directions: the local development storage
 * endpoint is part of the API and, when it is same-origin, the browser attaches
 * the session cookie — which makes the API demand the double-submit token. A
 * real bucket, by contrast, must receive exactly the headers its signature was
 * computed over, and its CORS rules would reject a header they do not know.
 */
export function uploadToStorage(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url, true);
    request.setRequestHeader("Content-Type", file.type);
    if (isOwnApiUrl(url)) {
      for (const [name, value] of Object.entries(csrfHeader())) {
        request.setRequestHeader(name, value);
      }
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.((event.loaded / event.total) * 100);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with status ${request.status}.`));
    request.onerror = () => reject(new Error("The upload could not reach storage."));
    request.send(file);
  });
}

/**
 * Whether a URL points at our own API rather than at object storage.
 *
 * Compared by origin, not by string prefix, so a URL that merely starts with the
 * same characters cannot qualify.
 */
export function isOwnApiUrl(url: string): boolean {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.href;
    return new URL(url, base).origin === new URL(apiUrl(), base).origin;
  } catch {
    return false;
  }
}
