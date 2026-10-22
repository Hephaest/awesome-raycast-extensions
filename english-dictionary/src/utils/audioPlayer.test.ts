import { EventEmitter } from "node:events";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ChildProcess } from "node:child_process";
import { createAudioPlayer } from "./audioPlayer";
import type { SpawnPlayer } from "./audioPlayer";

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  killed = false;
  kill() {
    this.killed = true;
    this.exitCode = null;
    this.emit("exit", null, "SIGTERM");
    return true;
  }
  finish(code: number) {
    this.exitCode = code;
    this.emit("exit", code, null);
  }
}

interface Spawned {
  command: string;
  args: string[];
  child: FakeChild;
}

const settle = () => new Promise(resolve => setTimeout(resolve, 15));

function harness(response: { status: number; contentType: string }) {
  const spawned: Spawned[] = [];
  const directoryPromise = mkdtemp(path.join(os.tmpdir(), "player-test-"));
  const http = {
    async fetchBytes(url: string) {
      return { ...response, url, bytes: Buffer.from("ID3 fake audio") };
    },
  };
  const spawn: SpawnPlayer = (command, args) => {
    const child = new FakeChild();
    spawned.push({ command, args, child });
    return child as unknown as ChildProcess;
  };
  return {
    spawned,
    async player(leftover?: string) {
      const directory = await directoryPromise;
      if (leftover) await writeFile(path.join(directory, leftover), "stale");
      return { player: createAudioPlayer({ directory, http, spawn }), directory };
    },
  };
}

describe("createAudioPlayer", () => {
  describe("play", () => {
    it("should download the clip, hand the file to afplay, and delete it when playback ends", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player, directory } = await setup.player();
      const playing = player.play("https://example.test/kitchen.mp3");
      await settle();
      const [call] = setup.spawned;
      expect(call.command).toBe("/usr/bin/afplay");
      expect(call.args[0].startsWith(directory)).toBe(true);
      expect(await readdir(directory)).toHaveLength(1);
      call.child.finish(0);
      await expect(playing).resolves.toBeUndefined();
      expect(await readdir(directory)).toHaveLength(0);
    });

    it("should refuse to play a download that is not audio", async () => {
      const setup = harness({ status: 403, contentType: "text/html" });
      const { player } = await setup.player();
      await expect(player.play("https://example.test/blocked.mp3")).rejects.toThrow("HTTP 403");
      expect(setup.spawned).toHaveLength(0);
    });

    it("should stop the clip still playing when a new one starts, without reporting a failure", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player } = await setup.player();
      const first = player.play("https://example.test/us.mp3");
      await settle();
      const second = player.play("https://example.test/uk.mp3");
      await settle();
      expect(setup.spawned[0].child.killed).toBe(true);
      await expect(first).resolves.toBeUndefined();
      setup.spawned[1].child.finish(0);
      await expect(second).resolves.toBeUndefined();
    });

    it("should give a replay of the same clip its own file so the earlier cleanup cannot delete it", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player, directory } = await setup.player();
      const first = player.play("https://example.test/us.mp3");
      await settle();
      const second = player.play("https://example.test/us.mp3");
      await settle();
      const [firstCall, secondCall] = setup.spawned;
      expect(secondCall.args[0]).not.toBe(firstCall.args[0]);
      await first;
      expect(await readdir(directory)).toEqual([path.basename(secondCall.args[0])]);
      secondCall.child.finish(0);
      await expect(second).resolves.toBeUndefined();
    });

    it("should report a player that exits with an error code", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player } = await setup.player();
      const playing = player.play("https://example.test/broken.mp3");
      await settle();
      setup.spawned[0].child.finish(1);
      await expect(playing).rejects.toThrow("exited with code 1");
    });

    it("should remove clips left behind by an earlier crash before writing new ones", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player, directory } = await setup.player("stale-clip.mp3");
      const playing = player.play("https://example.test/kitchen.mp3");
      await settle();
      expect(await readdir(directory)).not.toContain("stale-clip.mp3");
      setup.spawned[0].child.finish(0);
      await playing;
    });
  });

  describe("speak", () => {
    it("should speak the word through the macOS voice, protected from being read as an option", async () => {
      const setup = harness({ status: 200, contentType: "audio/mpeg" });
      const { player } = await setup.player();
      const speaking = player.speak("-ness");
      await settle();
      expect(setup.spawned[0]).toMatchObject({ command: "/usr/bin/say", args: ["--", "-ness"] });
      setup.spawned[0].child.finish(0);
      await expect(speaking).resolves.toBeUndefined();
    });
  });
});
