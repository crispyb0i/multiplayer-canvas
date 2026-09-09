export type PendingUpdate = {
  id: number;
  update: Uint8Array;
};

export type LocalSyncState = {
  version: 1;
  document: Uint8Array;
  pending: PendingUpdate[];
};

export type OfflinePersistence = {
  load(): Promise<LocalSyncState | null>;
  persist(document: Uint8Array, update?: Uint8Array): Promise<number | null>;
  acknowledge(id: number): Promise<void>;
  clear(): Promise<void>;
};

const DATABASE_NAME = "multiplayer-canvas-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "documents";

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

// IndexedDB is deliberately kept behind this small adapter. The editor and
// collaboration client can be tested with an in-memory implementation without
// coupling their synchronization logic to browser APIs.
export function createIndexedDbPersistence(
  organizationId: string,
  documentId: string,
): OfflinePersistence {
  const key = `${organizationId}:${documentId}`;

  function openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is unavailable"));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB failed to open"));
    });
  }

  async function transaction<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore, complete: (value: T) => void) => void,
  ): Promise<T> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let value: T;
      operation(store, (result) => {
        value = result;
      });
      transaction.oncomplete = () => {
        database.close();
        resolve(value!);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
      };
    });
  }

  return {
    async load() {
      return transaction<LocalSyncState | null>(
        "readonly",
        (store, complete) => {
          const request = store.get(key);
          request.onsuccess = () => {
            const record = request.result as LocalSyncState | undefined;
            if (
              !record ||
              record.version !== 1 ||
              !(record.document instanceof Uint8Array)
            ) {
              complete(null);
              return;
            }
            complete({
              version: 1,
              document: cloneBytes(record.document),
              pending: Array.isArray(record.pending)
                ? record.pending.map((entry) => ({
                    id: entry.id,
                    update: cloneBytes(entry.update),
                  }))
                : [],
            });
          };
          request.onerror = () => complete(null);
        },
      );
    },
    async persist(document, update) {
      return transaction<number | null>("readwrite", (store, complete) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const previous = request.result as LocalSyncState | undefined;
          const pending = previous?.pending ? [...previous.pending] : [];
          const id = update ? (pending.at(-1)?.id ?? 0) + 1 : null;
          if (update && id !== null)
            pending.push({ id, update: cloneBytes(update) });
          store.put(
            { version: 1, document: cloneBytes(document), pending },
            key,
          );
          complete(id);
        };
      });
    },
    async acknowledge(id) {
      await transaction<void>("readwrite", (store, complete) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const previous = request.result as LocalSyncState | undefined;
          if (previous) {
            store.put(
              {
                ...previous,
                pending: previous.pending.filter((entry) => entry.id !== id),
              },
              key,
            );
          }
          complete(undefined);
        };
      });
    },
    async clear() {
      await transaction<void>("readwrite", (store, complete) => {
        store.delete(key);
        complete(undefined);
      });
    },
  };
}
