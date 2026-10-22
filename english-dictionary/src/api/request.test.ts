import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_USER_AGENT, fetchText, NetworkError, redactUrl } from "./request";

function responseWith(
  overrides: Partial<{
    status: number;
    url: string;
    contentType: string;
    text: () => Promise<string>;
  }>,
) {
  return {
    status: overrides.status ?? 200,
    url: overrides.url ?? "https://example.test/final",
    headers: new Headers({ "content-type": overrides.contentType ?? "text/html" }),
    text: overrides.text ?? (async () => "<html></html>"),
  } as unknown as Response;
}

function timeoutError(): Error {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchText", () => {
  it("should send the contact User-Agent and return the status, final URL, content type, and body", async () => {
    const fetchMock = vi.fn(async () => responseWith({ status: 200, text: async () => "body" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchText("https://example.test/word")).resolves.toEqual({
      status: 200,
      url: "https://example.test/final",
      contentType: "text/html",
      body: "body",
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(CONTACT_USER_AGENT);
  });

  it("should send a caller's own headers alongside the contact User-Agent", async () => {
    const fetchMock = vi.fn(async () => responseWith({ status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchText("https://example.test/word", { accessKey: "a-key" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.accessKey).toBe("a-key");
    expect(headers["User-Agent"]).toBe(CONTACT_USER_AGENT);
  });

  it("should let a caller replace the default Accept header", async () => {
    const fetchMock = vi.fn(async () => responseWith({ status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchText("https://example.test/word", { Accept: "application/json" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toBe("application/json");
  });

  it("should never let a caller replace the contact User-Agent", async () => {
    const fetchMock = vi.fn(async () => responseWith({ status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchText("https://example.test/word", { "User-Agent": "something-else" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe(CONTACT_USER_AGENT);
  });

  it("should turn a timeout that fires while the body is still streaming into a NetworkError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responseWith({ text: () => Promise.reject(timeoutError()) })),
    );
    const failure = await fetchText("https://example.test/word?key=secret").catch(error => error);
    expect(failure).toBeInstanceOf(NetworkError);
    expect(failure.timedOut).toBe(true);
    expect(failure.message).not.toContain("secret");
  });

  it("should turn a failed connection into a NetworkError that is not marked as a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed"))),
    );
    const failure = await fetchText("https://example.test/word").catch(error => error);
    expect(failure).toBeInstanceOf(NetworkError);
    expect(failure.timedOut).toBe(false);
  });
});

describe("redactUrl", () => {
  it("should drop the query string and keep the rest of the URL", () => {
    expect(redactUrl("https://www.dictionaryapi.com/api/v3/references/collegiate/json/run?key=secret")).toBe(
      "https://www.dictionaryapi.com/api/v3/references/collegiate/json/run",
    );
    expect(redactUrl("not a url?key=secret")).toBe("not a url");
  });
});
