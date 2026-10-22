// ! Cloudflare in front of Collins blocks a User-Agent that holds a URL, so the curl client sends the bare name.
export const USER_AGENT = "EnglishDictionary/1.0";

// Wikimedia's User-Agent policy asks for contact information.
export const CONTACT_USER_AGENT = `${USER_AGENT} (https://github.com/Hephaest/awesome-raycast-extensions)`;

export const REQUEST_TIMEOUT_MS = 10_000;

export const DEFAULT_TEXT_ACCEPT = "text/html,application/json;q=0.9,*/*;q=0.8";

export interface TextResponse {
  status: number;
  url: string;
  contentType: string;
  body: string;
}

export interface BytesResponse {
  status: number;
  url: string;
  contentType: string;
  bytes: Buffer;
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url.replace(/\?.*$/, "");
  }
}

export class NetworkError extends Error {
  readonly timedOut: boolean;

  constructor(url: string, cause: unknown) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    super(
      timedOut
        ? `Timed out after ${REQUEST_TIMEOUT_MS / 1000} s: ${redactUrl(url)}`
        : `Could not reach ${redactUrl(url)}`,
      {
        cause,
      },
    );
    this.name = "NetworkError";
    this.timedOut = timedOut;
  }
}

export type HttpClient = {
  fetchText(url: string, headers?: Record<string, string>): Promise<TextResponse>;
  fetchBytes(url: string): Promise<BytesResponse>;
};

interface Completed<Payload> {
  status: number;
  url: string;
  contentType: string;
  payload: Payload;
}

async function request<Payload>(
  url: string,
  accept: string,
  read: (response: Response) => Promise<Payload>,
  headers?: Record<string, string>,
): Promise<Completed<Payload>> {
  try {
    const response = await fetch(url, {
      // User-Agent goes last, so a caller can never replace it.
      headers: { Accept: accept, ...headers, "User-Agent": CONTACT_USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "follow",
    });
    const payload = await read(response);
    return {
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type") ?? "",
      payload,
    };
  } catch (cause) {
    throw new NetworkError(url, cause);
  }
}

export async function fetchText(url: string, headers?: Record<string, string>): Promise<TextResponse> {
  const { payload, ...rest } = await request(url, DEFAULT_TEXT_ACCEPT, response => response.text(), headers);
  return { ...rest, body: payload };
}

export async function fetchBytes(url: string): Promise<BytesResponse> {
  const { payload, ...rest } = await request(url, "*/*", async response => Buffer.from(await response.arrayBuffer()));
  return { ...rest, bytes: payload };
}

export const httpClient: HttpClient = { fetchText, fetchBytes };
