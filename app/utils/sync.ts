import {
  ChatSession,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import { useMaskStore } from "../store/mask";
import { usePromptStore } from "../store/prompt";
import { StoreKey } from "../constant";
import { merge } from "./merge";

type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];
type NonFunctionFields<T> = Pick<T, NonFunctionKeys<T>>;

export function getNonFunctionFileds<T extends object>(obj: T) {
  const ret: any = {};

  Object.entries(obj).map(([k, v]) => {
    if (typeof v !== "function") {
      ret[k] = v;
    }
  });

  return ret as NonFunctionFields<T>;
}

export type GetStoreState<T> = T extends { getState: () => infer U }
  ? NonFunctionFields<U>
  : never;

// fields that must never be synced: they are derived from code defaults
// or fetched from /api/config on each page load, so syncing them lets a
// stale remote blob erase newer built-in/server-provided models
const UNSYNCED_FIELDS: Partial<Record<StoreKey, string[]>> = {
  [StoreKey.Config]: ["models"],
  [StoreKey.Access]: [
    // DANGER_CONFIG keys served by /api/config
    "needCode",
    "hideUserApiKey",
    "hideBalanceQuery",
    "disableGPT4",
    "disableFastLink",
    "customModels",
    "defaultModel",
    "visionModels",
  ],
};

export function omitUnsyncedFields<T extends object>(
  key: StoreKey,
  state: T,
): T {
  const ret: any = { ...state };
  for (const field of UNSYNCED_FIELDS[key] ?? []) {
    delete ret[field];
  }
  // persist-middleware metadata, not user data
  delete ret._hasHydrated;
  return ret as T;
}

const LocalStateSetters = {
  [StoreKey.Chat]: useChatStore.setState,
  [StoreKey.Access]: useAccessStore.setState,
  [StoreKey.Config]: useAppConfig.setState,
  [StoreKey.Mask]: useMaskStore.setState,
  [StoreKey.Prompt]: usePromptStore.setState,
} as const;

const LocalStateGetters = {
  [StoreKey.Chat]: () =>
    omitUnsyncedFields(
      StoreKey.Chat,
      getNonFunctionFileds(useChatStore.getState()),
    ),
  [StoreKey.Access]: () =>
    omitUnsyncedFields(
      StoreKey.Access,
      getNonFunctionFileds(useAccessStore.getState()),
    ),
  [StoreKey.Config]: () =>
    omitUnsyncedFields(
      StoreKey.Config,
      getNonFunctionFileds(useAppConfig.getState()),
    ),
  [StoreKey.Mask]: () =>
    omitUnsyncedFields(
      StoreKey.Mask,
      getNonFunctionFileds(useMaskStore.getState()),
    ),
  [StoreKey.Prompt]: () =>
    omitUnsyncedFields(
      StoreKey.Prompt,
      getNonFunctionFileds(usePromptStore.getState()),
    ),
} as const;

export type AppState = {
  [k in keyof typeof LocalStateGetters]: ReturnType<
    (typeof LocalStateGetters)[k]
  >;
};

type Merger<T extends keyof AppState, U = AppState[T]> = (
  localState: U,
  remoteState: U,
) => U;

type StateMerger = {
  [K in keyof AppState]: Merger<K>;
};

// we merge remote state to local state
const MergeStates: StateMerger = {
  [StoreKey.Chat]: (localState, remoteState) => {
    // merge tombstones — union, keep later timestamp per ID, prune after 30 days
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const localTombstones: Record<string, number> =
      (localState as any).deletedSessionIds ?? {};
    const remoteTombstones: Record<string, number> =
      (remoteState as any).deletedSessionIds ?? {};
    const mergedTombstones: Record<string, number> = { ...remoteTombstones };
    for (const [id, ts] of Object.entries(localTombstones)) {
      mergedTombstones[id] = Math.max(ts, mergedTombstones[id] ?? 0);
    }
    for (const id of Object.keys(mergedTombstones)) {
      if (now - mergedTombstones[id] > THIRTY_DAYS) delete mergedTombstones[id];
    }
    (localState as any).deletedSessionIds = mergedTombstones;

    // remove local sessions that are tombstoned
    localState.sessions = localState.sessions.filter(
      (s) => !mergedTombstones[s.id],
    );

    // merge sessions
    const localSessions: Record<string, ChatSession> = {};
    localState.sessions.forEach((s) => (localSessions[s.id] = s));

    remoteState.sessions.forEach((remoteSession) => {
      // skip empty chats
      if (remoteSession.messages.length === 0) return;
      // skip tombstoned sessions
      if (mergedTombstones[remoteSession.id]) return;

      const localSession = localSessions[remoteSession.id];
      if (!localSession) {
        // if remote session is new, just merge it
        localState.sessions.push(remoteSession);
      } else {
        // if both have the same session id, merge the messages
        const localMessageIds = new Set(localSession.messages.map((v) => v.id));
        remoteSession.messages.forEach((m) => {
          if (!localMessageIds.has(m.id)) {
            localSession.messages.push(m);
          }
        });

        // sort local messages with date field in asc order
        localSession.messages.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
      }
    });

    // sort local sessions with date field in desc order
    localState.sessions.sort(
      (a, b) =>
        new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime(),
    );

    return localState;
  },
  [StoreKey.Prompt]: (localState, remoteState) => {
    localState.prompts = {
      ...remoteState.prompts,
      ...localState.prompts,
    };
    return localState;
  },
  [StoreKey.Mask]: (localState, remoteState) => {
    localState.masks = {
      ...remoteState.masks,
      ...localState.masks,
    };
    return localState;
  },
  [StoreKey.Config]: mergeWithUpdate<AppState[StoreKey.Config]>,
  [StoreKey.Access]: mergeWithUpdate<AppState[StoreKey.Access]>,
};

export function getLocalAppState() {
  const appState = Object.fromEntries(
    Object.entries(LocalStateGetters).map(([key, getter]) => {
      return [key, getter()];
    }),
  ) as AppState;

  return appState;
}

export function setLocalAppState(appState: AppState) {
  Object.entries(LocalStateSetters).forEach(([key, setter]) => {
    setter(appState[key as keyof AppState]);
  });
}

export function mergeAppState(localState: AppState, remoteState: AppState) {
  Object.keys(localState).forEach(<T extends keyof AppState>(k: string) => {
    const key = k as T;
    // strip unsynced fields from both sides so blobs written by older
    // clients cannot reinject stale models/server config into local state
    const localStoreState = omitUnsyncedFields(key, localState[key]);
    const remoteStoreState = remoteState[key]
      ? omitUnsyncedFields(key, remoteState[key])
      : undefined;
    localState[key] = localStoreState;
    if (!remoteStoreState) return;
    MergeStates[key](localStoreState, remoteStoreState);
  });

  return localState;
}

/**
 * Merge state with `lastUpdateTime`, older state will be override
 */
export function mergeWithUpdate<T extends { lastUpdateTime?: number }>(
  localState: T,
  remoteState: T,
) {
  const localUpdateTime = localState.lastUpdateTime ?? 0;
  const remoteUpdateTime = remoteState.lastUpdateTime ?? 1;

  if (localUpdateTime < remoteUpdateTime) {
    // remote is newer: apply remote on top of local, mutating the object
    // that mergeAppState/setLocalAppState actually use
    merge(localState, remoteState);
  }
  // local is newer or equal: keep local as-is
  return localState;
}
