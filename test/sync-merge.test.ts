import {
  getLocalAppState,
  mergeAppState,
  mergeWithUpdate,
  omitUnsyncedFields,
  AppState,
} from "../app/utils/sync";
import { StoreKey } from "../app/constant";

describe("mergeWithUpdate", () => {
  test("applies remote state onto local when remote is newer", () => {
    const localState = { lastUpdateTime: 1, theme: "light", fontSize: 14 };
    const remoteState = { lastUpdateTime: 2, theme: "dark", fontSize: 16 };

    const merged = mergeWithUpdate(localState, remoteState);

    expect(merged).toBe(localState); // mutated in place
    expect(localState.theme).toBe("dark");
    expect(localState.fontSize).toBe(16);
  });

  test("keeps local state untouched when local is newer", () => {
    const localState = { lastUpdateTime: 2, theme: "light" };
    const remoteState = { lastUpdateTime: 1, theme: "dark" };

    const merged = mergeWithUpdate(localState, remoteState);

    expect(merged).toBe(localState);
    expect(localState.theme).toBe("light");
  });

  test("remote wins when neither side has a timestamp", () => {
    const localState = { theme: "light" } as any;
    const remoteState = { theme: "dark" } as any;

    mergeWithUpdate(localState, remoteState);

    expect(localState.theme).toBe("dark");
  });
});

describe("omitUnsyncedFields", () => {
  test("strips derived fields from config and access state", () => {
    const config = omitUnsyncedFields(StoreKey.Config, {
      models: [{ name: "gpt-4o" }],
      customModels: "my-model",
      theme: "dark",
      _hasHydrated: true,
    } as any) as any;
    expect(config.models).toBeUndefined();
    expect(config._hasHydrated).toBeUndefined();
    expect(config.customModels).toBe("my-model"); // user-set, stays
    expect(config.theme).toBe("dark");

    const access = omitUnsyncedFields(StoreKey.Access, {
      customModels: "server-model",
      defaultModel: "gpt-4o",
      visionModels: "",
      needCode: true,
      openaiApiKey: "sk-test",
      lastUpdateTime: 42,
    } as any) as any;
    expect(access.customModels).toBeUndefined();
    expect(access.defaultModel).toBeUndefined();
    expect(access.visionModels).toBeUndefined();
    expect(access.needCode).toBeUndefined();
    expect(access.openaiApiKey).toBe("sk-test"); // user-set, stays
    expect(access.lastUpdateTime).toBe(42); // needed by mergeWithUpdate
  });

  test("does not mutate the input state", () => {
    const state = { models: [], theme: "dark" } as any;
    omitUnsyncedFields(StoreKey.Config, state);
    expect(state.models).toEqual([]);
  });
});

describe("mergeAppState", () => {
  const makeAppState = (): AppState =>
    ({
      [StoreKey.Chat]: { sessions: [], lastUpdateTime: 0 },
      [StoreKey.Access]: { lastUpdateTime: 0 },
      [StoreKey.Config]: { lastUpdateTime: 0 },
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    }) as any;

  test("a newer stale remote blob cannot reinject models/server config", () => {
    const localState = makeAppState() as any;
    localState[StoreKey.Config] = {
      lastUpdateTime: 100,
      models: [{ name: "gpt-5.4" }, { name: "gpt-4o" }],
      theme: "light",
    };
    localState[StoreKey.Access] = {
      lastUpdateTime: 100,
      customModels: "server-model",
      defaultModel: "gpt-5.4",
    };

    // remote blob written by an older client build: newer timestamp,
    // stale model table, empty server config
    const remoteState = makeAppState() as any;
    remoteState[StoreKey.Config] = {
      lastUpdateTime: 200,
      models: [{ name: "gpt-4o" }],
      theme: "dark",
    };
    remoteState[StoreKey.Access] = {
      lastUpdateTime: 200,
      customModels: "",
      defaultModel: "",
    };

    const merged = mergeAppState(localState, remoteState) as any;

    // derived fields dropped entirely, so setState leaves store values alone
    expect(merged[StoreKey.Config].models).toBeUndefined();
    expect(merged[StoreKey.Access].customModels).toBeUndefined();
    expect(merged[StoreKey.Access].defaultModel).toBeUndefined();
    // legitimate newer remote settings still apply
    expect(merged[StoreKey.Config].theme).toBe("dark");
  });

  test("older remote blob does not clobber newer local settings", () => {
    const localState = makeAppState() as any;
    localState[StoreKey.Config] = { lastUpdateTime: 200, theme: "light" };
    const remoteState = makeAppState() as any;
    remoteState[StoreKey.Config] = { lastUpdateTime: 100, theme: "dark" };

    const merged = mergeAppState(localState, remoteState) as any;

    expect(merged[StoreKey.Config].theme).toBe("light");
  });

  test("survives a partial blob missing whole stores", () => {
    const localState = makeAppState() as any;
    localState[StoreKey.Config] = { lastUpdateTime: 100, theme: "light" };
    const remoteState = {
      [StoreKey.Config]: { lastUpdateTime: 200, theme: "dark" },
    } as any;

    const merged = mergeAppState(localState, remoteState) as any;

    expect(merged[StoreKey.Config].theme).toBe("dark");
    expect(merged[StoreKey.Chat].sessions).toEqual([]);
  });

  test("still merges sessions, masks and prompts", () => {
    const localState = makeAppState() as any;
    const remoteState = makeAppState() as any;
    remoteState[StoreKey.Chat].sessions = [
      {
        id: "remote-session",
        messages: [{ id: "m1", date: "2024-01-01" }],
        lastUpdate: 1,
      },
    ];
    remoteState[StoreKey.Mask].masks = { m1: { id: "m1" } };
    remoteState[StoreKey.Prompt].prompts = { p1: { id: "p1" } };

    const merged = mergeAppState(localState, remoteState) as any;

    expect(merged[StoreKey.Chat].sessions.map((s: any) => s.id)).toContain(
      "remote-session",
    );
    expect(merged[StoreKey.Mask].masks.m1).toBeDefined();
    expect(merged[StoreKey.Prompt].prompts.p1).toBeDefined();
  });
});

describe("getLocalAppState", () => {
  test("sync payload contains no derived model/server-config fields", () => {
    const appState = getLocalAppState() as any;

    expect(appState[StoreKey.Config].models).toBeUndefined();
    for (const field of [
      "customModels",
      "defaultModel",
      "visionModels",
      "needCode",
      "hideUserApiKey",
      "hideBalanceQuery",
      "disableGPT4",
      "disableFastLink",
    ]) {
      expect(appState[StoreKey.Access][field]).toBeUndefined();
    }
    for (const key of Object.keys(appState)) {
      expect(appState[key]._hasHydrated).toBeUndefined();
    }
  });
});
