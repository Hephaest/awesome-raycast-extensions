// NOTE: Raycast has no audio API and afplay accepts only a local path, so each clip is downloaded first.
import { spawn as nodeSpawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { HttpClient } from "../api/request";

const AFPLAY = "/usr/bin/afplay";
const SAY = "/usr/bin/say";

export class AudioPlaybackError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AudioPlaybackError";
  }
}

export type SpawnPlayer = (command: string, args: string[], options: { stdio: "ignore" }) => ChildProcess;

export interface AudioPlayerDependencies {
  directory: string;
  http: Pick<HttpClient, "fetchBytes">;
  spawn?: SpawnPlayer;
}

export interface AudioPlayer {
  play(url: string): Promise<void>;
  speak(word: string): Promise<void>;
}

async function sweepLeftovers(directory: string): Promise<void> {
  const names = await readdir(directory).catch(() => [] as string[]);
  await Promise.all(
    names.filter(name => name.endsWith(".mp3")).map(name => unlink(path.join(directory, name)).catch(() => undefined)),
  );
}

export function createAudioPlayer(dependencies: AudioPlayerDependencies): AudioPlayer {
  const spawn: SpawnPlayer = dependencies.spawn ?? nodeSpawn;
  let current: ChildProcess | undefined;
  let playCount = 0;
  const swept = sweepLeftovers(dependencies.directory);

  function stop(): void {
    if (current && current.exitCode === null && !current.killed) {
      current.kill();
    }
    current = undefined;
  }

  function run(command: string, args: string[]): Promise<void> {
    stop();
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: "ignore" });
      current = child;
      child.on("error", error => {
        if (current === child) current = undefined;
        reject(new AudioPlaybackError(`Could not start ${path.basename(command)}`, { cause: error }));
      });
      child.on("exit", (code, signal) => {
        if (current === child) current = undefined;
        // A signal means stop() replaced this clip on purpose.
        if (code === 0 || signal !== null) resolve();
        else reject(new AudioPlaybackError(`${path.basename(command)} exited with code ${code}`));
      });
    });
  }

  async function play(url: string): Promise<void> {
    const response = await dependencies.http.fetchBytes(url);
    if (response.status !== 200 || !response.contentType.startsWith("audio/")) {
      throw new AudioPlaybackError(`The recording could not be downloaded (HTTP ${response.status})`);
    }
    await swept;
    await mkdir(dependencies.directory, { recursive: true });
    // Each play owns its file, so a replay never deletes the file a newer afplay is reading.
    const name = `${createHash("sha1").update(url).digest("hex")}-${++playCount}.mp3`;
    const file = path.join(dependencies.directory, name);
    await writeFile(file, response.bytes);
    try {
      await run(AFPLAY, [file]);
    } finally {
      await unlink(file).catch(() => undefined);
    }
  }

  function speak(word: string): Promise<void> {
    // "--" keeps a headword such as "-ness" from being read as an option.
    return run(SAY, ["--", word]);
  }

  return { play, speak };
}
