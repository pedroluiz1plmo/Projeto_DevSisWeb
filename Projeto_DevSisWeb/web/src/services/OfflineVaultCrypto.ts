import type { OfflineVaultEnvelope } from './IndexedDbLocalStore';

const keyIterations = 600_000;
const keySaltBytes = 16;
const ivBytes = 12;
const dataKeyBytes = 32;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class OfflineVaultPasswordError extends Error {
  constructor() {
    super('Senha incorreta ou cofre local inválido.');
    this.name = 'OfflineVaultPasswordError';
  }
}

export type OfflineVaultProfile = {
  userId: string;
  name: string;
  username: string;
  email?: string;
  lastWorkspace: 'player' | 'master';
};

export class OfflineVaultCrypto {
  static async create(
    profile: OfflineVaultProfile,
    password: string,
  ): Promise<{ envelope: OfflineVaultEnvelope; dataKey: Uint8Array }> {
    if (!password) throw new Error('A senha da conta é necessária para preparar o cofre local.');
    const salt = crypto.getRandomValues(new Uint8Array(keySaltBytes));
    const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
    const dataKey = crypto.getRandomValues(new Uint8Array(dataKeyBytes));
    const wrappingKey = await this.deriveWrappingKey(password, salt);
    const wrappedDataKey = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(iv),
        additionalData: this.toArrayBuffer(textEncoder.encode(`rpg-hub-offline-v1:${profile.userId}`)),
      },
      wrappingKey,
      this.toArrayBuffer(dataKey),
    );
    const now = new Date().toISOString();
    return {
      dataKey,
      envelope: {
        ...profile,
        kdf: 'PBKDF2-SHA-256',
        iterations: keyIterations,
        salt: this.toBase64(salt),
        cipher: 'AES-GCM-256',
        iv: this.toBase64(iv),
        wrappedDataKey: this.toBase64(new Uint8Array(wrappedDataKey)),
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  static async unlock(
    envelope: OfflineVaultEnvelope,
    password: string,
  ): Promise<Uint8Array> {
    if (!password) throw new OfflineVaultPasswordError();
    if (
      envelope.kdf !== 'PBKDF2-SHA-256'
      || envelope.cipher !== 'AES-GCM-256'
      || envelope.iterations !== keyIterations
    ) {
      throw new Error('O formato criptográfico deste cofre não é compatível.');
    }

    try {
      const wrappingKey = await this.deriveWrappingKey(password, this.fromBase64(envelope.salt));
      const rawKey = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: this.toArrayBuffer(this.fromBase64(envelope.iv)),
          additionalData: this.toArrayBuffer(textEncoder.encode(`rpg-hub-offline-v1:${envelope.userId}`)),
        },
        wrappingKey,
        this.toArrayBuffer(this.fromBase64(envelope.wrappedDataKey)),
      );
      const dataKey = new Uint8Array(rawKey);
      if (dataKey.byteLength !== dataKeyBytes) throw new OfflineVaultPasswordError();
      return dataKey;
    } catch (error) {
      if (error instanceof OfflineVaultPasswordError) throw error;
      if (error instanceof DOMException && error.name === 'OperationError') {
        throw new OfflineVaultPasswordError();
      }
      throw error;
    }
  }

  static async changePassword(
    envelope: OfflineVaultEnvelope,
    dataKey: Uint8Array,
    newPassword: string,
  ): Promise<OfflineVaultEnvelope> {
    if (!newPassword) throw new Error('A nova senha não pode estar vazia.');
    if (dataKey.byteLength !== dataKeyBytes) throw new Error('A chave do cofre local não está disponível.');

    const salt = crypto.getRandomValues(new Uint8Array(keySaltBytes));
    const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
    const wrappingKey = await this.deriveWrappingKey(newPassword, salt);
    const wrappedDataKey = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(iv),
        additionalData: this.toArrayBuffer(textEncoder.encode(`rpg-hub-offline-v1:${envelope.userId}`)),
      },
      wrappingKey,
      this.toArrayBuffer(dataKey),
    );

    return {
      ...envelope,
      iterations: keyIterations,
      salt: this.toBase64(salt),
      iv: this.toBase64(iv),
      wrappedDataKey: this.toBase64(new Uint8Array(wrappedDataKey)),
      updatedAt: new Date().toISOString(),
    };
  }

  static async encrypt(
    dataKey: Uint8Array,
    value: unknown,
    additionalData: string,
  ): Promise<{ iv: string; ciphertext: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
    const key = await this.importDataKey(dataKey);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(iv),
        additionalData: this.toArrayBuffer(textEncoder.encode(additionalData)),
      },
      key,
      this.toArrayBuffer(textEncoder.encode(JSON.stringify(value))),
    );
    return {
      iv: this.toBase64(iv),
      ciphertext: this.toBase64(new Uint8Array(ciphertext)),
    };
  }

  static async decrypt<T>(
    dataKey: Uint8Array,
    iv: string,
    ciphertext: string,
    additionalData: string,
  ): Promise<T> {
    const key = await this.importDataKey(dataKey);
    const cleartext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.toArrayBuffer(this.fromBase64(iv)),
        additionalData: this.toArrayBuffer(textEncoder.encode(additionalData)),
      },
      key,
      this.toArrayBuffer(this.fromBase64(ciphertext)),
    );
    return JSON.parse(textDecoder.decode(cleartext)) as T;
  }

  private static async deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(textEncoder.encode(password)),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: this.toArrayBuffer(salt), iterations: keyIterations },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private static importDataKey(dataKey: Uint8Array): Promise<CryptoKey> {
    if (dataKey.byteLength !== dataKeyBytes) throw new Error('A chave do cofre local é inválida.');
    return crypto.subtle.importKey(
      'raw',
      this.toArrayBuffer(dataKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private static toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  private static fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  private static toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
  }
}
