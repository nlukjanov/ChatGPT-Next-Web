import { STORAGE_KEY } from "@/app/constant";
import { SyncStore } from "@/app/store/sync";
import { chunks } from "../format";

export type UpstashConfig = SyncStore["upstash"];
export type UpStashClient = ReturnType<typeof createUpstashClient>;

export function createUpstashClient(store: SyncStore) {
  const config = store.upstash;
  const storeKey = config.username.length === 0 ? STORAGE_KEY : config.username;
  const chunkCountKey = `${storeKey}-chunk-count`;
  const chunkIndexKey = (i: number) => `${storeKey}-chunk-${i}`;

  const proxyUrl =
    store.useProxy && store.proxyUrl.length > 0 ? store.proxyUrl : undefined;

  return {
    async check() {
      try {
        const res = await fetch(this.path(`get/${storeKey}`, proxyUrl), {
          method: "GET",
          headers: this.headers(),
        });
        console.log("[Upstash] check", res.status, res.statusText);
        return [200].includes(res.status);
      } catch (e) {
        console.error("[Upstash] failed to check", e);
      }
      return false;
    },

    async redisGet(key: string) {
      const res = await fetch(this.path(`get/${key}`, proxyUrl), {
        method: "GET",
        headers: this.headers(),
      });

      console.log("[Upstash] get key = ", key, res.status, res.statusText);
      const resJson = (await res.json()) as { result: string };

      return resJson.result;
    },

    async redisSet(key: string, value: string) {
      const res = await fetch(this.path(`set/${key}`, proxyUrl), {
        method: "POST",
        headers: this.headers(),
        body: value,
      });

      console.log("[Upstash] set key = ", key, res.status, res.statusText);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`[Upstash] set failed: ${res.status} ${res.statusText} ${body}`);
      }
      await res.text();
    },

    async get() {
      const chunkCount = Number(await this.redisGet(chunkCountKey));
      if (!Number.isInteger(chunkCount) || chunkCount === 0) return;

      const commands = new Array(chunkCount)
        .fill(0)
        .map((_, i) => ["GET", chunkIndexKey(i)]);
      const results = await this.redisPipeline(commands);
      const fetchedChunks = results.map((r) => r.result);
      if (fetchedChunks.some((c) => c === null || c === undefined)) {
        throw new Error(
          "[Upstash] incomplete data: one or more chunks missing",
        );
      }
      console.log("[Upstash] get chunks count", chunkCount);
      return fetchedChunks.join("");
    },

    async set(_: string, value: string) {
      const allChunks = [...chunks(value)];
      const commands = [
        ...allChunks.map((chunk, i) => ["SET", chunkIndexKey(i), chunk]),
        ["SET", chunkCountKey, allChunks.length.toString()],
      ];
      await this.redisPipeline(commands);
    },

    async redisPipeline(commands: string[][]) {
      const res = await fetch(this.pipelinePath(proxyUrl), {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          "[Upstash] pipeline failed: " + res.status + " " + body,
        );
      }
      return (await res.json()) as Array<{ result: string | null }>;
    },

    pipelinePath(proxyUrl: string = "") {
      if (!proxyUrl) {
        return config.endpoint + "/pipeline";
      }
      if (!proxyUrl.endsWith("/")) proxyUrl += "/";
      const pathPrefix = "/api/upstash/pipeline";
      try {
        const u = new URL(proxyUrl + pathPrefix);
        u.searchParams.append("endpoint", config.endpoint);
        return u.toString();
      } catch (e) {
        return pathPrefix + "?endpoint=" + config.endpoint;
      }
    },

    headers() {
      return {
        Authorization: `Bearer ${config.apiKey}`,
      };
    },
    path(path: string, proxyUrl: string = "") {
      if (path.startsWith("/")) {
        path = path.slice(1);
      }

      if (!proxyUrl) {
        return config.endpoint + "/" + path;
      }

      if (!proxyUrl.endsWith("/")) proxyUrl += "/";
      const pathPrefix = "/api/upstash/";

      try {
        const u = new URL(proxyUrl + pathPrefix + path);
        u.searchParams.append("endpoint", config.endpoint);
        return u.toString();
      } catch (e) {
        return pathPrefix + path + "?endpoint=" + config.endpoint;
      }
    },
  };
}
