import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { NetworkError, USER_AGENT } from "./request";
import { createCurlClient } from "./curl";
import type { SpawnCurl } from "./curl";

class FakeStdin extends EventEmitter {
  written = "";
  end(chunk: string) {
    this.written += chunk;
  }
}

class FakeCurl extends EventEmitter {
  stdin = new FakeStdin();
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  answer(body: Buffer | Buffer[], meta: string, code = 0) {
    for (const chunk of Array.isArray(body) ? body : [body]) this.stdout.emit("data", chunk);
    if (meta) this.stderr.emit("data", Buffer.from(meta));
    this.emit("close", code, null);
  }
}

interface Spawned {
  command: string;
  args: string[];
  child: FakeCurl;
}

function curlSpawning() {
  const spawned: Spawned[] = [];
  const spawn: SpawnCurl = (command, args) => {
    const child = new FakeCurl();
    spawned.push({ command, args, child });
    return child as unknown as ChildProcess;
  };
  return { spawned, client: createCurlClient({ spawn }) };
}

const OK_META = "200\tapplication/json\thttps://example.test/word";

describe("a response curl brought back", () => {
  it("should report the status, content type, final URL and body", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.from('{"a":\t"b"}\n'), OK_META);
    await expect(pending).resolves.toEqual({
      status: 200,
      url: "https://example.test/word",
      contentType: "application/json",
      body: '{"a":\t"b"}\n',
    });
  });

  it("should read a character whose bytes arrive in two pieces as one character", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    const ipa = Buffer.from("ˈkɪtʃɪn", "utf8");
    spawned[0].child.answer([ipa.subarray(0, 3), ipa.subarray(3)], OK_META);
    await expect(pending).resolves.toMatchObject({ body: "ˈkɪtʃɪn" });
  });

  it("should report an empty content type when curl printed none", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.from("<html>"), "403\t\thttps://example.test/word");
    await expect(pending).resolves.toMatchObject({ status: 403, contentType: "" });
  });

  it("should hand back the bytes untouched when the caller asked for bytes", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchBytes("https://example.test/clip.mp3");
    const mp3 = Buffer.from([0xff, 0xfb, 0x00, 0x0a, 0x1b]);
    spawned[0].child.answer(mp3, "200\taudio/mpeg\thttps://example.test/clip.mp3");
    const response = await pending;
    expect(response.bytes.equals(mp3)).toBe(true);
  });
});

describe("the request curl is asked to make", () => {
  it("should keep the access key out of the argument list and send it on standard input", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word", { accessKey: "super-secret-key" });
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await pending;
    expect(spawned[0].command).toBe("/usr/bin/curl");
    expect(spawned[0].args).toEqual(["--config", "-"]);
    expect(JSON.stringify(spawned[0].args)).not.toContain("super-secret-key");
    expect(spawned[0].child.stdin.written).toContain('header = "accessKey: super-secret-key"');
  });

  it("should ask over HTTP/1.1 with the product User-Agent and the shared timeout", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await pending;
    const config = spawned[0].child.stdin.written;
    expect(config).toContain("\nhttp1.1\n");
    expect(config).toContain(`user-agent = "${USER_AGENT}"`);
    expect(config).not.toMatch(/user-agent = ".*https?:/);
    expect(config).toContain("max-time = 10");
  });

  it("should let the caller replace the default Accept without repeating it", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word", { Accept: "application/json" });
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await pending;
    const accepts = spawned[0].child.stdin.written.split("\n").filter(line => line.startsWith('header = "Accept:'));
    expect(accepts).toEqual(['header = "Accept: application/json"']);
  });

  it("should refuse a caller's User-Agent so the product one always stands", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word", { "User-Agent": "curl/8.7.1" });
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await pending;
    expect(spawned[0].child.stdin.written).not.toContain("curl/8.7.1");
  });

  it("should escape a key that could otherwise become another curl directive", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word", { accessKey: 'a"\ninsecure' });
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await pending;
    const lines = spawned[0].child.stdin.written.split("\n");
    expect(lines).not.toContain("insecure");
  });

  it("should follow a redirect for a clip but never for a request carrying headers", async () => {
    const { spawned, client } = curlSpawning();
    const text = client.fetchText("https://example.test/word", { accessKey: "k" });
    spawned[0].child.answer(Buffer.from("{}"), OK_META);
    await text;
    const bytes = client.fetchBytes("https://example.test/clip.mp3");
    spawned[1].child.answer(Buffer.from([0x00]), "200\taudio/mpeg\thttps://cdn.test/clip.mp3");
    await bytes;
    expect(spawned[0].child.stdin.written).not.toContain("\nlocation\n");
    expect(spawned[1].child.stdin.written).toContain("\nlocation\n");
  });
});

describe("a request that never completed", () => {
  it("should report a timeout when curl stopped at the time limit", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.alloc(0), "curl: (28) Operation timed out\n000\t\thttps://example.test/word", 28);
    await expect(pending).rejects.toMatchObject({ name: "NetworkError", timedOut: true });
  });

  it("should report an unreachable host when curl could not connect", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.alloc(0), "curl: (35) TLS connect error\n000\t\thttps://example.test/word", 35);
    await expect(pending).rejects.toMatchObject({ name: "NetworkError", timedOut: false });
  });

  it("should keep the search term out of the failure it reports", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/search?q=lantern&accessKey=secret");
    spawned[0].child.answer(Buffer.alloc(0), "curl: (35) TLS connect error", 35);
    await expect(pending).rejects.toSatisfy(
      (error: NetworkError) => !error.message.includes("lantern") && !error.message.includes("secret"),
    );
  });

  it("should report a failure when curl itself could not be started", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.emit("error", new Error("spawn ENOENT"));
    await expect(pending).rejects.toBeInstanceOf(NetworkError);
  });

  it("should report a failure when curl printed no status at all", async () => {
    const { spawned, client } = curlSpawning();
    const pending = client.fetchText("https://example.test/word");
    spawned[0].child.answer(Buffer.from("{}"), "");
    await expect(pending).rejects.toBeInstanceOf(NetworkError);
  });
});
