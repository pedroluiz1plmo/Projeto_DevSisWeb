import { Personagem } from '../models/Personagem';
import { Campanha } from '../models/Campanha';
import { NPC } from '../models/NPC';
import { Item } from '../models/Item';
import { MagiaHabilidade } from '../models/MagiaHabilidade';
import { Nota } from '../models/Nota';
import { Missao } from '../models/Missao';
import type { SistemaPasta } from '../models/SistemaPasta';
import type { MonstroPasta } from '../models/MonstroPasta';
import type { ResultadoRolagem } from './DiceService';
import type { UserRole } from '../views/RoleSelectionModal';
import {
  IndexedDbLocalStore,
  type EncryptedLocalRecord,
  type LocalSyncStatus,
  type LocalWorkspaceType,
  type OfflineVaultEnvelope,
} from './IndexedDbLocalStore';
import { OfflineVaultCrypto, type OfflineVaultProfile } from './OfflineVaultCrypto';

type PersistedKind =
  | 'characters'
  | 'campaigns'
  | 'npcs'
  | 'dice_history'
  | 'notes'
  | 'missions'
  | 'system_folders'
  | 'monster_folders'
  | 'record_folders';

const persistedKinds: PersistedKind[] = [
  'characters',
  'campaigns',
  'npcs',
  'dice_history',
  'notes',
  'missions',
  'system_folders',
  'monster_folders',
  'record_folders',
];

const roleToWorkspace = (role: UserRole): LocalWorkspaceType => role === 'jogador' ? 'player' : 'master';
const workspaceToRole = (workspace: LocalWorkspaceType): UserRole => workspace === 'player' ? 'jogador' : 'mestre';
const validRole = (value: string | null): UserRole | null =>
  value === 'jogador' || value === 'mestre' ? value : null;

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

export type OfflineAccount = {
  userId: string;
  name: string;
  username: string;
  email?: string;
};

export class StorageService {
  private static readonly KEY_USER_ROLE = 'rpg_user_role';
  private static activeRole: UserRole = 'jogador';
  private static activeUserId: string | null = null;
  private static dataKey: Uint8Array | null = null;
  private static vault: OfflineVaultEnvelope | null = null;
  private static readonly cache = new Map<PersistedKind, unknown[]>();
  private static readonly LOCAL_VERSION = 1;
  private static readonly legacyRoleKeys = [
    'rpg_personagens_v1',
    'rpg_campanhas_v1',
    'rpg_npcs_v1',
    'rpg_dice_history_v1',
    'rpg_sistema_pastas_v1',
    'rpg_monstro_pastas_v1',
  ];

  public static async initializeOnline(
    profile: OfflineVaultProfile,
    password: string,
  ): Promise<LocalWorkspaceType> {
    if (!profile.userId || !/^\d+$/.test(profile.userId)) {
      throw new Error('A API retornou uma identidade de usuário inválida.');
    }

    const existing = await IndexedDbLocalStore.getVault(profile.userId);
    let envelope: OfflineVaultEnvelope;
    let dataKey: Uint8Array;
    if (existing) {
      dataKey = await OfflineVaultCrypto.unlock(existing, password);
      envelope = {
        ...existing,
        name: profile.name,
        username: profile.username,
        email: profile.email,
        updatedAt: new Date().toISOString(),
      };
      await IndexedDbLocalStore.saveVault(envelope);
    } else {
      const created = await OfflineVaultCrypto.create(profile, password);
      envelope = created.envelope;
      dataKey = created.dataKey;
      await IndexedDbLocalStore.saveVault(envelope);
    }

    const savedRole = validRole(localStorage.getItem(`${this.KEY_USER_ROLE}_${profile.userId}`));
    const workspace = savedRole
      ? roleToWorkspace(savedRole)
      : existing?.lastWorkspace || envelope.lastWorkspace;
    await this.activate(profile.userId, dataKey, envelope, workspace);
    return workspace;
  }

  public static async unlockOffline(userId: string, password: string): Promise<OfflineVaultProfile> {
    const envelope = await IndexedDbLocalStore.getVault(userId);
    if (!envelope) throw new Error('Não há cofre local para essa conta neste dispositivo.');
    const dataKey = await OfflineVaultCrypto.unlock(envelope, password);
    await this.activate(userId, dataKey, envelope, envelope.lastWorkspace);
    return {
      userId: envelope.userId,
      name: envelope.name,
      username: envelope.username,
      email: envelope.email,
      lastWorkspace: envelope.lastWorkspace,
    };
  }

  public static async listOfflineAccounts(): Promise<OfflineAccount[]> {
    const vaults = await IndexedDbLocalStore.listVaults();
    return vaults.map(({ userId, name, username, email }) => ({ userId, name, username, email }));
  }

  private static async activate(
    userId: string,
    dataKey: Uint8Array,
    envelope: OfflineVaultEnvelope,
    workspace: LocalWorkspaceType,
  ): Promise<void> {
    this.lock();
    this.activeUserId = userId;
    this.dataKey = dataKey;
    this.vault = { ...envelope, lastWorkspace: workspace };
    this.activeRole = workspaceToRole(workspace);
    try {
      await this.quarantineUnscopedLegacyData();
      await this.migrateScopedLegacyData();
      await this.loadCache();
    } catch (error) {
      this.lock();
      throw error;
    }
  }

  public static lock(): void {
    this.dataKey?.fill(0);
    this.dataKey = null;
    this.vault = null;
    this.activeUserId = null;
    this.cache.clear();
  }

  public static async clearAccountData(ownerId: string): Promise<void> {
    if (!/^\d+$/.test(ownerId)) {
      throw new Error('Identificador local da conta inválido.');
    }

    let cleanupError: unknown = null;
    try {
      await IndexedDbLocalStore.clearForOwner(ownerId);
    } catch (error) {
      cleanupError = error;
    }
    for (const workspace of ['player', 'master'] as const) {
      const suffix = `_${ownerId}_${workspace}`;
      const accountKeys = [
        ...this.legacyRoleKeys.map((key) => `${key}${suffix}`),
        `rpg_notas_v1${suffix}`,
        `rpg_missoes_v1${suffix}`,
        `rpg_registro_pastas_v1${suffix}`,
        `rpg_notas_exclusoes_v1${suffix}`,
        `rpg_missoes_exclusoes_v1${suffix}`,
      ];
      for (const key of accountKeys) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          cleanupError ??= error;
        }
      }
    }
    try {
      localStorage.removeItem(`${this.KEY_USER_ROLE}_${ownerId}`);
    } catch (error) {
      cleanupError ??= error;
    }
    if (this.activeUserId === ownerId) this.lock();
    if (cleanupError) {
      throw new Error('Não foi possível remover todos os dados locais da conta.', {
        cause: cleanupError,
      });
    }
  }

  public static get activeUser(): OfflineAccount | null {
    if (!this.vault) return null;
    return {
      userId: this.vault.userId,
      name: this.vault.name,
      username: this.vault.username,
      email: this.vault.email,
    };
  }

  public static get isUnlocked(): boolean {
    return Boolean(this.dataKey && this.activeUserId);
  }

  public static async preparePasswordRotation(newPassword: string): Promise<OfflineVaultEnvelope> {
    if (!this.dataKey || !this.vault) throw new Error('Desbloqueie o cofre local antes de trocar a senha.');
    return OfflineVaultCrypto.changePassword(this.vault, this.dataKey, newPassword);
  }

  public static async commitPasswordRotation(envelope: OfflineVaultEnvelope): Promise<void> {
    if (!this.dataKey || envelope.userId !== this.activeUserId) {
      throw new Error('Não foi possível confirmar a troca da senha do cofre local.');
    }
    await IndexedDbLocalStore.saveVault(envelope);
    this.vault = envelope;
  }

  public static async updateVaultProfile(profile: OfflineVaultProfile): Promise<void> {
    if (!this.vault || profile.userId !== this.vault.userId) {
      throw new Error('A conta local ativa não corresponde ao perfil atualizado.');
    }
    const updated = {
      ...this.vault,
      name: profile.name,
      username: profile.username,
      email: profile.email,
      updatedAt: new Date().toISOString(),
    };
    await IndexedDbLocalStore.saveVault(updated);
    this.vault = updated;
  }

  public static async setWorkspace(role: UserRole): Promise<void> {
    if (!this.activeUserId || !this.dataKey || !this.vault) {
      throw new Error('A identidade local precisa estar desbloqueada para trocar de workspace.');
    }
    const workspace = roleToWorkspace(role);
    const updatedVault = { ...this.vault, lastWorkspace: workspace, updatedAt: new Date().toISOString() };
    await IndexedDbLocalStore.saveVault(updatedVault);
    this.activeRole = role;
    this.vault = updatedVault;
    localStorage.setItem(`${this.KEY_USER_ROLE}_${this.activeUserId}`, role);
    await this.migrateScopedLegacyData();
    await this.loadCache();
  }

  public static salvarPerfil(role: UserRole): void {
    this.activeRole = role;
    if (this.activeUserId) localStorage.setItem(`${this.KEY_USER_ROLE}_${this.activeUserId}`, role);
  }

  public static carregarPerfil(): UserRole | null {
    return this.activeUserId
      ? validRole(localStorage.getItem(`${this.KEY_USER_ROLE}_${this.activeUserId}`)) || this.activeRole
      : null;
  }

  public static definirPerfilAtivo(role: UserRole): void {
    this.activeRole = role;
  }

  public static workspaceType(): LocalWorkspaceType {
    return roleToWorkspace(this.activeRole);
  }

  public static definirUsuarioAtivo(userId: string | null): void {
    if (userId !== this.activeUserId) {
      throw new Error('A identidade local só pode ser definida por uma autenticação ou desbloqueio confirmado.');
    }
  }

  public static withWorkspace(init: RequestInit): RequestInit {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    headers['X-Workspace-Type'] = this.workspaceType();
    return { ...init, headers };
  }

  private static requireContext(): { ownerId: string; workspace: LocalWorkspaceType; dataKey: Uint8Array } {
    if (!this.activeUserId || !this.dataKey) {
      throw new Error('Desbloqueie uma conta para acessar o armazenamento local.');
    }
    return {
      ownerId: this.activeUserId,
      workspace: this.workspaceType(),
      dataKey: this.dataKey,
    };
  }

  private static recordId(kind: PersistedKind, value: unknown, index: number): string {
    const row = value as Record<string, unknown>;
    const idFields: Partial<Record<PersistedKind, string[]>> = {
      characters: ['idPersonagem', 'id'],
      campaigns: ['idCampanha', 'id'],
      npcs: ['idNpc', 'id'],
      notes: ['idNota', 'id'],
      missions: ['idMissao', 'id'],
      system_folders: ['id'],
      monster_folders: ['id'],
      record_folders: ['id'],
    };
    for (const field of idFields[kind] || []) {
      const id = row?.[field];
      if (typeof id === 'string' && id) return id;
      if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    }
    return `position:${index}`;
  }

  private static additionalData(
    ownerId: string,
    workspace: LocalWorkspaceType,
    kind: string,
    id: string,
  ): string {
    return `rpg-hub-record-v1:${ownerId}:${workspace}:${kind}:${id}`;
  }

  private static async saveCollection(kind: PersistedKind, rows: unknown[]): Promise<void> {
    const { ownerId, workspace, dataKey } = this.requireContext();
    const records: EncryptedLocalRecord[] = [];
    for (const [position, data] of rows.entries()) {
      const id = this.recordId(kind, data, position);
      const encrypted = await OfflineVaultCrypto.encrypt(
        dataKey,
        data,
        this.additionalData(ownerId, workspace, kind, id),
      );
      const row = data as Record<string, unknown>;
      const status = row?.syncStatus;
      const syncStatus: LocalSyncStatus = (
        status === 'SYNC_PENDING'
        || status === 'SYNCED'
        || status === 'LOCAL_UPDATED'
        || status === 'LOCAL_DELETED'
        || status === 'LOCAL_ONLY'
      ) ? status : 'LOCAL_ONLY';
      records.push({
        ownerId,
        workspaceType: workspace,
        kind,
        id,
        createdAt: String(row?.createdAt ?? row?.dataCriacao ?? new Date().toISOString()),
        updatedAt: new Date().toISOString(),
        localVersion: Number(row?.localVersion ?? this.LOCAL_VERSION),
        syncStatus,
        deletedAt: typeof row?.deletedAt === 'string' ? row.deletedAt : null,
        position,
        ...encrypted,
      });
    }

    await IndexedDbLocalStore.replaceMany(kind, records, ownerId, workspace);
    this.cache.set(kind, rows);
  }

  private static async loadCollection(kind: PersistedKind): Promise<unknown[]> {
    const { ownerId, workspace, dataKey } = this.requireContext();
    const records = await IndexedDbLocalStore.loadMany(kind, ownerId, workspace);
    const rows: unknown[] = [];
    for (const record of records) {
      rows.push(await OfflineVaultCrypto.decrypt(
        dataKey,
        record.iv,
        record.ciphertext,
        this.additionalData(ownerId, workspace, kind, record.id),
      ));
    }
    return rows;
  }

  private static async loadCache(): Promise<void> {
    const entries = await Promise.all(persistedKinds.map(async (kind) => [
      kind,
      await this.loadCollection(kind),
    ] as const));
    this.cache.clear();
    for (const [kind, rows] of entries) this.cache.set(kind, rows);
  }

  private static cached<T>(kind: PersistedKind): T[] {
    this.requireContext();
    return (this.cache.get(kind) || []) as T[];
  }

  private static async quarantineSource(sourceKey: string, raw: string, reason: string): Promise<void> {
    const migration = await IndexedDbLocalStore.getMigrationRecord(sourceKey);
    if (migration?.status === 'complete' || migration?.status === 'quarantined') return;
    await IndexedDbLocalStore.setMigrationRecord({
      sourceKey,
      status: 'pending',
      updatedAt: new Date().toISOString(),
    });
    await IndexedDbLocalStore.quarantine({
      sourceKey,
      sourceType: 'localStorage',
      reason,
      raw,
      capturedAt: new Date().toISOString(),
    });
    await IndexedDbLocalStore.setMigrationRecord({
      sourceKey,
      status: 'quarantined',
      updatedAt: new Date().toISOString(),
    });
  }

  private static async quarantineUnscopedLegacyData(): Promise<void> {
    const keys = new Set<string>([...this.legacyRoleKeys, 'rpg_notas_v1', 'rpg_missoes_v1', this.KEY_USER_ROLE]);
    for (const base of [...this.legacyRoleKeys, 'rpg_notas_v1', 'rpg_missoes_v1']) {
      keys.add(`${base}_jogador`);
      keys.add(`${base}_mestre`);
      keys.add(`${base}_legacy_jogador`);
      keys.add(`${base}_legacy_mestre`);
    }
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        await this.quarantineSource(
          `localStorage:${key}`,
          raw,
          'A origem não identifica de forma confiável a conta proprietária; requer classificação manual.',
        );
      }
    }
  }

  private static async migrateScopedLegacyData(): Promise<void> {
    const { ownerId } = this.requireContext();
    const suffix = `${ownerId}_${this.activeRole}`;
    const sources: Array<{ key: string; kind: PersistedKind; convert: (rows: unknown[]) => unknown[] }> = [
      {
        key: `rpg_notas_v1_${suffix}`,
        kind: 'notes',
        convert: (rows) => rows.map((row) => {
          const note = row as Record<string, unknown>;
          return new Nota(
            String(note.titulo ?? ''),
            String(note.conteudo ?? ''),
            String(note.dataCriacao ?? ''),
            String(note.idNota ?? ''),
            typeof note.backendId === 'string' ? note.backendId : null,
            typeof note.pastaId === 'string' ? note.pastaId : null,
            typeof note.campanhaId === 'string' ? note.campanhaId : null,
            Boolean(note.pendingSync),
          );
        }),
      },
      {
        key: `rpg_missoes_v1_${suffix}`,
        kind: 'missions',
        convert: (rows) => rows.map((row) => {
          const mission = row as Record<string, unknown>;
          return new Missao(
            String(mission.titulo ?? ''),
            String(mission.descricao ?? ''),
            String(mission.recompensa ?? ''),
            mission.status === 'concluida' ? 'concluida' : 'em_progresso',
            String(mission.dataCriacao ?? ''),
            String(mission.idMissao ?? ''),
            typeof mission.backendId === 'string' ? mission.backendId : null,
            typeof mission.pastaId === 'string' ? mission.pastaId : null,
            typeof mission.campanhaId === 'string' ? mission.campanhaId : null,
            Boolean(mission.pendingSync),
          );
        }),
      },
      {
        key: `rpg_registro_pastas_v1_${suffix}`,
        kind: 'record_folders',
        convert: (rows) => rows,
      },
    ];

    for (const source of sources) {
      const raw = localStorage.getItem(source.key);
      if (raw === null) continue;
      const sourceKey = `localStorage:${source.key}`;
      const migration = await IndexedDbLocalStore.getMigrationRecord(sourceKey);
      if (migration?.status === 'complete') {
        localStorage.removeItem(source.key);
        continue;
      }
      if (migration?.status === 'quarantined') continue;

      try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('O conteúdo legado não é uma lista.');
        const existing = await this.loadCollection(source.kind);
        if (existing.length > 0) {
          await this.quarantineSource(
            sourceKey,
            raw,
            'Já existem registros criptografados neste workspace; a fonte antiga não foi usada para evitar sobrescrita.',
          );
          continue;
        }

        await IndexedDbLocalStore.setMigrationRecord({
          sourceKey,
          status: 'pending',
          updatedAt: new Date().toISOString(),
        });
        const rows = source.convert(parsed);
        await this.saveCollection(source.kind, rows);
        const restored = await this.loadCollection(source.kind);
        if (stableJson(restored) !== stableJson(rows)) {
          throw new Error('A verificação de leitura após a migração não corresponde à origem.');
        }
        await IndexedDbLocalStore.setMigrationRecord({
          sourceKey,
          status: 'complete',
          updatedAt: new Date().toISOString(),
        });
        localStorage.removeItem(source.key);
      } catch (error) {
        console.error(`Falha ao migrar ${source.key}; a origem foi preservada.`, error);
        throw new Error(`Não foi possível migrar dados locais de ${source.key}. A cópia antiga foi mantida.`);
      }
    }
  }

  public static salvarPersonagens(personagens: Personagem[]): Promise<void> {
    return this.saveCollection('characters', personagens);
  }

  public static carregarPersonagens(): Personagem[] {
    return this.cached<Record<string, any>>('characters').map((p) => {
      const personagem = new Personagem(
        p.nomePersonagem,
        p.classe,
        p.raca,
        p.sistema || 'D&D 5e',
        p.atributos,
        p.nivel,
        p.idPersonagem,
      );
      personagem.backendId = p.backendId;
      personagem.backendIdsByWorkspace = p.backendIdsByWorkspace;
      personagem.pontosVida = p.pontosVida ?? personagem.pontosVidaMax;
      personagem.pontosVidaMax = p.pontosVidaMax ?? personagem.pontosVidaMax;
      personagem.pontosMana = p.pontosMana ?? 10;
      personagem.pontosManaMax = p.pontosManaMax ?? 10;
      personagem.ca = p.ca ?? 10;
      personagem.XP = p.XP ?? 0;
      if (p.inventario && Array.isArray(p.inventario.itens)) {
        personagem.inventario.itens = p.inventario.itens.map(
          (item: any) => new Item(item.nomeItem, item.pesoItem, item.quantidade, item.idItem),
        );
        personagem.inventario.limiteCarga = p.inventario.limiteCarga
          || Math.max(30, personagem.atributos.forca * 7);
      }
      if (Array.isArray(p.magiasHabilidades)) {
        personagem.magiasHabilidades = p.magiasHabilidades.map(
          (magic: any) => new MagiaHabilidade(magic.nome, magic.custoMana, magic.tempoConjuracao, magic.efeito, magic.id),
        );
      }
      return personagem;
    }).filter((personagem) => !/valerius\s+vento-prateado/i.test(personagem.nomePersonagem));
  }

  public static salvarCampanhas(campanhas: Campanha[]): Promise<void> {
    return this.saveCollection('campaigns', campanhas);
  }

  public static carregarCampanhas(todosPersonagens: Personagem[], todosNpcs: NPC[]): Campanha[] {
    return this.cached<Record<string, any>>('campaigns').map((campaign) => {
      const characters = todosPersonagens.filter((personagem) =>
        campaign.personagens?.some((entry: any) => entry.idPersonagem === personagem.idPersonagem));
      const npcs = todosNpcs.filter((npc) =>
        campaign.npcs?.some((entry: any) => entry.idNpc === npc.idNpc));
      const result = new Campanha(
        campaign.nomeCampanha,
        campaign.lore,
        campaign.dataCriacao,
        characters,
        npcs,
        campaign.idCampanha,
        campaign.fichas || [],
        campaign.monstros || [],
      );
      result.backendId = campaign.backendId;
      result.ownerId = campaign.ownerId;
      return result;
    });
  }

  public static salvarNPCs(npcs: NPC[]): Promise<void> {
    return this.saveCollection('npcs', npcs);
  }

  public static carregarNPCs(): NPC[] {
    return this.cached<Record<string, any>>('npcs').map((row) => {
      const npc = new NPC(row.nome, row.nivelDesafio, row.vidaMax || row.vida, row.ataques, row.idNpc);
      npc.vida = row.vida ?? npc.vidaMax;
      return npc;
    });
  }

  public static salvarHistoricoDados(historico: ResultadoRolagem[]): Promise<void> {
    return this.saveCollection('dice_history', historico.slice(0, 30));
  }

  public static carregarHistoricoDados(): ResultadoRolagem[] {
    return this.cached<ResultadoRolagem>('dice_history');
  }

  public static salvarNotas(notas: Nota[]): Promise<void> {
    return this.saveCollection('notes', notas);
  }

  public static carregarNotas(): Nota[] {
    return this.cached<Record<string, any>>('notes').map((note) => new Nota(
      note.titulo,
      note.conteudo,
      note.dataCriacao,
      note.idNota,
      note.backendId ?? null,
      note.pastaId ?? null,
      note.campanhaId ?? null,
      Boolean(note.pendingSync),
    ));
  }

  public static salvarMissoes(missoes: Missao[]): Promise<void> {
    return this.saveCollection('missions', missoes);
  }

  public static carregarMissoes(): Missao[] {
    return this.cached<Record<string, any>>('missions').map((mission) => new Missao(
      mission.titulo,
      mission.descricao,
      mission.recompensa,
      mission.status,
      mission.dataCriacao,
      mission.idMissao,
      mission.backendId ?? null,
      mission.pastaId ?? null,
      mission.campanhaId ?? null,
      Boolean(mission.pendingSync),
    ));
  }

  private static scopedKey(key: string): string {
    const { ownerId } = this.requireContext();
    return `${key}_${ownerId}_${this.activeRole}`;
  }

  public static carregarExclusoesPendentes(tipo: 'notas' | 'missoes'): string[] {
    const key = this.scopedKey(`rpg_${tipo}_exclusoes_v1`);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
      throw new Error(`A fila local de exclusões de ${tipo} está inválida.`);
    }
    return [...new Set(parsed as string[])];
  }

  public static salvarExclusoesPendentes(tipo: 'notas' | 'missoes', ids: string[]): void {
    localStorage.setItem(this.scopedKey(`rpg_${tipo}_exclusoes_v1`), JSON.stringify([...new Set(ids)]));
  }

  public static salvarPastasDeRegistros(pastas: Array<{
    id: string;
    ownerId: string;
    parentId: string | null;
    name: string;
    createdAt: string;
    updatedAt: string;
  }>): Promise<void> {
    return this.saveCollection('record_folders', pastas);
  }

  public static carregarPastasDeRegistros(): Array<{
    id: string;
    ownerId: string;
    parentId: string | null;
    name: string;
    createdAt: string;
    updatedAt: string;
  }> {
    return this.cached<Record<string, unknown>>('record_folders').filter((folder) =>
      typeof folder.id === 'string'
      && typeof folder.ownerId === 'string'
      && (typeof folder.parentId === 'string' || folder.parentId === null)
      && typeof folder.name === 'string'
      && typeof folder.createdAt === 'string'
      && typeof folder.updatedAt === 'string',
    ) as Array<{
      id: string;
      ownerId: string;
      parentId: string | null;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }

  public static salvarSistemaPastas(itens: SistemaPasta[]): Promise<void> {
    return this.saveCollection('system_folders', itens);
  }

  public static carregarSistemaPastas(): SistemaPasta[] {
    return this.cached<Partial<SistemaPasta>>('system_folders').filter((item) =>
      typeof item.id === 'string'
      && typeof item.nome === 'string'
      && (item.tipo === 'pasta' || item.tipo === 'ficha')
      && typeof item.sistema === 'string'
      && typeof item.descricao === 'string'
      && (typeof item.parentId === 'string' || item.parentId === null)
      && typeof item.dataCriacao === 'string'
      && (item.dados === undefined || typeof item.dados === 'object'),
    ) as SistemaPasta[];
  }

  public static salvarMonstroPastas(itens: MonstroPasta[]): Promise<void> {
    return this.saveCollection('monster_folders', itens);
  }

  public static carregarMonstroPastas(): MonstroPasta[] {
    return this.cached<MonstroPasta>('monster_folders');
  }
}
