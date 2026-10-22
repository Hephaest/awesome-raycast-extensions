// NOTE: Cloudflare in front of Collins often turns Node's fetch away, so Collins requests go through the system curl.
import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { DEFAULT_TEXT_ACCEPT, NetworkError, REQUEST_TIMEOUT_MS, USER_AGENT } from "./request";
import type { BytesResponse, HttpClient, TextResponse } from "./request";

const CURL = "/usr/bin/curl";

const TIMEOUT_EXIT_CODE = 28;

// The status goes to stderr, so stdout stays the byte-exact body.
const WRITE_OUT = "%{stderr}%{http_code}\\t%{content_type}\\t%{url_effective}";

export type SpawnCurl = (command: string, args: string[]) => ChildProcess;

export interface CurlClientDependencies {
  spawn?: SpawnCurl;
}

// ! The key is pasted text, so a quote or newline in it must never start a new curl directive.
function quote(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `"${escaped}"`;
}

// curl appends headers instead of replacing them, so the merge happens here.
function headerLines(accept: string, headers?: Record<string, string>): string[] {
  const merged = new Map<string, string>([["accept", `Accept: ${accept}`]]);
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (/^user-agent$/i.test(name)) continue;
    merged.set(name.toLowerCase(), `${name}: ${value}`);
  }
  return [...merged.values()];
}

function configFor(url: string, accept: string, headers: Record<string, string> | undefined, follow: boolean): string {
  const lines = [
    `url = ${quote(url)}`,
    ...headerLines(accept, headers).map(header => `header = ${quote(header)}`),
    `user-agent = ${quote(USER_AGENT)}`,
    // Cloudflare in front of Collins refuses HTTP/2.
    "http1.1",
    `max-time = ${REQUEST_TIMEOUT_MS / 1000}`,
    "silent",
    "show-error",
    `write-out = "${WRITE_OUT}"`,
  ];
  if (follow) lines.push("location");
  return `${lines.join("\n")}\n`;
}

function causeFor(code: number | null, stderr: string): Error {
  const reported = stderr
    .split("\n")
    .find(line => line.startsWith("curl:"))
    ?.trim();
  const cause = new Error(reported || `curl exited with code ${code}`);
  if (code === TIMEOUT_EXIT_CODE) cause.name = "TimeoutError";
  return cause;
}

function run(spawn: SpawnCurl, url: string, config: string): Promise<BytesResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(CURL, ["--config", "-"]);
    const chunks: Buffer[] = [];
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", error => reject(new NetworkError(url, error)));
    // curl can exit before reading stdin, and an unhandled EPIPE would crash the extension.
    child.stdin?.on("error", () => undefined);
    child.stdin?.end(config);
    // "close", not "exit": the pipes must drain first, or a long body is cut short.
    child.on("close", code => {
      if (code !== 0) {
        reject(new NetworkError(url, causeFor(code, stderr)));
        return;
      }
      const [status, contentType, effectiveUrl] = (stderr.trimEnd().split("\n").at(-1) ?? "").split("\t");
      if (!status || !Number.isFinite(Number(status))) {
        reject(new NetworkError(url, new Error("curl printed no status")));
        return;
      }
      resolve({
        status: Number(status),
        url: effectiveUrl || url,
        contentType: contentType ?? "",
        bytes: Buffer.concat(chunks),
      });
    });
  });
}

export function createCurlClient(dependencies: CurlClientDependencies = {}): HttpClient {
  const spawn: SpawnCurl = dependencies.spawn ?? nodeSpawn;

  async function fetchText(url: string, headers?: Record<string, string>): Promise<TextResponse> {
    // ! Redirects are not followed, so the access key is never resent to another host.
    const { bytes, ...rest } = await run(spawn, url, configFor(url, DEFAULT_TEXT_ACCEPT, headers, false));
    return { ...rest, body: bytes.toString("utf8") };
  }

  function fetchBytes(url: string): Promise<BytesResponse> {
    return run(spawn, url, configFor(url, "*/*", undefined, true));
  }

  return { fetchText, fetchBytes };
}

export const curlClient: HttpClient = createCurlClient();
