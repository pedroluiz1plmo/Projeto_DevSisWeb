export type LocalWorkspaceType = 'player' | 'master';

export type LocalSyncStatus =
  | 'LOCAL_ONLY'
  | 'SYNC_PENDING'
  | 'SYNCED'
  | 'LOCAL_UPDATED'
  | 'LOCAL_DELETED';

export type EncryptedLocalRecord = {
  ownerId: string;
  workspaceType: LocalWorkspaceType;
  kind: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  localVersion: number;
  syncStatus: LocalSyncStatus;
  deletedAt: string | null;
  position: number;
  iv: string;
  ciphertext: string;
};

export type OfflineVaultEnvelope = {
  userId: string;
  name: string;
  username: string;
  email?: string;
  lastWorkspace: LocalWorkspaceType;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  cipher: 'AES-GCM-256';
  iv: string;
  wrappedDataKey: string;
  createdAt: string;
  updatedAt: string;
};

export type QuarantinedLocalData = {
  sourceKey: string;
  sourceType: 'localStorage' | 'indexedDB-v1';
  reason: string;
  raw: string;
  capturedAt: string;
};

type MigrationRecord = {
  sourceKey: string;
  status: 'pending' | 'complete' | 'quarantined';
  updatedAt: string;
};

const databaseName = 'rpg_manager_offline_v1';
const databaseVersion = 2;
const encryptedRecordsStore = 'local_records_v2';
const vaultStore = 'offline_vaults';
const quarantineStore = 'legacy_quarantine';
const migrationStore = 'migration_journal';

export class IndexedDbLocalStore {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  static async ready(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(encryptedRecordsStore)) {
          const records = db.createObjectStore(encryptedRecordsStore, {
            keyPath: ['ownerId', 'workspaceType', 'kind', 'id'],
          });
          records.createIndex(
            'owner_workspace_kind',
            ['ownerId', 'workspaceType', 'kind'],
            { unique: false },
          );
        }
        if (!db.objectStoreNames.contains(vaultStore)) {
          db.createObjectStore(vaultStore, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(quarantineStore)) {
          db.createObjectStore(quarantineStore, { keyPath: 'sourceKey' });
        }
        if (!db.objectStoreNames.contains(migrationStore)) {
          db.createObjectStore(migrationStore, { keyPath: 'sourceKey' });
        }

        // Version-1 stores remain intact until their records have been reviewed
        // and any recoverable data has been migrated or quarantined.
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error ?? new Error('Não foi possível abrir o IndexedDB local.'));
      };
      request.onblocked = () => {
        this.dbPromise = null;
        reject(new Error('A atualização do IndexedDB está bloqueada por outra aba aberta.'));
      };
    });

    return this.dbPromise;
  }

  static async replaceMany(
    kind: string,
    rows: EncryptedLocalRecord[],
    ownerId: string,
    workspaceType: LocalWorkspaceType,
  ): Promise<void> {
    const db = await this.ready();
    const transaction = db.transaction(encryptedRecordsStore, 'readwrite');
    const store = transaction.objectStore(encryptedRecordsStore);
    const index = store.index('owner_workspace_kind');
    const request = index.getAll(IDBKeyRange.only([ownerId, workspaceType, kind]));
    const ids = new Set(rows.map((row) => row.id));

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error ?? new Error(`Falha ao persistir registros locais de ${kind}.`),
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error(`A gravação local de ${kind} foi cancelada.`),
      );
      request.onsuccess = () => {
        for (const existing of request.result as EncryptedLocalRecord[]) {
          if (!ids.has(existing.id)) {
            store.delete([ownerId, workspaceType, kind, existing.id]);
          }
        }
        for (const row of rows) {
          if (
            row.ownerId !== ownerId
            || row.workspaceType !== workspaceType
            || row.kind !== kind
          ) {
            transaction.abort();
            return;
          }
          store.put(row);
        }
      };
      request.onerror = () => transaction.abort();
    });
  }

  static async loadMany(
    kind: string,
    ownerId: string,
    workspaceType: LocalWorkspaceType,
  ): Promise<EncryptedLocalRecord[]> {
    const db = await this.ready();
    const request = db.transaction(encryptedRecordsStore, 'readonly')
      .objectStore(encryptedRecordsStore)
      .index('owner_workspace_kind')
      .getAll(IDBKeyRange.only([ownerId, workspaceType, kind]));
    return new Promise<EncryptedLocalRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve(
        (request.result as EncryptedLocalRecord[])
          .filter((record) => !record.deletedAt)
          .sort((left, right) => left.position - right.position),
      );
      request.onerror = () => reject(
        request.error ?? new Error(`Falha ao carregar registros locais de ${kind}.`),
      );
    });
  }

  static async saveVault(envelope: OfflineVaultEnvelope): Promise<void> {
    const db = await this.ready();
    const transaction = db.transaction(vaultStore, 'readwrite');
    transaction.objectStore(vaultStore).put(envelope);
    await this.waitForTransaction(transaction, 'Falha ao salvar o cofre local.');
  }

  static async getVault(userId: string): Promise<OfflineVaultEnvelope | null> {
    const db = await this.ready();
    const request = db.transaction(vaultStore, 'readonly')
      .objectStore(vaultStore)
      .get(userId);
    return new Promise<OfflineVaultEnvelope | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as OfflineVaultEnvelope | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler o cofre local.'));
    });
  }

  static async listVaults(): Promise<OfflineVaultEnvelope[]> {
    const db = await this.ready();
    const request = db.transaction(vaultStore, 'readonly').objectStore(vaultStore).getAll();
    return new Promise<OfflineVaultEnvelope[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as OfflineVaultEnvelope[]);
      request.onerror = () => reject(request.error ?? new Error('Falha ao listar cofres locais.'));
    });
  }

  static async clearForOwner(ownerId: string): Promise<void> {
    const db = await this.ready();
    const transaction = db.transaction(
      [encryptedRecordsStore, vaultStore, migrationStore],
      'readwrite',
    );
    const records = transaction.objectStore(encryptedRecordsStore);
    const recordCursor = records.openCursor();
    recordCursor.onsuccess = () => {
      const cursor = recordCursor.result;
      if (!cursor) return;
      if ((cursor.value as EncryptedLocalRecord).ownerId === ownerId) {
        cursor.delete();
      }
      cursor.continue();
    };

    const migrations = transaction.objectStore(migrationStore);
    const migrationCursor = migrations.openCursor();
    migrationCursor.onsuccess = () => {
      const cursor = migrationCursor.result;
      if (!cursor) return;
      const sourceKey = (cursor.value as MigrationRecord).sourceKey;
      if (
        sourceKey.endsWith(`_${ownerId}_player`)
        || sourceKey.endsWith(`_${ownerId}_master`)
      ) {
        cursor.delete();
      }
      cursor.continue();
    };

    transaction.objectStore(vaultStore).delete(ownerId);
    await this.waitForTransaction(transaction, 'Não foi possível limpar os dados locais da conta.');
  }

  static async quarantine(data: QuarantinedLocalData): Promise<void> {
    const db = await this.ready();
    const transaction = db.transaction(quarantineStore, 'readwrite');
    transaction.objectStore(quarantineStore).put(data);
    await this.waitForTransaction(transaction, 'Falha ao preservar dados legados em quarentena.');
  }

  static async listQuarantine(): Promise<QuarantinedLocalData[]> {
    const db = await this.ready();
    const request = db.transaction(quarantineStore, 'readonly').objectStore(quarantineStore).getAll();
    return new Promise<QuarantinedLocalData[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as QuarantinedLocalData[]);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler dados em quarentena.'));
    });
  }

  static async setMigrationRecord(record: MigrationRecord): Promise<void> {
    const db = await this.ready();
    const transaction = db.transaction(migrationStore, 'readwrite');
    transaction.objectStore(migrationStore).put(record);
    await this.waitForTransaction(transaction, 'Falha ao registrar o progresso da migração.');
  }

  static async getMigrationRecord(sourceKey: string): Promise<MigrationRecord | null> {
    const db = await this.ready();
    const request = db.transaction(migrationStore, 'readonly')
      .objectStore(migrationStore)
      .get(sourceKey);
    return new Promise<MigrationRecord | null>((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as MigrationRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Falha ao ler o progresso da migração.'));
    });
  }

  private static waitForTransaction(transaction: IDBTransaction, message: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error(message));
      transaction.onabort = () => reject(transaction.error ?? new Error(message));
    });
  }
}
