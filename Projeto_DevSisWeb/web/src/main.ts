import './index.css';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import { Personagem } from './models/Personagem';
import { Jogador } from './models/Jogador';
import { Mestre, type CombatenteIniciativa } from './models/Mestre';
import { Campanha } from './models/Campanha';
import { NPC } from './models/NPC';
import { Item } from './models/Item';
import { MagiaHabilidade } from './models/MagiaHabilidade';
import { Nota } from './models/Nota';
import { Missao } from './models/Missao';
import type { SistemaPasta } from './models/SistemaPasta';
import type { MonstroPasta } from './models/MonstroPasta';
import { StorageService } from './services/StorageService';
import { DiceService, type ResultadoRolagem } from './services/DiceService';
import { CharacterService } from './features/characters/services/CharacterService';
import { CampaignService } from './features/campaigns/services/CampaignService';
import { FolderService, type ApiFolder } from './features/folders/services/FolderService';
import {
  NotesMissionService,
  NotesMissionApiError,
  type ApiMission,
  type ApiNote,
  type MissionPayload,
  type NotePayload
} from './features/notes-missions/services/NotesMissionService';
import { SystemService, type RpgSystem } from './features/rpg-systems/services/SystemService';
import { isCharacterSheetSystem, renderCharacterSheet, type CharacterSheetSystem } from './features/rpg-systems/shared/CharacterSheetDom';
import type {
  ApiCampaign,
  ApiCampaignCharacter,
  ApiCampaignInviteInfo,
  ApiCampaignInvitePreview,
  ApiCampaignJoinRequest,
  ApiCampaignMember,
  ApiMasterDashboard,
  ApiCampaignUser,
  ApiCampaignUserInvitation
} from './shared/types/campaignApi';

import { DashboardView } from './views/DashboardView';
import { MestreDashboardView } from './views/MestreDashboardView';
import { JogadorView } from './views/JogadorView';
import { MestreView } from './views/MestreView';
import { CampaignJoinView } from './views/CampaignJoinView';
import { RoleSelectionModal, type UserRole } from './views/RoleSelectionModal';
import { SidebarView } from './components/SidebarView';
import { MonstroView } from './features/monsters/views/MonstroView';
import { AdminConsoleView } from './features/admin/views/AdminConsoleView';
import { AdminService, type AdminIdentity } from './features/admin/services/AdminService';
import { MyPlanView } from './features/plans/views/MyPlanView';
import { FriendshipService } from './features/friendships/services/FriendshipService';
import { FriendshipsView } from './features/friendships/views/FriendshipsView';
import type {
  ApiFriend,
  ApiFriendshipData,
  ApiFriendshipSearchResult
} from './features/friendships/types';

new SidebarView();

type AuthenticatedUser = {
  id: number;
  name: string;
  username: string;
  email?: string;
  avatarUrl?: string;
};

const formHasChanges = (form: HTMLFormElement): boolean =>
  Array.from(form.elements).some(element => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value.trim() !== element.defaultValue.trim();
    }
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options).some(option => option.selected !== option.defaultSelected);
    }
    return false;
  });

class AppController {
  private authToken: string | null = null;
  private authenticatedUser: AuthenticatedUser | null = null;
  private isOfflineSession = false;
  private networkOnline = navigator.onLine;
  private pendingOnlineSession: { user: AuthenticatedUser; token: string } | null = null;
  private revalidationInProgress = false;
  private adminIdentity: AdminIdentity | null = null;
  private backendSystems: RpgSystem[] = [];
  private personagens: Personagem[] = [];
  private campanhas: Campanha[] = [];
  private npcs: NPC[] = [];
  private historicoDados: ResultadoRolagem[] = [];
  private notas: Nota[] = [];
  private missoes: Missao[] = [];
  private apiFolders: ApiFolder[] = [];
  private notaEmEdicaoId: string | null = null;
  private missaoEmEdicaoId: string | null = null;
  private campanhaEmEdicaoId: string | null = null;
  private campaignApiAvailable = false;
  private openCampaignDetails = new Set<string>();
  private campaignMembers: Record<string, ApiCampaignMember[]> = {};
  private campaignCharacters: Record<string, ApiCampaignCharacter[]> = {};
  private campaignDetailsLoading = new Set<string>();
  private campaignInviteStatuses: Record<string, ApiCampaignInviteInfo | null> = {};
  private campaignInviteCodes: Record<string, string> = {};
  private campaignInviteQrCodes: Record<string, string> = {};
  private campaignJoinRequests: Record<string, ApiCampaignJoinRequest[]> = {};
  private campaignUserInvitations: Record<string, ApiCampaignUserInvitation[]> = {};
  private masterDashboard: ApiMasterDashboard | null = null;
  private masterDashboardLoading = false;
  private masterDashboardError: string | null = null;
  private masterDashboardAttempted = false;
  private campaignSearchResults: Record<string, ApiCampaignUser> = {};
  private friendshipData: ApiFriendshipData | null = null;
  private friendshipFriends: ApiFriend[] = [];
  private friendshipSearchResults: ApiFriendshipSearchResult[] = [];
  private friendshipSearchTerm = '';
  private friendshipLoading = false;
  private friendshipError: string | null = null;
  private friendshipMessage: string | null = null;
  private playerCampaignInvitations: ApiCampaignUserInvitation[] = [];
  private playerCampaignRequests: ApiCampaignJoinRequest[] = [];
  private playerCampaignAccessLoading = false;
  private playerInvitePreview: ApiCampaignInvitePreview | null = null;
  private playerInviteCode = '';
  private playerInviteRequestSent = false;
  private playerQrScanner: Html5QrcodeType | null = null;
  private sistemaItens: SistemaPasta[] = [];
  private folderApiAvailable = false;
  private monstroItens: MonstroPasta[] = [];

  private jogador!: Jogador;
  private mestre!: Mestre;

  private personagemAtivoId: string | null = null;
  private pastaSistemaAtualId: string | null = null;
  private fichaSistemaEmEdicaoId: string | null = null;
  private criandoFichaSistema = false;
  private criandoFichaGuiada = false;
  private fichaRolagemSelecionadaId: string | null = null;
  private fichaInventarioSelecionadaId: string | null = null;
  private sistemaFichaEmCriacao: string | null = null;
  private pastaMonstroAtualId: string | null = null;
  private monstroEmEdicaoId: string | null = null;
  private criandoMonstro = false;
  private currentTab: string = 'dashboard';
  private userRole: UserRole | null = null;
  private wizardStep: number = 1;
  private privateAreaInitialized = false;

  constructor() {
    this.initEventListeners();
    this.initAuthGateway();
    void this.restoreAuthenticatedSession();
  }

  /** Carrega dados e views internas somente depois que uma sessão foi autenticada. */
  private async initializePrivateArea(): Promise<void> {
    if (this.privateAreaInitialized) return;
    if (!StorageService.isUnlocked) throw new Error('O cofre local precisa estar desbloqueado.');
    try {
      this.userRole = StorageService.carregarPerfil() || 'jogador';
      StorageService.definirPerfilAtivo(this.userRole);

      this.personagens = StorageService.carregarPersonagens();
      if (this.authToken && this.networkOnline) {
        try {
          const apiChars = await CharacterService.listar(this.authToken);
          const merged = [...this.personagens];
          for (const apiCharacter of apiChars) {
            const existing = merged.find((character) => character.backendId === apiCharacter.id);
            if (existing) continue;
            const data = apiCharacter.data as any;
            const character = new Personagem(
              apiCharacter.name,
              data.classe || '',
              data.raca || '',
              apiCharacter.system.name,
              data.atributos,
              data.nivel,
              data.idPersonagem,
            );
            Object.assign(character, data);
            character.backendId = apiCharacter.id;
            merged.push(character);
          }
          this.personagens = merged;
          await StorageService.salvarPersonagens(this.personagens);
        } catch (error) {
          console.warn('Falha ao listar personagens; os dados locais foram mantidos.', error);
        }
      }

      this.npcs = StorageService.carregarNPCs();
      this.campanhas = StorageService.carregarCampanhas(this.personagens, this.npcs);
      await this.carregarCampanhasBackend();
      this.historicoDados = StorageService.carregarHistoricoDados();
      this.notas = StorageService.carregarNotas();
      this.missoes = StorageService.carregarMissoes();
      this.sistemaItens = StorageService.carregarSistemaPastas();
      await this.carregarPastasBackend();
      this.monstroItens = StorageService.carregarMonstroPastas();
      await this.sincronizarNotasMissoes();
      this.jogador = new Jogador('user-jog-1', 'Jogador Aventureiro', 'jogador@unemat.br', this.personagens);
      this.mestre = new Mestre('user-mestre-1', 'Mestre dos Magos', 'mestre@unemat.br', this.campanhas, this.npcs);
      this.personagemAtivoId = this.personagens[0]?.idPersonagem || null;
      if (this.userRole) this.currentTab = this.userRole === 'jogador' ? 'sistemas' : 'dashboard';
      this.updateCharacterSelector();
      this.applyRoleView();
      this.privateAreaInitialized = true;
      this.updateStorageStatus();
    } catch (error) {
      this.privateAreaInitialized = false;
      this.setStorageError(error);
      throw error;
    }
  }

  private updateStorageStatus(message?: string): void {
    const status = document.getElementById('storage-status');
    const label = document.getElementById('storage-status-message');
    if (!status || !label || !StorageService.isUnlocked) return;

    status.classList.toggle('is-offline', !this.networkOnline || this.isOfflineSession);
    status.classList.toggle('is-error', Boolean(message));
    label.textContent = message || (
      this.authToken && this.networkOnline
        ? 'Conectado · armazenamento local criptografado'
        : 'Acesso local · os dados ficam neste dispositivo; sincronização completa ainda não está disponível'
    );
  }

  private setStorageError(error: unknown): void {
    console.error('Falha ao inicializar ou gravar o armazenamento local.', error);
    this.updateStorageStatus('Não foi possível salvar os dados locais. Verifique o espaço disponível e tente novamente.');
    this.showToast(error instanceof Error ? error.message : 'Falha ao acessar o armazenamento local.', 'falha');
  }

  private persistStorage(operation: Promise<void>): void {
    void operation.catch((error: unknown) => this.setStorageError(error));
  }

  private async revalidateRemoteSession(): Promise<void> {
    if (this.revalidationInProgress) return;
    const token = sessionStorage.getItem('rpgHubAuthToken');
    if (!token) {
      this.authToken = null;
      this.isOfflineSession = StorageService.isUnlocked;
      this.networkOnline = navigator.onLine;
      this.updateStorageStatus();
      return;
    }

    this.revalidationInProgress = true;
    this.networkOnline = navigator.onLine;
    try {
      const response = await fetch('http://localhost:3000/api/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('rpgHubAuthToken');
        if (this.authToken === token) this.authToken = null;
        this.isOfflineSession = StorageService.isUnlocked;
        this.updateStorageStatus();
        return;
      }
      if (!response.ok) throw new Error(`Não foi possível validar a sessão (${response.status}).`);

      const data = await response.json();
      if (!data.authenticated || !data.user) {
        sessionStorage.removeItem('rpgHubAuthToken');
        if (this.authToken === token) this.authToken = null;
        this.isOfflineSession = StorageService.isUnlocked;
        this.updateStorageStatus();
        return;
      }

      if (!this.authenticatedUser) {
        this.pendingOnlineSession = { user: data.user, token };
        await this.openOfflineUnlockForm();
        return;
      }

      if (String(data.user.id) !== String(this.authenticatedUser.id)) return;
      this.authToken = token;
      this.authenticatedUser = data.user;
      this.isOfflineSession = false;
      this.pendingOnlineSession = null;
      this.renderAuthenticatedUser();
      this.updateStorageStatus();
      await this.loadAdminIdentity(token);
      await this.sincronizarNotasMissoes();
    } catch (error) {
      this.authToken = null;
      this.isOfflineSession = StorageService.isUnlocked;
      this.networkOnline = navigator.onLine;
      this.updateStorageStatus();
      console.warn('A sessão remota não pôde ser validada; o cofre local permanece disponível.', error);
    } finally {
      this.revalidationInProgress = false;
    }
  }

  private async carregarCampanhasBackend(): Promise<void> {
    if (!this.authToken) return;
    try {
      const apiCampaigns = await CampaignService.listar(this.authToken);
      this.campaignApiAvailable = true;
      const remoteIds = new Set(apiCampaigns.map(campaign => campaign.id));
      const localOnly = this.campanhas.filter(campaign =>
        !campaign.backendId && !remoteIds.has(campaign.idCampanha)
      );
      const remoteCampaigns = apiCampaigns.map(campaign => {
        const local = this.campanhas.find(item =>
          item.backendId === campaign.id || item.idCampanha === campaign.id
        );
        return this.converterCampanha(campaign, local);
      });
      this.campanhas = [...remoteCampaigns, ...localOnly];
      await StorageService.salvarCampanhas(this.campanhas);
    } catch (error) {
      this.campaignApiAvailable = false;
      console.warn('Falha ao listar campanhas do backend; os dados locais serão usados.', error);
    }
  }

  private converterCampanha(campaign: ApiCampaign, local?: Campanha): Campanha {
    const result = new Campanha(
      local?.nomeCampanha || campaign.name,
      local?.lore || campaign.description || '',
      campaign.createdAt,
      local?.personagens || [],
      local?.npcs || [],
      campaign.id,
      local?.fichas || [],
      local?.monstros || []
    );
    result.backendId = campaign.id;
    result.ownerId = campaign.ownerId;
    return result;
  }

  private async carregarDetalhesCampanha(campaignId: string): Promise<void> {
    if (!this.authToken) return;
    this.openCampaignDetails.add(campaignId);
    this.campaignDetailsLoading.add(campaignId);
    if (this.currentTab === 'campanhas') this.renderCurrentView();
    try {
      const campaign = this.campanhas.find(item => item.backendId === campaignId);
      const [members, characters] = await Promise.all([
        CampaignService.listarMembros(campaignId, this.authToken),
        CampaignService.listarPersonagens(campaignId, this.authToken)
      ]);
      this.campaignMembers[campaignId] = members;
      this.campaignCharacters[campaignId] = characters;
      if (campaign?.ownerId === String(this.authenticatedUser?.id || '')) {
        const [inviteStatus, joinRequests, userInvitations] = await Promise.all([
          CampaignService.statusConvite(campaignId, this.authToken),
          CampaignService.listarSolicitacoes(campaignId, this.authToken),
          CampaignService.listarConvitesEnviados(campaignId, this.authToken)
        ]);
        this.campaignInviteStatuses[campaignId] = inviteStatus;
        this.campaignJoinRequests[campaignId] = joinRequests;
        this.campaignUserInvitations[campaignId] = userInvitations;
        try {
          this.friendshipFriends = (await FriendshipService.list(this.authToken)).friends;
        } catch (error) {
          this.friendshipFriends = [];
          this.showToast(error instanceof Error
            ? error.message
            : 'Não foi possível carregar a lista de amigos.');
        }
      }
      if (campaign) {
        campaign.personagens = characters
          .map(character => this.personagens.find(personagem => personagem.backendId === character.id))
          .filter((personagem): personagem is Personagem => Boolean(personagem));
      }

      await StorageService.salvarCampanhas(this.campanhas);
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Não foi possível carregar os detalhes da campanha.');
    } finally {
      this.campaignDetailsLoading.delete(campaignId);
      if (this.currentTab === 'campanhas') this.renderCurrentView();
    }
  }

  private async carregarPastasBackend(): Promise<void> {
    if (!this.authToken) return;
    try {
      const apiFolders = await FolderService.listar(this.authToken);
      const localFolders = this.sistemaItens.filter(item => item.tipo === 'pasta');
      const apiIds = new Set(apiFolders.map(folder => folder.id));
      const localById = new Map(localFolders.map(folder => [folder.id, folder]));
      const remoteItems = apiFolders.map(folder => this.converterPasta(folder, localById));
      const localOnlyFolders = localFolders.filter(folder =>
        !apiIds.has(folder.id) && !/^\d+$/.test(folder.id)
      );
      const availableFolderIds = new Set([...apiIds, ...localOnlyFolders.map(folder => folder.id)]);
      const sheets = this.sistemaItens
        .filter(item => item.tipo === 'ficha')
        .map(item => ({
          ...item,
          parentId: item.parentId && availableFolderIds.has(item.parentId) ? item.parentId : null
        }));
      this.sistemaItens = [...remoteItems, ...localOnlyFolders, ...sheets];
      if (this.pastaSistemaAtualId && !availableFolderIds.has(this.pastaSistemaAtualId)) {
        this.pastaSistemaAtualId = null;
      }
      this.folderApiAvailable = true;
      this.apiFolders = apiFolders;
      await StorageService.salvarPastasDeRegistros(apiFolders);
      await StorageService.salvarSistemaPastas(this.sistemaItens);
    } catch (error) {
      this.folderApiAvailable = false;
      this.apiFolders = StorageService.carregarPastasDeRegistros();
      console.warn('Falha ao listar pastas do backend; os dados locais serão usados.', error);
    }
  }

  private notaDeApi(nota: ApiNote): Nota {
    return new Nota(
      nota.title,
      nota.content,
      nota.createdAt,
      nota.clientId,
      nota.id,
      nota.folderId,
      nota.campaignId
    );
  }

  private missaoDeApi(missao: ApiMission): Missao {
    return new Missao(
      missao.title,
      missao.description,
      missao.reward,
      missao.status,
      missao.createdAt,
      missao.clientId,
      missao.id,
      missao.folderId,
      missao.campaignId
    );
  }

  private payloadNota(nota: Nota): NotePayload {
    return {
      clientId: nota.idNota,
      folderId: nota.pastaId,
      campaignId: nota.campanhaId,
      title: nota.titulo,
      content: nota.conteudo
    };
  }

  private payloadMissao(missao: Missao): MissionPayload {
    return {
      clientId: missao.idMissao,
      folderId: missao.pastaId,
      campaignId: missao.campanhaId,
      title: missao.titulo,
      description: missao.descricao,
      reward: missao.recompensa,
      status: missao.status
    };
  }

  private async sincronizarNotasMissoes(): Promise<void> {
    if (!this.authToken) return;
    try {
      const exclusoesNotas = StorageService.carregarExclusoesPendentes('notas');
      for (const id of exclusoesNotas) {
        try {
          await NotesMissionService.excluirNota(id, this.authToken);
        } catch (error) {
          if (!(error instanceof NotesMissionApiError && error.statusCode === 404)) throw error;
        }
      }
      StorageService.salvarExclusoesPendentes('notas', []);

      const exclusoesMissoes = StorageService.carregarExclusoesPendentes('missoes');
      for (const id of exclusoesMissoes) {
        try {
          await NotesMissionService.excluirMissao(id, this.authToken);
        } catch (error) {
          if (!(error instanceof NotesMissionApiError && error.statusCode === 404)) throw error;
        }
      }
      StorageService.salvarExclusoesPendentes('missoes', []);

      const [notasRemotas, missoesRemotas] = await Promise.all([
        NotesMissionService.listarNotas(this.authToken),
        NotesMissionService.listarMissoes(this.authToken)
      ]);
      const notasPorId = new Map(notasRemotas.map(nota => [nota.clientId, nota]));
      const missoesPorId = new Map(missoesRemotas.map(missao => [missao.clientId, missao]));

      for (const nota of this.notas.filter(item => item.pendingSync)) {
        const remote = notasPorId.get(nota.idNota);
        const saved = await NotesMissionService.salvarNota(
          this.payloadNota(nota),
          this.authToken,
          remote?.id || nota.backendId || undefined
        );
        notasPorId.set(saved.clientId, saved);
      }
      for (const missao of this.missoes.filter(item => item.pendingSync)) {
        const remote = missoesPorId.get(missao.idMissao);
        const saved = await NotesMissionService.salvarMissao(
          this.payloadMissao(missao),
          this.authToken,
          remote?.id || missao.backendId || undefined
        );
        missoesPorId.set(saved.clientId, saved);
      }

      this.notas = [...notasPorId.values()].map(nota => this.notaDeApi(nota));
      this.missoes = [...missoesPorId.values()].map(missao => this.missaoDeApi(missao));
      await StorageService.salvarNotas(this.notas);
      await StorageService.salvarMissoes(this.missoes);
      this.renderNotas();
      this.renderMissoes();
    } catch (error) {
      console.warn('Falha ao sincronizar notas e missões; os dados locais foram preservados.', error);
    }
  }

  private async salvarNotaLocal(nota: Nota): Promise<boolean> {
    const previous = [...this.notas];
    const index = this.notas.findIndex(item => item.idNota === nota.idNota);
    if (index >= 0) this.notas[index] = nota;
    else this.notas.unshift(nota);
    try {
      await StorageService.salvarNotas(this.notas);
    } catch (error) {
      this.notas = previous;
      this.setStorageError(error);
      this.renderNotas();
      return false;
    }

    if (this.authToken) {
      let saved: ApiNote;
      try {
        saved = await NotesMissionService.salvarNota(
          this.payloadNota(nota),
          this.authToken,
          nota.backendId || undefined
        );
      } catch (error) {
        console.warn('Nota mantida localmente; a sincronização será tentada novamente.', error);
        this.showToast('Nota salva localmente. Será sincronizada quando a conexão voltar.', 'falha');
        this.renderNotas();
        return true;
      }

      const synced = this.notaDeApi(saved);
      const currentIndex = this.notas.findIndex(item => item.idNota === synced.idNota);
      if (currentIndex >= 0) this.notas[currentIndex] = synced;
      try {
        await StorageService.salvarNotas(this.notas);
      } catch (error) {
        this.setStorageError(error);
      }
    }
    this.renderNotas();
    return true;
  }

  private async salvarMissaoLocal(missao: Missao): Promise<boolean> {
    const previous = [...this.missoes];
    const index = this.missoes.findIndex(item => item.idMissao === missao.idMissao);
    if (index >= 0) this.missoes[index] = missao;
    else this.missoes.unshift(missao);
    try {
      await StorageService.salvarMissoes(this.missoes);
    } catch (error) {
      this.missoes = previous;
      this.setStorageError(error);
      this.renderMissoes();
      return false;
    }

    if (this.authToken) {
      let saved: ApiMission;
      try {
        saved = await NotesMissionService.salvarMissao(
          this.payloadMissao(missao),
          this.authToken,
          missao.backendId || undefined
        );
      } catch (error) {
        console.warn('Missão mantida localmente; a sincronização será tentada novamente.', error);
        this.showToast('Missão salva localmente. Será sincronizada quando a conexão voltar.', 'falha');
        this.renderMissoes();
        return true;
      }

      const synced = this.missaoDeApi(saved);
      const currentIndex = this.missoes.findIndex(item => item.idMissao === synced.idMissao);
      if (currentIndex >= 0) this.missoes[currentIndex] = synced;
      try {
        await StorageService.salvarMissoes(this.missoes);
      } catch (error) {
        this.setStorageError(error);
      }
    }
    this.renderMissoes();
    return true;
  }

  private async excluirNota(nota: Nota): Promise<void> {
    const previous = [...this.notas];
    this.notas = this.notas.filter(item => item.idNota !== nota.idNota);
    try {
      await StorageService.salvarNotas(this.notas);
    } catch (error) {
      this.notas = previous;
      this.setStorageError(error);
      this.renderNotas();
      return;
    }
    let aguardandoSincronizacao = false;
    if (nota.backendId && !this.authToken) {
      try {
        const pending = StorageService.carregarExclusoesPendentes('notas');
        StorageService.salvarExclusoesPendentes('notas', [...pending, nota.backendId]);
      } catch (error) {
        this.notas = previous;
        try { await StorageService.salvarNotas(this.notas); } catch (restoreError) { this.setStorageError(restoreError); }
        this.setStorageError(error);
        this.renderNotas();
        return;
      }
      aguardandoSincronizacao = true;
    } else if (this.authToken && nota.backendId) {
      try {
        await NotesMissionService.excluirNota(nota.backendId, this.authToken);
      } catch (error) {
        if (!(error instanceof NotesMissionApiError && error.statusCode === 404)) {
          aguardandoSincronizacao = true;
          console.warn('Exclusão de nota pendente de sincronização.', error);
          try {
            const pending = StorageService.carregarExclusoesPendentes('notas');
            StorageService.salvarExclusoesPendentes('notas', [...pending, nota.backendId]);
          } catch (queueError) {
            this.notas = previous;
            try { await StorageService.salvarNotas(this.notas); } catch (restoreError) { this.setStorageError(restoreError); }
            this.setStorageError(queueError);
            this.renderNotas();
            return;
          }
        }
      }
    }
    this.renderNotas();
    this.showToast(aguardandoSincronizacao
      ? 'Nota removida localmente. A exclusão será sincronizada quando a conexão voltar.'
      : `Nota "${nota.titulo}" removida.`);
  }

  private async excluirMissao(missao: Missao): Promise<void> {
    const previous = [...this.missoes];
    this.missoes = this.missoes.filter(item => item.idMissao !== missao.idMissao);
    try {
      await StorageService.salvarMissoes(this.missoes);
    } catch (error) {
      this.missoes = previous;
      this.setStorageError(error);
      this.renderMissoes();
      return;
    }
    let aguardandoSincronizacao = false;
    if (missao.backendId && !this.authToken) {
      try {
        const pending = StorageService.carregarExclusoesPendentes('missoes');
        StorageService.salvarExclusoesPendentes('missoes', [...pending, missao.backendId]);
      } catch (error) {
        this.missoes = previous;
        try { await StorageService.salvarMissoes(this.missoes); } catch (restoreError) { this.setStorageError(restoreError); }
        this.setStorageError(error);
        this.renderMissoes();
        return;
      }
      aguardandoSincronizacao = true;
    } else if (this.authToken && missao.backendId) {
      try {
        await NotesMissionService.excluirMissao(missao.backendId, this.authToken);
      } catch (error) {
        if (!(error instanceof NotesMissionApiError && error.statusCode === 404)) {
          aguardandoSincronizacao = true;
          console.warn('Exclusão de missão pendente de sincronização.', error);
          try {
            const pending = StorageService.carregarExclusoesPendentes('missoes');
            StorageService.salvarExclusoesPendentes('missoes', [...pending, missao.backendId]);
          } catch (queueError) {
            this.missoes = previous;
            try { await StorageService.salvarMissoes(this.missoes); } catch (restoreError) { this.setStorageError(restoreError); }
            this.setStorageError(queueError);
            this.renderMissoes();
            return;
          }
        }
      }
    }
    this.renderMissoes();
    this.showToast(aguardandoSincronizacao
      ? 'Missão removida localmente. A exclusão será sincronizada quando a conexão voltar.'
      : `Missão "${missao.titulo}" excluída.`);
  }

  private converterPasta(
    folder: ApiFolder,
    localFolders: Map<string, SistemaPasta>
  ): SistemaPasta {
    const local = localFolders.get(folder.id);
    return {
      id: folder.id,
      nome: folder.name,
      tipo: 'pasta',
      sistema: local?.sistema || 'Personalizado',
      descricao: local?.descricao || '',
      parentId: folder.parentId,
      dataCriacao: local?.dataCriacao || new Date(folder.createdAt).toLocaleDateString('pt-BR')
    };
  }

  /** Remove referências aos dados da área autenticada ao encerrar a sessão. */
  private clearPrivateArea(): void {
    void this.stopPlayerQrScanner();
    this.privateAreaInitialized = false;
    this.personagens = [];
    this.campanhas = [];
    this.npcs = [];
    this.historicoDados = [];
    this.notas = [];
    this.missoes = [];
    this.sistemaItens = [];
    this.folderApiAvailable = false;
    this.monstroItens = [];
    this.campaignApiAvailable = false;
    this.openCampaignDetails.clear();
    this.campaignMembers = {};
    this.campaignCharacters = {};
    this.campaignDetailsLoading.clear();
    this.campaignInviteStatuses = {};
    this.campaignInviteCodes = {};
    this.campaignInviteQrCodes = {};
    this.campaignJoinRequests = {};
    this.campaignUserInvitations = {};
    this.friendshipData = null;
    this.friendshipFriends = [];
    this.friendshipSearchResults = [];
    this.friendshipSearchTerm = '';
    this.friendshipLoading = false;
    this.friendshipError = null;
    this.friendshipMessage = null;
    this.masterDashboard = null;
    this.masterDashboardLoading = false;
    this.masterDashboardError = null;
    this.masterDashboardAttempted = false;
    this.campaignSearchResults = {};
    this.playerCampaignInvitations = [];
    this.playerCampaignRequests = [];
    this.playerCampaignAccessLoading = false;
    this.playerInvitePreview = null;
    this.playerInviteCode = '';
    this.playerInviteRequestSent = false;
    this.personagemAtivoId = null;
    this.pastaSistemaAtualId = null;
    this.fichaRolagemSelecionadaId = null;
    document.getElementById('content-area')?.replaceChildren();
  }

  private initAuthGateway(): void {
    const gateway = document.getElementById('auth-gateway');
    const screens = document.querySelectorAll<HTMLElement>('.auth-screen');
    const formCard = document.getElementById('auth-form-card');
    const showScreen = (id: string) => {
      screens.forEach(screen => screen.classList.toggle('hidden', screen.id !== id));
      formCard?.classList.toggle('hidden', id === 'auth-welcome');
      document.getElementById('public-user-dropdown')?.classList.add('hidden');
      document.getElementById('btn-public-user')?.setAttribute('aria-expanded', 'false');
    };
    const showError = (id: string, message: string) => {
      const error = document.getElementById(id);
      if (error) { error.textContent = message; error.classList.remove('hidden'); }
    };
    const enterApp = () => {
      document.getElementById('app')?.classList.remove('hidden');
      gateway?.classList.add('hidden');
    };
    const authFetch = (path: string, body: unknown) => fetch(`http://localhost:3000/api${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    document.getElementById('btn-auth-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-auth-register')?.addEventListener('click', () => showScreen('auth-register-form'));
    document.getElementById('btn-public-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-public-register')?.addEventListener('click', () => showScreen('auth-register-form'));
    document.getElementById('btn-public-hero-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-public-hero-register')?.addEventListener('click', () => showScreen('auth-register-form'));
    document.getElementById('btn-login-register')?.addEventListener('click', () => showScreen('auth-register-form'));
    document.getElementById('btn-register-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-login-offline')?.addEventListener('click', () => {
      void this.openOfflineUnlockForm();
    });
    document.getElementById('btn-forgot-password')?.addEventListener('click', () => {
      const email = document.getElementById('auth-login-identifier') as HTMLInputElement | null;
      const recoveryEmail = document.getElementById('auth-recovery-email') as HTMLInputElement | null;
      if (recoveryEmail && email?.value.includes('@')) recoveryEmail.value = email.value.trim();
      showScreen('auth-recovery-request-form');
    });
    document.getElementById('btn-recovery-request-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-recovery-request-cancel')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-recovery-reset-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-recovery-complete-login')?.addEventListener('click', () => showScreen('auth-login-form'));
    document.getElementById('btn-recovery-resend')?.addEventListener('click', () => {
      const email = document.getElementById('auth-recovery-reset-email') as HTMLInputElement | null;
      const recoveryEmail = document.getElementById('auth-recovery-email') as HTMLInputElement | null;
      if (email && recoveryEmail) recoveryEmail.value = email.value;
      showScreen('auth-recovery-request-form');
    });
    document.querySelectorAll('.btn-auth-back').forEach(button => button.addEventListener('click', () => showScreen('auth-welcome')));
    document.getElementById('btn-public-user')?.addEventListener('click', event => {
      event.stopPropagation();
      const dropdown = document.getElementById('public-user-dropdown');
      const isOpen = dropdown?.classList.contains('hidden');
      dropdown?.classList.toggle('hidden', !isOpen);
      (event.currentTarget as HTMLButtonElement).setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', event => {
      if (!(event.target as Element).closest('#public-user-menu')) {
        document.getElementById('public-user-dropdown')?.classList.add('hidden');
        document.getElementById('btn-public-user')?.setAttribute('aria-expanded', 'false');
      }
    });

    document.getElementById('auth-recovery-request-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      if (!form.reportValidity()) return;
      const email = (document.getElementById('auth-recovery-email') as HTMLInputElement).value.trim();
      const errorElement = document.getElementById('auth-recovery-request-error');
      const submit = document.getElementById('btn-request-password-recovery') as HTMLButtonElement | null;
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
      }
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Enviando...';
      }
      try {
        const response = await authFetch('/auth/password-recovery', { email });
        const data = await response.json() as { success?: boolean; message?: string };
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Não foi possível solicitar a recuperação de senha.');
        }
        (document.getElementById('auth-recovery-reset-email') as HTMLInputElement).value = email;
        (document.getElementById('auth-recovery-token') as HTMLInputElement).value = '';
        (document.getElementById('auth-recovery-new-password') as HTMLInputElement).value = '';
        (document.getElementById('auth-recovery-confirm-password') as HTMLInputElement).value = '';
        showScreen('auth-recovery-reset-form');
      } catch (error) {
        if (errorElement) {
          errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível solicitar a recuperação. Tente novamente.';
          errorElement.classList.remove('hidden');
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Enviar instruções';
        }
      }
    });

    document.getElementById('auth-recovery-reset-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      if (!form.reportValidity()) return;
      const email = (document.getElementById('auth-recovery-reset-email') as HTMLInputElement).value.trim();
      const token = (document.getElementById('auth-recovery-token') as HTMLInputElement).value.trim();
      const newPassword = (document.getElementById('auth-recovery-new-password') as HTMLInputElement).value;
      const confirmation = (document.getElementById('auth-recovery-confirm-password') as HTMLInputElement).value;
      const errorElement = document.getElementById('auth-recovery-reset-error');
      const submit = document.getElementById('btn-reset-password') as HTMLButtonElement | null;
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.add('hidden');
      }
      if (newPassword !== confirmation) {
        if (errorElement) {
          errorElement.textContent = 'A confirmação da nova senha não coincide.';
          errorElement.classList.remove('hidden');
        }
        return;
      }
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Redefinindo...';
      }
      try {
        const response = await authFetch('/auth/password-recovery/confirm', {
          email,
          token,
          newPassword,
        });
        const data = await response.json() as { success?: boolean; message?: string };
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Não foi possível redefinir a senha.');
        }
        showScreen('auth-recovery-complete');
      } catch (error) {
        if (errorElement) {
          errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível redefinir a senha. Confira o código e tente novamente.';
          errorElement.classList.remove('hidden');
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Redefinir senha';
        }
      }
    });

    document.getElementById('auth-login-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const identifier = (document.getElementById('auth-login-identifier') as HTMLInputElement).value.trim();
      const password = (document.getElementById('auth-login-password') as HTMLInputElement).value;
      try {
        const response = await authFetch('/auth/login', { identifier, password });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message);
        await this.setAuthenticatedUser(data.user, data.token, password);
        enterApp();
        this.showToast(`Bem-vindo, ${data.user.username}!`);
      } catch (error) {
        showError('auth-login-error', error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.');
      }
    });

    document.getElementById('auth-register-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const password = (document.getElementById('auth-register-password') as HTMLInputElement).value;
      const confirmation = (document.getElementById('auth-register-confirm') as HTMLInputElement).value;
      if (password !== confirmation) return showError('auth-register-error', 'As senhas não coincidem.');
      const body = {
        name: (document.getElementById('auth-register-name') as HTMLInputElement).value.trim(),
        username: (document.getElementById('auth-register-username') as HTMLInputElement).value.trim(),
        email: (document.getElementById('auth-register-email') as HTMLInputElement).value.trim(), password,
      };
      try {
        const response = await authFetch('/auth/register', body);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message);
        await this.setAuthenticatedUser(data.user, data.token, password);
        enterApp();
        this.showToast(`Conta criada. Bem-vindo, ${data.user.username}!`);
      } catch (error) {
        showError('auth-register-error', error instanceof Error ? error.message : 'Não foi possível criar a conta. Tente novamente.');
      }
    });

    document.getElementById('auth-offline-form')?.addEventListener('submit', (event) => {
      void this.unlockOfflineAccount(event);
    });
  }

  private async setAuthenticatedUser(user: AuthenticatedUser, token: string, password: string): Promise<void> {
    await StorageService.initializeOnline({
      userId: String(user.id),
      name: user.name,
      username: user.username,
      email: user.email,
      lastWorkspace: 'player',
    }, password);
    this.authToken = token;
    this.authenticatedUser = user;
    this.isOfflineSession = false;
    this.userRole = StorageService.carregarPerfil() || 'jogador';
    StorageService.definirPerfilAtivo(this.userRole);
    sessionStorage.setItem('rpgHubAuthToken', token);
    await this.initializePrivateArea();
    void this.carregarSistemasBackend();
    void this.loadAdminIdentity(token);
    this.renderAuthenticatedUser();
  }

  private async openOfflineUnlockForm(): Promise<void> {
    const error = document.getElementById('auth-offline-error');
    const select = document.getElementById('auth-offline-account') as HTMLSelectElement | null;
    if (!select) return;
    if (error) {
      error.classList.add('hidden');
      error.textContent = '';
    }

    try {
      const accounts = await StorageService.listOfflineAccounts();
      const allowedAccounts = this.pendingOnlineSession
        ? accounts.filter((account) => account.userId === String(this.pendingOnlineSession?.user.id))
        : accounts;
      select.replaceChildren();
      for (const account of allowedAccounts) {
        const option = document.createElement('option');
        option.value = account.userId;
        option.textContent = `${account.name} (@${account.username})`;
        select.append(option);
      }
      if (!allowedAccounts.length) {
        throw new Error(this.pendingOnlineSession
          ? 'Esta conta ainda não tem um cofre local. Entre novamente com sua senha para prepará-lo.'
          : 'Nenhuma conta com cofre local foi encontrada neste dispositivo.');
      }
      select.disabled = allowedAccounts.length === 1;
      if (this.pendingOnlineSession) select.value = String(this.pendingOnlineSession.user.id);
      this.showAuthScreen('auth-offline-form');
    } catch (caught) {
      this.showAuthScreen('auth-offline-form');
      if (error) {
        error.textContent = caught instanceof Error ? caught.message : 'Não foi possível abrir os cofres locais.';
        error.classList.remove('hidden');
      }
    }
  }

  private async unlockOfflineAccount(event: Event): Promise<void> {
    event.preventDefault();
    const accountSelect = document.getElementById('auth-offline-account') as HTMLSelectElement | null;
    const passwordInput = document.getElementById('auth-offline-password') as HTMLInputElement | null;
    const error = document.getElementById('auth-offline-error');
    const submit = document.getElementById('btn-offline-unlock') as HTMLButtonElement | null;
    const userId = accountSelect?.value || '';
    const password = passwordInput?.value || '';
    if (!userId || !password) {
      if (error) {
        error.textContent = 'Selecione uma conta e informe a senha usada para preparar o cofre local.';
        error.classList.remove('hidden');
      }
      return;
    }

    try {
      if (error) error.classList.add('hidden');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Desbloqueando…';
      }//////////////////////////////////
      const profile = await StorageService.unlockOffline(userId, password);
      console.log('[DEBUG COFRE]', {
  userIdSelecionado: userId,
  userIdCofre: profile.userId,
  tipo: typeof profile.userId,
  conversaoNumerica: Number(profile.userId),
  nome: profile.name,
  username: profile.username,
});

      const pending = this.pendingOnlineSession;
      if (pending && profile.userId !== String(pending.user.id)) {
        StorageService.lock();
        throw new Error('O cofre local não corresponde à conta autenticada pelo servidor.');
      }
      const user = pending?.user
  ? {
      ...pending.user,
      id: Number(pending.user.id),
    }
  : {
      id: Number(profile.userId),
      name: profile.name,
      username: profile.username,
      email: profile.email,
    };
      console.log('[DEBUG IDENTIDADE FINAL]', {
  pendingExiste: Boolean(pending),
  pendingUserId: pending?.user?.id,
  pendingUserIdTipo: typeof pending?.user?.id,
  userIdFinal: user.id,
  userIdFinalTipo: typeof user.id,
  idValido: Number.isSafeInteger(user.id),
});
      if (!Number.isSafeInteger(user.id)) {
        StorageService.lock();
        throw new Error('A identidade local não possui um identificador válido.');
      }

      this.authToken = pending && this.networkOnline ? pending.token : null;
      this.authenticatedUser = user;
      this.isOfflineSession = !this.authToken;
      this.userRole = StorageService.carregarPerfil() || 'jogador';
      StorageService.definirPerfilAtivo(this.userRole);
      this.pendingOnlineSession = null;
      await this.initializePrivateArea();
      if (pending) {
        sessionStorage.setItem('rpgHubAuthToken', pending.token);
      }
      if (this.authToken) {
        await this.loadAdminIdentity(this.authToken);
      } else {
        this.adminIdentity = null;
        this.applyAdminNavigation();
      }
      this.renderAuthenticatedUser();
      document.getElementById('app')?.classList.remove('hidden');
      document.getElementById('auth-gateway')?.classList.add('hidden');
      this.updateStorageStatus();
      if (passwordInput) passwordInput.value = '';
    } catch (caught) {
      StorageService.lock();
      if (error) {
        error.textContent = caught instanceof Error ? caught.message : 'Não foi possível desbloquear os dados locais.';
        error.classList.remove('hidden');
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Desbloquear dados locais';
      }
    }
  }

  private showAuthScreen(screenId: string): void {
    document.querySelectorAll<HTMLElement>('.auth-screen').forEach((screen) => {
      screen.classList.toggle('hidden', screen.id !== screenId);
    });
    document.getElementById('auth-form-card')?.classList.remove('hidden');
    document.getElementById('public-user-dropdown')?.classList.add('hidden');
  }

  private async loadAdminIdentity(token: string): Promise<void> {
    try {
      this.adminIdentity = await AdminService.identity(token);
      this.applyAdminNavigation();
    } catch (error) {
      if (error instanceof Error && error.name === 'AdminApiError' && 'status' in error && error.status === 403) {
        this.adminIdentity = null;
        this.applyAdminNavigation();
        return;
      }
      this.adminIdentity = null;
      this.applyAdminNavigation();
      console.error('Falha ao carregar as permissões administrativas.', error);
    }
  }

  /** Carrega o catálogo remoto sem substituir o armazenamento local nesta etapa. */
  private async carregarSistemasBackend(): Promise<void> {
    try {
      this.backendSystems = await SystemService.listar();
    } catch (error) {
      console.warn('Catálogo remoto de sistemas indisponível; a aplicação seguirá usando os dados locais.', error);
    }
  }

  private obterSistemaBackend(nomeSistema: string): RpgSystem | undefined {
    const normalizado = nomeSistema.toLocaleLowerCase();
    return this.backendSystems.find(sistema =>
      sistema.name.toLocaleLowerCase() === normalizado ||
      (normalizado.includes('d&d') && sistema.slug === 'dungeons-and-dragons')
    );
  }

  private async persistirPersonagens(personagem?: Personagem): Promise<void> {
    try {
      await StorageService.salvarPersonagens(this.personagens);
    } catch (error) {
      this.setStorageError(error);
      return;
    }
    if (this.authToken && personagem && personagem.backendId) {
      const sistema = this.obterSistemaBackend(personagem.sistema);
      if (sistema) {
        try {
          const data = JSON.parse(JSON.stringify(personagem)) as Record<string, unknown>;
          delete data.backendId;
          await CharacterService.atualizar(personagem.backendId, { name: personagem.nomePersonagem, systemId: sistema.id, data }, this.authToken);
        } catch (error) {
          console.warn('Falha ao sincronizar personagem:', error);
        }
      }
    }
  }

  /** Replica a criação local no backend quando o catálogo e a sessão estiverem disponíveis. */
  private async criarPersonagemNoBackend(personagem: Personagem): Promise<void> {
    if (!this.authToken) return;
    const sistema = this.obterSistemaBackend(personagem.sistema);
    if (!sistema) return;
    try {
      const data = JSON.parse(JSON.stringify(personagem)) as Record<string, unknown>;
      delete data.backendId;
      const remoto = await CharacterService.criar({ name: personagem.nomePersonagem, systemId: sistema.id, data }, this.authToken);
      personagem.backendId = remoto.id;
      await StorageService.salvarPersonagens(this.personagens);
    } catch (error) {
      console.warn('Não foi possível sincronizar o personagem recém-criado; a cópia local foi preservada.', error);
    }
  }

  private async excluirPersonagemNoBackend(backendId?: string): Promise<void> {
    if (!this.authToken || !backendId) return;
    try {
      await CharacterService.excluir(backendId, this.authToken);
    } catch (error) {
      console.warn('Não foi possível excluir a cópia remota; a cópia local já foi removida.', error);
    }
  }

  private async restoreAuthenticatedSession(): Promise<void> {
    const token = sessionStorage.getItem('rpgHubAuthToken');
    if (!token || !this.networkOnline) return;

    try {
      const response = await fetch('http://localhost:3000/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('rpgHubAuthToken');
        return;
      }
      if (!response.ok) throw new Error(`Não foi possível validar a sessão (${response.status}).`);
      const data = await response.json();
      if (!data.authenticated || !data.user) {
        sessionStorage.removeItem('rpgHubAuthToken');
        return;
      }
      this.pendingOnlineSession = { user: data.user, token };
      await this.openOfflineUnlockForm();
    } catch (error) {
      console.warn('Não foi possível validar a sessão restaurada; o token foi preservado para nova tentativa.', error);
    }
  }

  private renderAuthenticatedUser(): void {
    const profile = document.getElementById('user-profile-menu');
    const user = this.authenticatedUser;
    if (!profile || !user) return;

    const avatar = document.getElementById('header-user-avatar');
    const name = document.getElementById('header-user-name');
    const username = document.getElementById('header-user-username');
    if (avatar) {
      avatar.textContent = this.getUserInitials(user.name || user.username);
      avatar.style.backgroundImage = user.avatarUrl ? `url("${user.avatarUrl}")` : '';
      avatar.classList.toggle('has-image', Boolean(user.avatarUrl));
    }
    if (name) name.textContent = user.name;
    if (username) username.textContent = `@${user.username}`;
    profile.classList.remove('hidden');
  }

  private getUserInitials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'U';
  }

  private get personagemAtivo(): Personagem | null {
    if (!this.personagemAtivoId) return this.personagens[0] || null;
    return this.personagens.find(p => p.idPersonagem === this.personagemAtivoId) || this.personagens[0] || null;
  }

  private initEventListeners(): void {
    const menuToggle = document.getElementById('btn-menu-toggle');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const closeNavigation = () => this.setNavigationOpen(false);
    menuToggle?.addEventListener('click', () => this.setNavigationOpen());
    sidebarBackdrop?.addEventListener('click', closeNavigation);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeNavigation();
        this.setUserMenuOpen(false);
        this.closeDeleteAccountConfirmation();
        this.closeAccountSettings();
      }
    });

    document.getElementById('btn-user-profile')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.setUserMenuOpen();
    });
    document.getElementById('btn-my-profile')?.addEventListener('click', () => {
      this.setUserMenuOpen(false);
      void this.openAccountSettings();
    });
    document.getElementById('btn-user-logout')?.addEventListener('click', () => void this.logout());
    document.getElementById('btn-open-delete-account')?.addEventListener('click', () => this.openDeleteAccountConfirmation());
    document.getElementById('btn-close-delete-account')?.addEventListener('click', () => this.closeDeleteAccountConfirmation());
    document.getElementById('btn-cancel-delete-account')?.addEventListener('click', () => this.closeDeleteAccountConfirmation());
    document.getElementById('account-delete-modal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) this.closeDeleteAccountConfirmation();
    });
    document.getElementById('account-delete-form')?.addEventListener('submit', event => {
      void this.deleteAccount(event);
    });
    document.addEventListener('click', (event) => {
      const target = event.target as Element;
      if (!target.closest('#user-profile-menu')) this.setUserMenuOpen(false);
    });

    document.getElementById('btn-close-account-settings')?.addEventListener('click', () => this.closeAccountSettings());
    document.getElementById('btn-cancel-account-settings')?.addEventListener('click', () => this.closeAccountSettings());
    document.getElementById('account-settings-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.closeAccountSettings();
    });
    document.getElementById('account-settings-form')?.addEventListener('submit', (event) => void this.saveAccountSettings(event));

    // Navegação lateral por abas
    const navButtons = document.querySelectorAll<HTMLButtonElement>('.nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          this.switchTab(tab);
          closeNavigation();
        }
      });
    });

    document.getElementById('btn-switch-role')?.addEventListener('click', () => this.openRoleSelection());

    // Seletor de Personagem Ativo no Topbar
    const charSelect = document.getElementById('active-character-select') as HTMLSelectElement;
    if (charSelect) {
      charSelect.addEventListener('change', (e) => {
        const selected = (e.target as HTMLSelectElement).value;
        if (selected.startsWith('ficha:')) {
          this.fichaRolagemSelecionadaId = selected.slice('ficha:'.length);
        } else {
          this.personagemAtivoId = selected;
          this.fichaRolagemSelecionadaId = null;
        }
        this.renderCurrentView();
        const ficha = this.sistemaItens.find(item => item.id === this.fichaRolagemSelecionadaId);
        this.showToast(ficha ? `Ficha ativa: ${ficha.nome} (${ficha.sistema})` : `Personagem ativo: ${this.personagemAtivo?.nomePersonagem}`);
      });
    }

    // Botão de Rolagem Rápida d20 no Topbar
    const btnQuickRoll = document.getElementById('btn-quick-roll-d20');
    if (btnQuickRoll) {
      btnQuickRoll.addEventListener('click', () => {
        this.executarRolagemD20('Rolagem Rápida', 0);
      });
    }

    // Fechar modal de dados
    const btnCloseDiceModal = document.getElementById('btn-close-dice-modal');
    if (btnCloseDiceModal) {
      btnCloseDiceModal.addEventListener('click', () => {
        document.getElementById('dice-modal')?.classList.add('hidden');
      });
    }

    // Inicializar eventos dos pop-ups de Nota e Missão
    this.initPopupEvents();
  }

  private setNavigationOpen(force?: boolean): void {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggle = document.getElementById('btn-menu-toggle');
    if (!sidebar || !backdrop || !toggle) return;

    const isOpen = force ?? !sidebar.classList.contains('is-open');
    sidebar.classList.toggle('is-open', isOpen);
    backdrop.classList.toggle('is-visible', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  }

  private setUserMenuOpen(force?: boolean): void {
    const dropdown = document.getElementById('user-profile-dropdown');
    const trigger = document.getElementById('btn-user-profile');
    if (!dropdown || !trigger || !this.authenticatedUser) return;
    const isOpen = force ?? dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !isOpen);
    trigger.setAttribute('aria-expanded', String(isOpen));
  }

  private async logout(): Promise<void> {
    const token = this.authToken;
    try {
      if (token) {
        await fetch('http://localhost:3000/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      }
    } finally {
      this.authToken = null;
      this.authenticatedUser = null;
      this.isOfflineSession = false;
      this.pendingOnlineSession = null;
      this.adminIdentity = null;
      this.applyAdminNavigation();
      sessionStorage.removeItem('rpgHubAuthToken');
      StorageService.lock();
      this.clearPrivateArea();
      document.getElementById('user-profile-dropdown')?.classList.add('hidden');
      document.getElementById('user-profile-menu')?.classList.add('hidden');
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('auth-gateway')?.classList.remove('hidden');
      document.getElementById('auth-form-card')?.classList.add('hidden');
      document.querySelectorAll<HTMLElement>('.auth-screen').forEach(screen => screen.classList.toggle('hidden', screen.id !== 'auth-welcome'));
      this.showToast('Você saiu da sua conta.');
    }
  }

  private openDeleteAccountConfirmation(): void {
    if (!this.authToken || !this.authenticatedUser) {
      this.showToast('Entre novamente com sua conta para excluir o perfil.');
      return;
    }
    const password = document.getElementById('account-delete-password') as HTMLInputElement | null;
    const error = document.getElementById('account-delete-error');
    if (password) password.value = '';
    if (error) {
      error.textContent = '';
      error.classList.add('hidden');
    }
    document.getElementById('account-delete-modal')?.classList.remove('hidden');
    password?.focus();
  }

  private closeDeleteAccountConfirmation(): void {
    document.getElementById('account-delete-modal')?.classList.add('hidden');
  }

  private async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();
    const password = document.getElementById('account-delete-password') as HTMLInputElement | null;
    const errorElement = document.getElementById('account-delete-error');
    const submit = document.getElementById('btn-confirm-delete-account') as HTMLButtonElement | null;
    const token = this.authToken;
    const userId = this.authenticatedUser ? String(this.authenticatedUser.id) : '';
    if (!password?.value || !token || !userId) {
      if (errorElement) {
        errorElement.textContent = !token
          ? 'Uma sessão online é necessária para excluir a conta.'
          : 'Informe sua senha atual.';
        errorElement.classList.remove('hidden');
      }
      return;
    }

    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Excluindo...';
    }

    try {
      const response = await fetch('http://localhost:3000/api/users/me', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword: password.value }),
      });
      const data = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Não foi possível excluir a conta.');
      }

      let cleanupError: unknown = null;
      try {
        await StorageService.clearAccountData(userId);
      } catch (error) {
        cleanupError = error;
      }
      this.finishDeletedAccount();
      this.showToast(cleanupError
        ? `A conta foi excluída, mas não foi possível limpar os dados locais: ${
          cleanupError instanceof Error ? cleanupError.message : 'falha desconhecida.'
        }`
        : 'Sua conta foi excluída permanentemente.');
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error instanceof Error ? error.message : 'Não foi possível excluir a conta. Tente novamente.';
        errorElement.classList.remove('hidden');
      }
    } finally {
      if (submit?.isConnected) {
        submit.disabled = false;
        submit.textContent = 'Excluir permanentemente';
      }
    }
  }

  private finishDeletedAccount(): void {
    this.authToken = null;
    this.authenticatedUser = null;
    this.isOfflineSession = false;
    this.pendingOnlineSession = null;
    this.adminIdentity = null;
    this.privateAreaInitialized = false;
    this.applyAdminNavigation();
    sessionStorage.removeItem('rpgHubAuthToken');
    StorageService.lock();
    this.clearPrivateArea();
    this.closeDeleteAccountConfirmation();
    this.closeAccountSettings();
    document.getElementById('user-profile-dropdown')?.classList.add('hidden');
    document.getElementById('user-profile-menu')?.classList.add('hidden');
    document.getElementById('app')?.classList.add('hidden');
    document.getElementById('auth-gateway')?.classList.remove('hidden');
    document.getElementById('auth-form-card')?.classList.add('hidden');
    document.querySelectorAll<HTMLElement>('.auth-screen').forEach(screen => {
      screen.classList.toggle('hidden', screen.id !== 'auth-welcome');
    });
  }

  private async openAccountSettings(): Promise<void> {
    if (!this.authToken) return;
    const modal = document.getElementById('account-settings-modal');
    const error = document.getElementById('account-settings-error');
    if (!modal) return;
    if (error) error.classList.add('hidden');

    try {
      const response = await fetch('http://localhost:3000/api/auth/me', { headers: { Authorization: `Bearer ${this.authToken}` } });
      const data = await response.json();
      if (!response.ok || !data.authenticated) throw new Error('Sua sessão expirou. Faça login novamente.');
      this.authenticatedUser = data.user;
      this.renderAuthenticatedUser();
      const user = this.authenticatedUser;
      if (!user) throw new Error('Não foi possível carregar os dados da conta.');
      (document.getElementById('account-settings-name') as HTMLInputElement).value = user.name;
      (document.getElementById('account-settings-username') as HTMLInputElement).value = user.username;
      (document.getElementById('account-settings-email') as HTMLInputElement).value = user.email || '';
      (document.getElementById('account-settings-current-password') as HTMLInputElement).value = '';
      (document.getElementById('account-settings-new-password') as HTMLInputElement).value = '';
      (document.getElementById('account-settings-password-confirmation') as HTMLInputElement).value = '';
      const avatar = document.getElementById('account-settings-avatar');
      if (avatar) avatar.textContent = this.getUserInitials(user.name || user.username);
      modal.classList.remove('hidden');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Não foi possível carregar seus dados.');
    }
  }

  private closeAccountSettings(): void {
    document.getElementById('account-settings-modal')?.classList.add('hidden');
  }

  private async saveAccountSettings(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.authToken || !this.authenticatedUser) return;
    const name = (document.getElementById('account-settings-name') as HTMLInputElement).value.trim();
    const username = (document.getElementById('account-settings-username') as HTMLInputElement).value.trim();
    const email = (document.getElementById('account-settings-email') as HTMLInputElement).value.trim();
    const currentPassword = (document.getElementById('account-settings-current-password') as HTMLInputElement).value;
    const newPassword = (document.getElementById('account-settings-new-password') as HTMLInputElement).value;
    const confirmation = (document.getElementById('account-settings-password-confirmation') as HTMLInputElement).value;
    const errorElement = document.getElementById('account-settings-error');
    const submitButton = document.getElementById('btn-save-account-settings') as HTMLButtonElement | null;
    const showError = (message: string) => { if (errorElement) { errorElement.textContent = message; errorElement.classList.remove('hidden'); } };

    if (!name || !username || !email) return showError('Preencha nome, nickname e e-mail.');
    if (newPassword || currentPassword || confirmation) {
      if (!currentPassword || !newPassword || !confirmation) return showError('Para alterar a senha, informe a senha atual, a nova senha e a confirmação.');
      if (newPassword.length < 8) return showError('A nova senha deve ter pelo menos 8 caracteres.');
      if (newPassword !== confirmation) return showError('A confirmação da nova senha não coincide.');
    }

    let remotePasswordChanged = false;
    try {
      if (errorElement) errorElement.classList.add('hidden');
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Salvando...'; }
      const passwordRotation = newPassword
        ? await StorageService.preparePasswordRotation(newPassword)
        : null;
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${this.authToken}` };
      const profileResponse = await fetch('http://localhost:3000/api/users/me', { method: 'PUT', headers, body: JSON.stringify({ name, username, email }) });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok || !profileData.success) throw new Error(profileData.message || 'Não foi possível atualizar o perfil.');
      await StorageService.updateVaultProfile({
        userId: String(profileData.user.id),
        name: profileData.user.name,
        username: profileData.user.username,
        email: profileData.user.email,
        lastWorkspace: StorageService.workspaceType(),
      });

      if (newPassword) {
        const passwordResponse = await fetch('http://localhost:3000/api/users/me/password', { method: 'PUT', headers, body: JSON.stringify({ currentPassword, newPassword }) });
        const passwordData = await passwordResponse.json();
        if (!passwordResponse.ok || !passwordData.success) throw new Error(passwordData.message || 'Não foi possível alterar a senha.');
        remotePasswordChanged = true;
        if (passwordRotation) {
          try {
            await StorageService.commitPasswordRotation(passwordRotation);
          } catch {
            throw new Error('A senha da conta foi alterada no servidor, mas o cofre local não foi atualizado. Use a senha anterior para desbloquear este dispositivo e tente novamente.');
          }
        }
      }

      this.authenticatedUser = profileData.user;
      this.renderAuthenticatedUser();
      this.closeAccountSettings();
      this.showToast(newPassword ? 'Perfil e senha atualizados com sucesso.' : 'Perfil atualizado com sucesso.');
    } catch (error) {
      showError(remotePasswordChanged
        ? (error instanceof Error ? error.message : 'A senha mudou no servidor, mas não foi possível atualizar o cofre local.')
        : (error instanceof Error ? error.message : 'Não foi possível salvar as alterações.'));
    } finally {
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Salvar alterações'; }
    }
  }

  private openRoleSelection(): void {
    document.getElementById('role-selection-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', RoleSelectionModal.render());
    document.querySelectorAll<HTMLButtonElement>('#role-selection-modal [data-role]').forEach(button => {
      button.addEventListener('click', () => {
        const role = button.dataset.role as UserRole;
        if (role === 'jogador' || role === 'mestre') this.selectRole(role);
      });
    });
  }

 private async selectRole(role: UserRole): Promise<void> {
  try {
    await StorageService.setWorkspace(role);
    this.userRole = role;

    // Limpa os dados carregados da visualização anterior.
    this.clearPrivateArea();

    // Fecha a janela de seleção.
    document.getElementById('role-selection-modal')?.remove();

    // Recarrega os dados sem reiniciar a aplicação.
    await this.initializePrivateArea();

    this.renderAuthenticatedUser();
    this.updateStorageStatus();

  } catch (error) {
    this.setStorageError(error);
  }
}

  private applyRoleView(): void {
    const role = this.userRole;
    document.querySelectorAll<HTMLElement>('[data-role-view]').forEach(element => {
      const allowedRoles = element.dataset.roleView?.split(' ') || [];
      element.classList.toggle('hidden', Boolean(role && !allowedRoles.includes(role)));
    });
    const switchButton = document.getElementById('btn-switch-role');
    if (switchButton && role) {
      switchButton.textContent = role === 'jogador' ? '🎲 Jogador' : '👑 Mestre';
      switchButton.setAttribute('aria-label', 'Alterar visão do sistema');
    }
    this.switchTab(this.currentTab);
  }

  private applyAdminNavigation(): void {
    const permissions = new Set(this.adminIdentity?.permissions || []);
    document.querySelectorAll<HTMLElement>('[data-admin-permission]').forEach(element => {
      const permission = element.dataset.adminPermission;
      element.classList.toggle('hidden', !permission || !permissions.has(permission));
    });
  }

  /* ================= POP-UPS NOTA E MISSÃO ================= */
  private initPopupEvents(): void {
    const btnNota = document.getElementById('btn-popup-nota');
    const btnMissao = document.getElementById('btn-popup-missao');
    const modalNota = document.getElementById('modal-nota');
    const modalMissao = document.getElementById('modal-missao');
    const btnCloseNota = document.getElementById('btn-close-nota-modal');
    const btnCloseMissao = document.getElementById('btn-close-missao-modal');
    window.addEventListener('offline', () => {
      this.networkOnline = false;
      this.authToken = null;
      this.isOfflineSession = StorageService.isUnlocked;
      this.updateStorageStatus();
    });
    window.addEventListener('online', () => {
      this.networkOnline = true;
      this.updateStorageStatus();
      void this.revalidateRemoteSession();
    });
    document.getElementById('btn-cancelar-edicao-nota')?.addEventListener('click', () => this.cancelarEdicaoNota());
    document.getElementById('btn-cancelar-edicao-missao')?.addEventListener('click', () => this.cancelarEdicaoMissao());

    // Inicializar contadores nos badges
    this.renderNotas();
    this.renderMissoes();
    this.renderOpcoesDeVinculo('nota', null, null);
    this.renderOpcoesDeVinculo('missao', null, null);

    // Abertura dos pop-ups
    btnNota?.addEventListener('click', () => {
      this.renderOpcoesDeVinculo('nota', null, null);
      this.renderNotas();
      modalNota?.classList.remove('hidden');
    });

    btnMissao?.addEventListener('click', () => {
      this.renderOpcoesDeVinculo('missao', null, null);
      this.renderMissoes();
      modalMissao?.classList.remove('hidden');
    });

    // Fechamento via botão ✕
    btnCloseNota?.addEventListener('click', () => {
      modalNota?.classList.add('hidden');
    });

    btnCloseMissao?.addEventListener('click', () => {
      modalMissao?.classList.add('hidden');
    });

    // Fechamento ao clicar fora do card (no backdrop)
    modalNota?.addEventListener('click', (e) => {
      if (e.target === modalNota) modalNota.classList.add('hidden');
    });

    modalMissao?.addEventListener('click', (e) => {
      if (e.target === modalMissao) modalMissao.classList.add('hidden');
    });

    // Fechamento ao pressionar a tecla Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modalNota?.classList.add('hidden');
        modalMissao?.classList.add('hidden');
      }
    });

    // Submissão do formulário de Nota
    const formNota = document.getElementById('form-nova-nota') as HTMLFormElement | null;
    formNota?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tituloInput = document.getElementById('input-nota-titulo') as HTMLInputElement | null;
      const conteudoInput = document.getElementById('input-nota-conteudo') as HTMLTextAreaElement | null;
      const pastaInput = document.getElementById('input-nota-pasta') as HTMLSelectElement | null;
      const campanhaInput = document.getElementById('input-nota-campanha') as HTMLSelectElement | null;
      if (!tituloInput || !conteudoInput || !pastaInput || !campanhaInput) return;

      const titulo = tituloInput.value.trim();
      const conteudo = conteudoInput.value.trim();
      if (!titulo || !conteudo) return;

      const atual = this.notas.find(nota => nota.idNota === this.notaEmEdicaoId);
      const novaNota = new Nota(
        titulo,
        conteudo,
        atual?.dataCriacao,
        atual?.idNota,
        atual?.backendId ?? null,
        pastaInput.value || null,
        campanhaInput.value || null,
        true
      );
      if (!await this.salvarNotaLocal(novaNota)) return;

      tituloInput.value = '';
      conteudoInput.value = '';
      pastaInput.value = '';
      campanhaInput.value = '';
      this.notaEmEdicaoId = null;
      this.atualizarBotaoFormulario('form-nova-nota', '➕ Adicionar Nota');
      this.renderNotas();
      this.showToast(atual ? `Nota "${novaNota.titulo}" atualizada.` : `Nota "${novaNota.titulo}" anotada com sucesso!`);
    });

    // Submissão do formulário de Missão
    const formMissao = document.getElementById('form-nova-missao') as HTMLFormElement | null;
    formMissao?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tituloInput = document.getElementById('input-missao-titulo') as HTMLInputElement | null;
      const descInput = document.getElementById('input-missao-descricao') as HTMLTextAreaElement | null;
      const recInput = document.getElementById('input-missao-recompensa') as HTMLInputElement | null;
      const pastaInput = document.getElementById('input-missao-pasta') as HTMLSelectElement | null;
      const campanhaInput = document.getElementById('input-missao-campanha') as HTMLSelectElement | null;
      if (!tituloInput || !descInput || !pastaInput || !campanhaInput) return;

      const titulo = tituloInput.value.trim();
      const descricao = descInput.value.trim();
      const recompensa = recInput?.value.trim() || '';
      if (!titulo || !descricao) return;

      const atual = this.missoes.find(missao => missao.idMissao === this.missaoEmEdicaoId);
      const novaMissao = new Missao(
        titulo,
        descricao,
        recompensa,
        atual?.status ?? 'em_progresso',
        atual?.dataCriacao,
        atual?.idMissao,
        atual?.backendId ?? null,
        pastaInput.value || null,
        campanhaInput.value || null,
        true
      );
      if (!await this.salvarMissaoLocal(novaMissao)) return;

      tituloInput.value = '';
      descInput.value = '';
      if (recInput) recInput.value = '';
      pastaInput.value = '';
      campanhaInput.value = '';
      this.missaoEmEdicaoId = null;
      this.atualizarBotaoFormulario('form-nova-missao', '⚔️ Adicionar Missão');
      this.renderMissoes();
      this.showToast(atual ? `Missão "${novaMissao.titulo}" atualizada.` : `Missão "${novaMissao.titulo}" adicionada ao quadro!`);
    });
  }

  private atualizarBotaoFormulario(formId: string, label: string): void {
    const form = document.getElementById(formId);
    const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.textContent = label;
    const cancelButton = document.getElementById(
      formId === 'form-nova-nota' ? 'btn-cancelar-edicao-nota' : 'btn-cancelar-edicao-missao'
    );
    cancelButton?.classList.toggle('hidden', !label.startsWith('Salvar'));
  }

  private cancelarEdicaoNota(): void {
    this.notaEmEdicaoId = null;
    (document.getElementById('form-nova-nota') as HTMLFormElement | null)?.reset();
    this.renderOpcoesDeVinculo('nota', null, null);
    this.atualizarBotaoFormulario('form-nova-nota', '➕ Adicionar Nota');
  }

  private cancelarEdicaoMissao(): void {
    this.missaoEmEdicaoId = null;
    (document.getElementById('form-nova-missao') as HTMLFormElement | null)?.reset();
    this.renderOpcoesDeVinculo('missao', null, null);
    this.atualizarBotaoFormulario('form-nova-missao', '⚔️ Adicionar Missão');
  }

  private renderOpcoesDeVinculo(tipo: 'nota' | 'missao', pastaId: string | null, campanhaId: string | null): void {
    const pastaSelect = document.getElementById(`input-${tipo}-pasta`) as HTMLSelectElement | null;
    const campanhaSelect = document.getElementById(`input-${tipo}-campanha`) as HTMLSelectElement | null;
    if (pastaSelect) {
      pastaSelect.innerHTML = '<option value="">Sem pasta</option>' + this.apiFolders.map(folder =>
        `<option value="${this.escapeHtml(folder.id)}">${this.escapeHtml(folder.name)}</option>`
      ).join('');
      pastaSelect.value = pastaId || '';
    }
    if (campanhaSelect) {
      const campaigns = this.campaignApiAvailable
        ? this.campanhas.filter(campaign => campaign.backendId)
        : [];
      const linkedCampaignUnavailable = campanhaId
        && !campaigns.some(campaign => campaign.backendId === campanhaId)
        ? `<option value="${this.escapeHtml(campanhaId)}">Campanha vinculada (indisponível)</option>`
        : '';
      campanhaSelect.innerHTML = '<option value="">Sem campanha</option>' + linkedCampaignUnavailable + campaigns.map(campaign =>
        `<option value="${this.escapeHtml(campaign.backendId || '')}">${this.escapeHtml(campaign.nomeCampanha)}</option>`
      ).join('');
      campanhaSelect.value = campanhaId || '';
    }
  }

  private editarNota(nota: Nota): void {
    const titulo = document.getElementById('input-nota-titulo') as HTMLInputElement | null;
    const conteudo = document.getElementById('input-nota-conteudo') as HTMLTextAreaElement | null;
    if (!titulo || !conteudo) return;
    this.notaEmEdicaoId = nota.idNota;
    titulo.value = nota.titulo;
    conteudo.value = nota.conteudo;
    this.renderOpcoesDeVinculo('nota', nota.pastaId, nota.campanhaId);
    this.atualizarBotaoFormulario('form-nova-nota', 'Salvar alterações');
    titulo.focus();
  }

  private editarMissao(missao: Missao): void {
    const titulo = document.getElementById('input-missao-titulo') as HTMLInputElement | null;
    const descricao = document.getElementById('input-missao-descricao') as HTMLTextAreaElement | null;
    const recompensa = document.getElementById('input-missao-recompensa') as HTMLInputElement | null;
    if (!titulo || !descricao || !recompensa) return;
    this.missaoEmEdicaoId = missao.idMissao;
    titulo.value = missao.titulo;
    descricao.value = missao.descricao;
    recompensa.value = missao.recompensa;
    this.renderOpcoesDeVinculo('missao', missao.pastaId, missao.campanhaId);
    this.atualizarBotaoFormulario('form-nova-missao', 'Salvar alterações');
    titulo.focus();
  }

  private baixarArquivoTxt(filename: string, content: string): void {
    const blob = new Blob([`\ufeff${content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'registro'}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private renderNotas(): void {
    const lista = document.getElementById('lista-notas');
    const badge = document.getElementById('badge-total-notas');
    if (badge) {
      badge.textContent = `${this.notas.length} ${this.notas.length === 1 ? 'nota' : 'notas'}`;
    }

    if (!lista) return;

    if (this.notas.length === 0) {
      lista.innerHTML = `<div class="popup-empty-state">Nenhuma anotação registrada ainda. Crie uma nota acima!</div>`;
      return;
    }

    lista.innerHTML = this.notas.map(n => `
      <div class="popup-note-item" data-id="${n.idNota}">
        <div class="popup-note-header">
          <span class="popup-note-title">${this.escapeHtml(n.titulo)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="popup-note-date">${this.escapeHtml(n.dataCriacao)}</span>
            <button class="btn-icon btn-export-nota" data-id="${n.idNota}" title="Exportar TXT">⬇️</button>
            <button class="btn-icon btn-edit-nota" data-id="${n.idNota}" title="Editar nota">✏️</button>
            <button class="btn-icon btn-delete-nota" data-id="${n.idNota}" title="Excluir Nota" style="color: var(--danger); font-size: 0.95rem; padding: 2px 4px;">🗑️</button>
          </div>
        </div>
        <div class="popup-note-body">${this.escapeHtml(n.conteudo)}</div>
        <small>${this.escapeHtml(this.nomePasta(n.pastaId))}${n.campanhaId ? ` · ${this.escapeHtml(this.nomeCampanha(n.campanhaId))}` : ''}</small>
      </div>
    `).join('');

    lista.querySelectorAll<HTMLButtonElement>('.btn-edit-nota').forEach(btn => {
      btn.addEventListener('click', () => {
        const nota = this.notas.find(item => item.idNota === btn.dataset.id);
        if (nota) this.editarNota(nota);
      });
    });
    lista.querySelectorAll<HTMLButtonElement>('.btn-export-nota').forEach(btn => {
      btn.addEventListener('click', () => {
        const nota = this.notas.find(item => item.idNota === btn.dataset.id);
        if (nota) this.baixarArquivoTxt(nota.titulo, `${nota.titulo}\n\n${nota.conteudo}\n`);
      });
    });
    lista.querySelectorAll<HTMLButtonElement>('.btn-delete-nota').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nota = this.notas.find(item => item.idNota === btn.dataset.id);
        if (nota) void this.excluirNota(nota);
      });
    });
  }

  private renderMissoes(): void {
    const lista = document.getElementById('lista-missoes');
    const badge = document.getElementById('badge-total-missoes');
    const ativas = this.missoes.filter(m => m.status === 'em_progresso').length;

    if (badge) {
      badge.textContent = `${ativas} ${ativas === 1 ? 'ativa' : 'ativas'}`;
    }

    if (!lista) return;

    if (this.missoes.length === 0) {
      lista.innerHTML = `<div class="popup-empty-state">Nenhuma missão cadastrada. Crie uma missão acima!</div>`;
      return;
    }

    lista.innerHTML = this.missoes.map(m => {
      const isConcluida = m.status === 'concluida';
      return `
        <div class="popup-mission-item ${m.status}" data-id="${m.idMissao}">
          <button class="popup-mission-toggle btn-toggle-missao" data-id="${m.idMissao}" title="${isConcluida ? 'Reabrir Missão' : 'Concluir Missão'}">
            ${isConcluida ? '✅' : '⏳'}
          </button>
          <div class="popup-mission-content">
            <div class="popup-mission-title">${this.escapeHtml(m.titulo)}</div>
            <div class="popup-mission-desc">${this.escapeHtml(m.descricao)}</div>
            <div class="popup-mission-footer">
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                <span class="mission-status-tag ${m.status}">
                  ${isConcluida ? 'Concluída' : 'Em Progresso'}
                </span>
                ${m.recompensa ? `<span class="mission-reward-tag">🎁 ${this.escapeHtml(m.recompensa)}</span>` : ''}
              </div>
              <div>
                <button class="btn-icon btn-export-missao" data-id="${m.idMissao}" title="Exportar TXT">⬇️</button>
                <button class="btn-icon btn-edit-missao" data-id="${m.idMissao}" title="Editar missão">✏️</button>
                <button class="btn-icon btn-delete-missao" data-id="${m.idMissao}" title="Excluir Missão" style="color: var(--danger); font-size: 0.95rem; padding: 2px 4px;">🗑️</button>
              </div>
            </div>
            <small>${this.escapeHtml(this.nomePasta(m.pastaId))}${m.campanhaId ? ` · ${this.escapeHtml(this.nomeCampanha(m.campanhaId))}` : ''}</small>
          </div>
        </div>
      `;
    }).join('');

    lista.querySelectorAll<HTMLButtonElement>('.btn-toggle-missao').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const missao = this.missoes.find(m => m.idMissao === id);
        if (missao) {
          const previousStatus = missao.status;
          const previousPendingSync = missao.pendingSync;
          missao.toggleStatus();
          missao.pendingSync = true;
          void this.salvarMissaoLocal(missao).then(saved => {
            if (saved) {
              this.showToast(missao.status === 'concluida' ? `Missão "${missao.titulo}" concluída!` : `Missão "${missao.titulo}" reaberta.`);
            } else {
              missao.status = previousStatus;
              missao.pendingSync = previousPendingSync;
              this.renderMissoes();
            }
          });
        }
      });
    });

    lista.querySelectorAll<HTMLButtonElement>('.btn-edit-missao').forEach(btn => {
      btn.addEventListener('click', () => {
        const missao = this.missoes.find(item => item.idMissao === btn.dataset.id);
        if (missao) this.editarMissao(missao);
      });
    });
    lista.querySelectorAll<HTMLButtonElement>('.btn-export-missao').forEach(btn => {
      btn.addEventListener('click', () => {
        const missao = this.missoes.find(item => item.idMissao === btn.dataset.id);
        if (missao) {
          this.baixarArquivoTxt(missao.titulo, [
            missao.titulo,
            `Status: ${missao.status === 'concluida' ? 'Concluída' : 'Em progresso'}`,
            '',
            missao.descricao,
            missao.recompensa ? `\nRecompensa: ${missao.recompensa}` : ''
          ].join('\n'));
        }
      });
    });
    lista.querySelectorAll<HTMLButtonElement>('.btn-delete-missao').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const missao = this.missoes.find(item => item.idMissao === btn.dataset.id);
        if (missao) void this.excluirMissao(missao);
      });
    });
  }

  private nomePasta(id: string | null): string {
    if (!id) return 'Sem pasta';
    return this.apiFolders.find(folder => folder.id === id)?.name || 'Pasta indisponível';
  }

  private nomeCampanha(id: string): string {
    return this.campanhas.find(campaign => campaign.backendId === id)?.nomeCampanha || 'Campanha indisponível';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private switchTab(tabName: string): void {
    if (tabName !== 'campaign-access') void this.stopPlayerQrScanner();
    this.currentTab = tabName;

    // Atualizar classes ativas na navegação
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    // Atualizar títulos no topbar
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    const titulos: Record<string, { title: string; sub: string }> = {
      dashboard: { title: 'RPG Hub', sub: 'Seu espaço para criar personagens e viver aventuras' },
      personagens: { title: 'Ficha do Personagem', sub: 'Consulte e atualize os atributos do seu herói' },
      wizard: { title: 'Criar Personagem', sub: 'Monte seu personagem passo a passo' },
      inventario: { title: 'Inventário', sub: 'Organize os itens da sua aventura' },
      magias: { title: 'Magias e Habilidades', sub: 'Consulte os poderes do seu personagem' },
      dados: { title: 'Rolagem de Dados', sub: 'Faça testes e acompanhe os resultados' },
      'inventario-sistemas': { title: 'Inventário', sub: 'Organize os itens da ficha selecionada' },
      sistemas: { title: 'Sistemas', sub: 'Organize fichas por sistema, campanha e personagem' },
      campanhas: { title: 'Campanhas do Mestre', sub: 'Organize grupos e histórias' },
      'campaign-access': { title: 'Campanhas', sub: 'Solicite acesso e responda a convites' },
      friendships: { title: 'Amizades', sub: 'Pesquise usuários e gerencie suas amizades' },
      npcs: { title: 'Monstros', sub: 'Organize fichas de monstros por sistema e campanha' },
      iniciativa: { title: 'Iniciativa e Combate', sub: 'Organize a ordem dos turnos' },
      'admin-dashboard': { title: 'Painel administrativo', sub: 'Visão geral de contas, atividade e finanças' },
      'admin-users': { title: 'Usuários', sub: 'Gerencie o acesso às contas' },
      'admin-plans': { title: 'Planos', sub: 'Configure benefícios, preços e limites' },
      'admin-systems': { title: 'Sistemas RPG', sub: 'Configure sistemas e versões disponíveis' },
      'admin-subscriptions': { title: 'Assinaturas', sub: 'Consulte e gerencie contratos' },
      'admin-payments': { title: 'Pagamentos', sub: 'Consulte eventos financeiros confirmados' },
      'admin-expenses': { title: 'Despesas', sub: 'Registre e acompanhe despesas' },
      'admin-reports': { title: 'Relatórios ADM', sub: 'Indicadores financeiros e operacionais' },
      'admin-settings': { title: 'Configurações ADM', sub: 'Parâmetros de atividade do produto' },
      'admin-audit': { title: 'Auditoria', sub: 'Histórico de operações administrativas' },
      'my-plan': { title: 'Meu Plano', sub: 'Consulte seu plano atual e as opções disponíveis' }
    };
    if (tabName === 'dashboard' && this.userRole === 'mestre') {
      titulos.dashboard = {
        title: 'Painel do Mestre',
        sub: 'Acompanhe suas campanhas, participantes e combates'
      };
    }

    if (titleEl && subtitleEl && titulos[tabName]) {
      titleEl.innerText = titulos[tabName].title;
      subtitleEl.innerText = titulos[tabName].sub;
    }

    if (tabName.startsWith('admin-') && this.authToken && this.adminIdentity) {
      const container = document.getElementById('content-area');
      if (container) void AdminConsoleView.render(container, tabName, this.authToken, this.adminIdentity);
      return;
    }

    if (tabName === 'my-plan' && this.authToken) {
      const container = document.getElementById('content-area');
      if (container) void MyPlanView.render(container, this.authToken);
      return;
    }

    if (tabName === 'sistemas') {
      this.pastaSistemaAtualId = null;
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = false;
      this.criandoFichaGuiada = false;
      this.sistemaFichaEmCriacao = null;
    }

    this.renderCurrentView();
    if (tabName === 'campaign-access') void this.loadPlayerCampaignAccess();
    if (tabName === 'friendships') void this.loadFriendshipData();
  }

  private renderMasterDashboard(container: HTMLElement): void {
    const offline = !this.authToken || !this.networkOnline || this.isOfflineSession;
    container.innerHTML = MestreDashboardView.render({
      userName: this.authenticatedUser?.name || 'Mestre',
      summary: offline ? null : this.masterDashboard,
      loading: this.masterDashboardLoading,
      error: this.masterDashboardError,
      offline,
      localCampaigns: this.campanhas.map(campaign => ({
        name: campaign.nomeCampanha,
        createdAt: campaign.dataCriacao
      })),
      date: new Date()
    });

    container.querySelectorAll<HTMLButtonElement>('[data-master-dashboard-manage]')
      .forEach(button => button.addEventListener('click', () => this.switchTab('campanhas')));
    container.querySelectorAll<HTMLButtonElement>('[data-master-dashboard-create]')
      .forEach(button => button.addEventListener('click', () => {
        this.switchTab('campanhas');
        document.getElementById('btn-add-campanha-modal')?.click();
      }));
    container.querySelectorAll<HTMLButtonElement>('[data-master-dashboard-refresh]')
      .forEach(button => button.addEventListener('click', () => void this.loadMasterDashboard(true)));
  }

  private async loadMasterDashboard(force = false): Promise<void> {
    if (this.userRole !== 'mestre' || !this.authToken || !this.networkOnline || this.isOfflineSession) {
      return;
    }
    if (this.masterDashboardLoading) return;
    if (!force && (this.masterDashboard || this.masterDashboardError || this.masterDashboardAttempted)) {
      return;
    }

    const token = this.authToken;
    this.masterDashboardLoading = true;
    this.masterDashboardAttempted = true;
    this.masterDashboardError = null;
    if (this.currentTab === 'dashboard') this.renderCurrentView();

    try {
      const summary = await CampaignService.resumoMestre(token);
      if (token !== this.authToken || this.userRole !== 'mestre') return;
      this.masterDashboard = summary;
    } catch (error) {
      if (token !== this.authToken || this.userRole !== 'mestre') return;
      console.warn('Não foi possível carregar o dashboard do Mestre.', error);
      this.masterDashboardError = error instanceof Error
        ? error.message
        : 'Não foi possível carregar os dados do dashboard.';
    } finally {
      if (token === this.authToken) {
        this.masterDashboardLoading = false;
        if (this.currentTab === 'dashboard') this.renderCurrentView();
      }
    }
  }

  private updateCharacterSelector(): void {
    const select = document.getElementById('active-character-select') as HTMLSelectElement;
    if (!select) return;

    const fichas = this.sistemaItens.filter(item => item.tipo === 'ficha');
    select.innerHTML = this.personagens.map(p =>
      `<option value="${p.idPersonagem}" ${p.idPersonagem === this.personagemAtivoId ? 'selected' : ''}>${p.nomePersonagem} (${p.classe})</option>`
    ).join('') + fichas.map(ficha =>
      `<option value="ficha:${ficha.id}" ${ficha.id === this.fichaRolagemSelecionadaId ? 'selected' : ''}>${ficha.nome} (${ficha.sistema})</option>`
    ).join('');

    if (this.personagens.length === 0 && fichas.length === 0) {
      select.innerHTML = `<option value="">Nenhum Personagem</option>`;
    }
  }

  private renderCurrentView(): void {
    const container = document.getElementById('content-area');
    if (!container) return;

    switch (this.currentTab) {
      case 'dashboard':
        if (this.userRole === 'mestre') {
          this.renderMasterDashboard(container);
          if (this.authToken && this.networkOnline && !this.masterDashboard && !this.masterDashboardLoading &&
            !this.masterDashboardError && !this.masterDashboardAttempted) {
            void this.loadMasterDashboard();
          }
        } else {
          container.innerHTML = DashboardView.render(this.personagens, this.campanhas, this.npcs);
        }
        break;

      case 'personagens':
        container.innerHTML = JogadorView.renderFichas(this.personagens, this.personagemAtivo);
        this.bindFichaEvents();
        break;

      case 'wizard':
        container.innerHTML = JogadorView.renderWizard();
        this.wizardStep = 1;
        this.bindWizardEvents();
        break;

      case 'inventario':
        container.innerHTML = JogadorView.renderInventario(this.personagemAtivo);
        this.bindInventarioEvents();
        break;

      case 'inventario-sistemas':
        container.innerHTML = JogadorView.renderInventarioSistemas(this.sistemaItens.filter(item => item.tipo === 'ficha'), this.fichaInventarioSelecionadaId);
        this.bindInventarioSistemasEvents();
        break;

      case 'magias':
        container.innerHTML = JogadorView.renderMagias(this.personagemAtivo);
        this.bindMagiasEvents();
        break;

      case 'dados':
        container.innerHTML = JogadorView.renderRoladorDados(this.personagemAtivo, this.sistemaItens.filter(item => item.tipo === 'ficha'), this.fichaRolagemSelecionadaId, this.historicoDados);
        this.bindDadosEvents();
        break;

      case 'sistemas':
        if (this.criandoFichaGuiada) {
          container.innerHTML = JogadorView.renderFichaGuiada(this.sistemaItens, this.pastaSistemaAtualId);
        } else if (this.criandoFichaSistema && !this.sistemaFichaEmCriacao) {
          container.innerHTML = JogadorView.renderSeletorFicha();
        } else {
          container.innerHTML = JogadorView.renderSistemas(
            this.sistemaItens,
            this.pastaSistemaAtualId,
            this.fichaSistemaEmEdicaoId
              ? this.sistemaItens.find(item => item.id === this.fichaSistemaEmEdicaoId) || null
              : this.criandoFichaSistema
                ? {
                  id: '', nome: '', tipo: 'ficha', sistema: this.sistemaFichaEmCriacao || 'Call of Cthulhu', descricao: '',
                  parentId: this.pastaSistemaAtualId, dataCriacao: '', dados: {}
                }
                : null
          );
        }
        this.renderCharacterSheetModules(container);
        this.bindSistemasEvents();
        break;

      case 'campanhas':
        container.innerHTML = MestreView.renderCampanhas(
          this.campanhas,
          this.personagens,
          this.npcs,
          this.sistemaItens.filter(item => item.tipo === 'ficha'),
          this.monstroItens,
          this.openCampaignDetails,
          this.campaignMembers,
          this.campaignCharacters,
          this.campaignApiAvailable,
          String(this.authenticatedUser?.id || ''),
          this.campaignInviteStatuses,
          this.campaignInviteCodes,
          this.campaignInviteQrCodes,
          this.campaignJoinRequests,
          this.campaignUserInvitations,
          this.campaignSearchResults,
          this.campaignDetailsLoading,
          this.friendshipFriends
        );
        this.bindCampanhasEvents();
        break;

      case 'campaign-access':
        container.innerHTML = CampaignJoinView.render(
          this.campanhas,
          this.playerCampaignInvitations,
          this.playerCampaignRequests,
          this.playerInviteCode,
          this.playerInvitePreview,
          this.playerInviteRequestSent,
          this.playerCampaignAccessLoading
        );
        this.bindPlayerCampaignAccessEvents();
        break;

      case 'friendships':
        container.innerHTML = FriendshipsView.render(
          this.friendshipData,
          this.friendshipSearchResults,
          this.friendshipSearchTerm,
          this.friendshipLoading,
          this.friendshipError,
          this.friendshipMessage
        );
        this.bindFriendshipEvents();
        break;

      case 'npcs':
        container.innerHTML = MonstroView.render(this.monstroItens, this.pastaMonstroAtualId, this.monstroEmEdicaoId ? this.monstroItens.find(item => item.id === this.monstroEmEdicaoId) || null : null, this.criandoMonstro);
        this.bindMonstrosEvents();
        break;

      case 'iniciativa':
        container.innerHTML = MestreView.renderIniciativa(
          this.mestre,
          this.personagens,
          this.npcs,
          this.sistemaItens.filter(item => item.tipo === 'ficha'),
          this.monstroItens
        );
        this.bindIniciativaEvents();
        break;

      default:
        container.innerHTML = DashboardView.render(this.personagens, this.campanhas, this.npcs);
    }
  }

  private renderCharacterSheetModules(container: HTMLElement): void {
    const systems: Array<{ system: CharacterSheetSystem; targetId: string }> = [
      { system: 'D&D', targetId: 'native-guided-dnd' },
      { system: 'Call of Cthulhu', targetId: 'native-guided-coc' },
      { system: 'Vampiro: A Máscara', targetId: 'native-guided-vampire' }
    ];
    const guidedForm = container.querySelector<HTMLFormElement>('#form-ficha-guided');
    if (guidedForm) {
      for (const { system, targetId } of systems) {
        const target = container.querySelector<HTMLElement>(`#${targetId}`);
        if (target) renderCharacterSheet(target, system, 'guided', null);
      }
      return;
    }

    const editorTarget = container.querySelector<HTMLElement>('#native-sheet-editor-root');
    if (!editorTarget) return;

    const ficha = this.fichaSistemaEmEdicaoId
      ? this.sistemaItens.find(item => item.id === this.fichaSistemaEmEdicaoId) || null
      : this.criandoFichaSistema && this.sistemaFichaEmCriacao
        ? {
          id: '',
          nome: '',
          tipo: 'ficha' as const,
          sistema: this.sistemaFichaEmCriacao,
          descricao: '',
          parentId: this.pastaSistemaAtualId,
          dataCriacao: '',
          dados: {}
        }
        : null;
    const system = ficha?.sistema || this.sistemaFichaEmCriacao;
    if (!system || !isCharacterSheetSystem(system)) return;
    renderCharacterSheet(editorTarget, system, 'editor', ficha);
  }

  /* ================= INVENTARIO DE FICHAS EVENTS ================= */
  private bindInventarioSistemasEvents(): void {
    const fichas = this.sistemaItens.filter(item => item.tipo === 'ficha');
    const select = document.getElementById('inventory-sheet-select') as HTMLSelectElement | null;
    if (select) {
      if (!this.fichaInventarioSelecionadaId || !fichas.some(ficha => ficha.id === this.fichaInventarioSelecionadaId)) {
        this.fichaInventarioSelecionadaId = select.value || null;
      }
      select.addEventListener('change', event => {
        this.fichaInventarioSelecionadaId = (event.target as HTMLSelectElement).value || null;
        this.renderCurrentView();
      });
    }

    const ficha = fichas.find(item => item.id === this.fichaInventarioSelecionadaId) || fichas[0];
    if (!ficha) return;
    ficha.inventario ||= [];

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-system-item').forEach(button => {
      button.addEventListener('click', () => {
        ficha.inventario = ficha.inventario?.filter(item => item.id !== button.dataset.id) || [];
        this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
        this.renderCurrentView();
      });
    });

    document.getElementById('form-add-system-item')?.addEventListener('submit', event => {
      event.preventDefault();
      const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() || '';
      const nome = value('system-item-name');
      if (!nome) return;
      ficha.inventario ||= [];
      ficha.inventario.push({
        id: crypto.randomUUID(),
        nome,
        quantidade: Math.max(1, Number(value('system-item-quantity')) || 1),
        peso: Math.max(0, Number(value('system-item-weight')) || 0),
        descricao: value('system-item-description')
      });
      this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
      this.showToast(`Item "${nome}" adicionado ao inventário.`);
      this.renderCurrentView();
    });
  }

  /* ================= SISTEMAS EVENTS ================= */
  private async generateCharacterAttributes(
    systemSlug: string,
    versionSlug: string,
    prefix: string,
  ): Promise<void> {
    if (!this.authToken) {
      this.showToast('Conecte-se para gerar os atributos.');
      return;
    }

    const attributeKeys = systemSlug === 'call-of-cthulhu'
      ? ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck']
      : ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'composure', 'intelligence', 'wits', 'resolve'];
    const derivedKeys = systemSlug === 'call-of-cthulhu'
      ? ['hp', 'sanity', 'mp']
      : ['health', 'willpower'];
    const hasExistingValues = [...attributeKeys, ...derivedKeys].some((key) =>
      (document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null)?.value.trim(),
    );
    if (hasExistingValues && !window.confirm('Gerar novamente e substituir os atributos preenchidos? Os valores derivados também serão atualizados.')) {
      return;
    }

    const prioritySelect = document.getElementById(`${prefix}-priorities`) as HTMLSelectElement | null;
    const result = await CharacterService.gerarAtributos({
      systemSlug,
      versionSlug,
      ...(systemSlug === 'vampiro-a-mascara'
        ? { priorities: (prioritySelect?.value || '').split(',') }
        : {}),
    }, this.authToken);

    for (const [key, value] of Object.entries(result.attributes)) {
      const field = document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null;
      if (!field) continue;
      field.value = String(value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const [key, value] of Object.entries(result.derived)) {
      const field = document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null;
      if (!field) continue;
      field.value = String(value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this.showToast('Atributos gerados. Você ainda pode editá-los antes de salvar.');
  }

  private validateVampireAttributeDistribution(
    prefix: string,
    requireAttributes = false,
  ): boolean {
    const groups: Record<string, string[]> = {
      physical: ['strength', 'dexterity', 'stamina'],
      social: ['charisma', 'manipulation', 'composure'],
      mental: ['intelligence', 'wits', 'resolve'],
    };
    const prioritySelect = document.getElementById(`${prefix}-priorities`) as HTMLSelectElement | null;
    const priorities = (prioritySelect?.value || '').split(',');
    const values = Object.values(groups).flatMap((group) => group.map((key) => {
      const field = document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null;
      const text = field?.value.trim() || '';
      return text === '' ? null : Number(text);
    }));
    if (values.every((value) => value === null)) {
      if (!requireAttributes) return true;
      this.showToast('Gere os atributos ou preencha manualmente os nove valores antes de salvar.');
      return false;
    }

    if (
      priorities.length !== 3
      || new Set(priorities).size !== 3
      || priorities.some((group) => !groups[group])
    ) {
      this.showToast('Selecione uma prioridade diferente para cada grupo de atributos.');
      return false;
    }

    const points = [7, 5, 3];
    for (let index = 0; index < priorities.length; index += 1) {
      const groupValues = groups[priorities[index]].map((key) => {
        const field = document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null;
        const text = field?.value.trim() || '';
        return text === '' ? NaN : Number(text);
      });
      if (
        groupValues.some((value) => !Number.isInteger(value) || value < 1 || value > 5)
        || groupValues.reduce((sum, value) => sum + value, 0) - 3 !== points[index]
      ) {
        this.showToast('A distribuição V5 deve respeitar os pontos 7/5/3 e valores de atributo entre 1 e 5.');
        return false;
      }
    }
    return true;
  }

  private validateCocAttributes(prefix: string, requireAttributes = false): boolean {
    const keys = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu', 'luck'];
    const values = keys.map((key) => {
      const field = document.getElementById(`${prefix}-${key}`) as HTMLInputElement | null;
      return field?.value.trim() || '';
    });
    if (values.every((value) => value === '')) {
      if (!requireAttributes) return true;
      this.showToast('Gere as características ou preencha os nove valores antes de salvar.');
      return false;
    }
    if (values.some((value) => {
      const parsed = Number(value);
      return value === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 100;
    })) {
      this.showToast('As nove características devem ser números inteiros entre 0 e 100.');
      return false;
    }
    return true;
  }

  private bindDerivedValueUpdates(root: ParentNode, systemSlug: string, prefix: string): void {
    const field = (key: string) => root.querySelector<HTMLInputElement>(`#${prefix}-${key}`);
    const setDerived = (key: string, value: number): void => {
      const target = field(key);
      if (target) target.value = String(value);
    };
    const update = (): void => {
      if (systemSlug === 'call-of-cthulhu') {
        const constitution = Number(field('con')?.value);
        const size = Number(field('siz')?.value);
        const power = Number(field('pow')?.value);
        if (Number.isFinite(constitution) && Number.isFinite(size) && field('con')?.value && field('siz')?.value) {
          setDerived('hp', Math.floor((constitution + size) / 10));
        }
        if (Number.isFinite(power) && field('pow')?.value) {
          setDerived('sanity', power);
          setDerived('mp', Math.floor(power / 5));
        }
        return;
      }

      const stamina = Number(field('stamina')?.value);
      const composure = Number(field('composure')?.value);
      const resolve = Number(field('resolve')?.value);
      if (Number.isFinite(stamina) && field('stamina')?.value) {
        setDerived('health', stamina + 3);
      }
      if (Number.isFinite(composure) && Number.isFinite(resolve) && field('composure')?.value && field('resolve')?.value) {
        setDerived('willpower', composure + resolve);
      }
    };

    const keys = systemSlug === 'call-of-cthulhu'
      ? ['con', 'siz', 'pow']
      : ['stamina', 'composure', 'resolve'];
    keys.forEach((key) => field(key)?.addEventListener('input', update));
  }

  private bindSistemasEvents(): void {
    const bindDndAttributeCards = (root: ParentNode): void => {
      const updateModifier = (input: HTMLInputElement): void => {
        const attribute = input.id.split('-').pop();
        if (!attribute) return;
        if (!input.value.trim()) {
          const output = root.querySelector<HTMLElement>(`[data-dnd-modifier-for="${attribute}"]`);
          if (output) output.textContent = '—';
          return;
        }
        const score = Number(input.value);
        const modifier = Number.isFinite(score) ? Math.floor((score - 10) / 2) : 0;
        const output = root.querySelector<HTMLElement>(`[data-dnd-modifier-for="${attribute}"]`);
        if (output) output.textContent = `${modifier >= 0 ? '+' : ''}${modifier}`;
      };

      root.querySelectorAll<HTMLButtonElement>('.dnd-score-step').forEach(button => {
        button.addEventListener('click', () => {
          const target = button.dataset.dndTarget;
          const input = target ? root.querySelector<HTMLInputElement>(`#${target}`) : null;
          if (!input) return;
          const delta = Number(button.dataset.dndDelta);
          const current = Number(input.value) || 0;
          input.value = String(Math.max(1, Math.min(30, current + delta)));
          updateModifier(input);
        });
      });

      root.querySelectorAll<HTMLInputElement>('.dnd-attribute-score, .dnd-attribute-score-row input').forEach(input => {
        input.addEventListener('input', () => updateModifier(input));
        updateModifier(input);
      });
    };

    const guidedForm = document.getElementById('form-ficha-guided') as HTMLFormElement | null;
    if (guidedForm) {
      this.bindDerivedValueUpdates(guidedForm, 'call-of-cthulhu', 'guided-coc');
      this.bindDerivedValueUpdates(guidedForm, 'vampiro-a-mascara', 'guided-vampire');
      const guidedSystem = document.getElementById('guided-system') as HTMLSelectElement | null;
      const setupGuidedSteps = (template: HTMLElement | null): void => {
        const module = template?.querySelector<HTMLElement>('.character-sheet-module');
        if (!module || module.dataset.guidedStepsReady === 'true') return;
        if (module.querySelector('[data-sheet-tab]')) return;
        const sections = Array.from(module.querySelectorAll<HTMLElement>(
          '.dnd-guided-section, .coc-guided-section, .vampire-guided-section',
        ));
        if (!sections.length) return;
        module.dataset.guidedStepsReady = 'true';
        const actions = module.querySelector<HTMLElement>('.character-sheet-actions');
        if (!actions) return;
        const saveButton = actions.querySelector<HTMLButtonElement>('button[type="submit"]');
        const review = document.createElement('section');
        review.className = 'sheet-editor-section guided-review-summary';
        review.hidden = true;
        review.innerHTML = '<h4>Revisão da ficha</h4><p>Confira os dados antes de salvar.</p><ul></ul>';
        const reviewList = review.querySelector('ul')!;
        module.insertBefore(review, actions);

        const navigation = document.createElement('div');
        navigation.className = 'character-sheet-actions guided-step-navigation';
        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'btn btn-secondary';
        previous.textContent = 'Voltar etapa';
        const progress = document.createElement('span');
        progress.setAttribute('aria-live', 'polite');
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn btn-primary';
        next.textContent = 'Próxima etapa';
        module.insertBefore(navigation, review);
        navigation.append(previous, progress, next);

        let currentStep = 0;
        const renderStep = (): void => {
          sections.forEach((section, index) => {
            section.hidden = index !== currentStep || currentStep === sections.length;
          });
          review.hidden = currentStep !== sections.length;
          previous.hidden = currentStep === 0;
          next.hidden = currentStep === sections.length;
          progress.textContent = currentStep === sections.length
            ? 'Revisão final'
            : `Etapa ${currentStep + 1} de ${sections.length}`;
          module.dataset.guidedReviewReady = String(currentStep === sections.length);
          if (saveButton) saveButton.hidden = currentStep !== sections.length;
          if (currentStep === sections.length) {
            reviewList.replaceChildren();
            module.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
              'input, textarea, select',
            ).forEach((field) => {
              if (!field.value.trim() || field.closest('.guided-step-navigation')) return;
              const label = module.querySelector<HTMLLabelElement>(`label[for="${field.id}"]`);
              const item = document.createElement('li');
              item.textContent = `${label?.textContent?.trim() || field.id}: ${field.value.trim()}`;
              reviewList.append(item);
            });
          }
        };
        previous.addEventListener('click', () => {
          currentStep = Math.max(0, currentStep - 1);
          renderStep();
        });
        next.addEventListener('click', () => {
          if (currentStep === 0) {
            const nameField = module.querySelector<HTMLInputElement>('input[id$="-name"]');
            if (!nameField?.value.trim()) {
              this.showToast('Informe o nome do personagem para continuar.');
              nameField?.focus();
              return;
            }
          }
          currentStep = Math.min(sections.length, currentStep + 1);
          renderStep();
        });
        renderStep();
      };
      const updateGuidedTemplate = () => {
        const template = guidedSystem?.value === 'D&D' ? 'dnd' : guidedSystem?.value === 'Vampiro: A Máscara' ? 'vampire' : 'coc';
        document.querySelectorAll('.guided-template').forEach(element => element.classList.add('hidden'));
        const activeTemplate = document.getElementById(`guided-template-${template}`);
        activeTemplate?.classList.remove('hidden');
        if (template !== 'dnd') setupGuidedSteps(activeTemplate);
      };
      guidedSystem?.addEventListener('change', updateGuidedTemplate);
      updateGuidedTemplate();
      bindDndAttributeCards(guidedForm);

      const setGuidedValue = (id: string, value: number): void => {
        const field = document.getElementById(id) as HTMLInputElement | null;
        if (field) field.value = String(value);
      };
      const rollGuidedDnd = () => {
        const values = Array.from({ length: 6 }, () => {
          const rolls = Array.from({ length: 4 }, () => DiceService.sortearNumero(1, 6)).sort((a, b) => a - b);
          return rolls.slice(1).reduce((sum, value) => sum + value, 0);
        });
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((attribute, index) => setGuidedValue(`guided-dnd-${attribute}`, values[index]));
        guidedForm.querySelectorAll<HTMLInputElement>('.dnd-attribute-score, .dnd-attribute-score-row input').forEach(input => {
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      };
      const rollGuidedCoc = async () => {
        try {
          await this.generateCharacterAttributes('call-of-cthulhu', '7a-edicao', 'guided-coc');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível gerar os atributos.');
        }
      };
      const distributeGuidedVampire = async () => {
        try {
          await this.generateCharacterAttributes('vampiro-a-mascara', 'v5', 'guided-vampire');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível gerar os atributos.');
        }
      };
      document.getElementById('btn-guided-roll-dnd')?.addEventListener('click', rollGuidedDnd);
      document.getElementById('btn-guided-roll-coc')?.addEventListener('click', rollGuidedCoc);
      document.getElementById('btn-guided-roll-vampire')?.addEventListener('click', distributeGuidedVampire);

      guidedForm.querySelectorAll<HTMLButtonElement>('[data-guided-sheet-cancel]').forEach(button => {
        button.addEventListener('click', () => {
          if (formHasChanges(guidedForm) && !window.confirm('Descartar as alterações não salvas?')) return;
          this.fichaSistemaEmEdicaoId = null;
          this.criandoFichaSistema = true;
          this.criandoFichaGuiada = false;
          this.sistemaFichaEmCriacao = null;
          this.renderCurrentView();
        });
      });

      guidedForm.addEventListener('submit', event => {
        event.preventDefault();
        const activeModule = guidedForm.querySelector<HTMLElement>(
          '.guided-template:not(.hidden) .character-sheet-module',
        );
        if (
          guidedSystem?.value !== 'D&D'
          && activeModule?.dataset.guidedReviewReady !== 'true'
          && activeModule
        ) {
          this.showToast('Avance até a revisão final antes de salvar a ficha.');
          return;
        }
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destination = value('guided-destination');
        const sistema = value('guided-system');
        const prefixo = sistema === 'D&D' ? 'guided-dnd' : sistema === 'Vampiro: A Máscara' ? 'guided-vampire' : 'guided-coc';
        if (sistema === 'Vampiro: A Máscara' &&
            !this.validateVampireAttributeDistribution(prefixo, true)) return;
        if (sistema === 'Call of Cthulhu' &&
            !this.validateCocAttributes(prefixo, true)) return;
        const nome = value(`${prefixo}-name`);
        if (!nome) {
          this.showToast('Informe o nome do personagem para continuar.');
          return;
        }
        if (!destination) {
          this.showToast('Escolha uma pasta para salvar a ficha.');
          return;
        }

        const dados: Record<string, string | number> = {
          guidedConcept: value(`${prefixo}-concept`),
          guidedGoal: value(`${prefixo}-goal`),
          guidedBackground: value(`${prefixo}-background`) || value(`${prefixo}-story`),
          guidedOccupation: value(`${prefixo}-occupation`),
          guidedAge: value(`${prefixo}-age`),
          guidedClass: value(`${prefixo}-class`),
          guidedRace: value(`${prefixo}-race`),
          guidedLevel: value(`${prefixo}-level`),
          guidedClan: value(`${prefixo}-clan`),
          guidedGeneration: value(`${prefixo}-generation`),
          guidedPredator: value(`${prefixo}-predator`)
        };
        const dndGuidedFieldNames: Record<string, string> = {
          'guided-dnd-player': 'playerName',
          'guided-dnd-class': 'class',
          'guided-dnd-level': 'level',
          'guided-dnd-race': 'race',
          'guided-dnd-background': 'background',
          'guided-dnd-alignment': 'alignment',
          'guided-dnd-xp': 'experiencePoints',
          'guided-dnd-str': 'strength',
          'guided-dnd-dex': 'dexterity',
          'guided-dnd-con': 'constitution',
          'guided-dnd-int': 'intelligence',
          'guided-dnd-wis': 'wisdom',
          'guided-dnd-cha': 'charisma',
          'guided-dnd-current-hp': 'currentHitPoints',
          'guided-dnd-max-hp': 'maxHitPoints',
          'guided-dnd-ac': 'armorClass',
          'guided-dnd-speed': 'speed',
          'guided-dnd-attacks': 'attacksAndSpellcasting',
          'guided-dnd-equipment': 'equipmentAndTreasure',
          'guided-dnd-goal': 'guidedGoal',
          'guided-dnd-story': 'historyAlliesOrganizations'
        };
        const dndNumericFields = new Set([
          'level', 'experiencePoints', 'strength', 'dexterity', 'constitution', 'intelligence',
          'wisdom', 'charisma', 'currentHitPoints', 'maxHitPoints', 'armorClass'
        ]);
        let invalidGuidedDndNumber = false;
        guidedForm.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach(input => {
          if (input.id === 'guided-system' || input.id === 'guided-destination' || input.id === `${prefixo}-name`) return;
          if (!input.id.startsWith(`${prefixo}-`)) return;
          const value = input.value.trim();
          if (!value) return;
          const key = sistema === 'D&D' ? dndGuidedFieldNames[input.id] || input.id : input.id;
          if (sistema === 'D&D' && dndNumericFields.has(key)) {
            const numericValue = Number(value);
            if (!Number.isSafeInteger(numericValue) || (key === 'level' && numericValue < 1)) {
              this.showToast(key === 'level'
                ? 'O nível deve ser um número inteiro maior ou igual a 1.'
                : `O campo ${key} deve ser um número inteiro válido.`);
              invalidGuidedDndNumber = true;
              return;
            }
            dados[key] = numericValue;
          } else {
            dados[key] = value;
          }
        });
        if (invalidGuidedDndNumber) return;
        const novaFicha: SistemaPasta = {
          id: crypto.randomUUID(),
          nome,
          tipo: 'ficha',
          sistema,
          descricao: dados.guidedConcept?.toString() || '',
          parentId: destination,
          dataCriacao: new Date().toLocaleDateString('pt-BR'),
          dados
        };
        this.sistemaItens.push(novaFicha);
        this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
        this.updateCharacterSelector();
        this.criandoFichaGuiada = false;
        this.criandoFichaSistema = false;
        this.fichaSistemaEmEdicaoId = novaFicha.id;
        this.sistemaFichaEmCriacao = null;
        this.showToast('Ficha criada. Continue preenchendo os detalhes na mesma ficha.');
        this.renderCurrentView();
      });
      return;
    }

    const inlineForm = document.getElementById('form-ficha-inline') as HTMLFormElement | null;
    if (inlineForm) {
      this.bindDerivedValueUpdates(inlineForm, 'call-of-cthulhu', 'inline-coc');
      this.bindDerivedValueUpdates(inlineForm, 'vampiro-a-mascara', 'inline-vampire');
      bindDndAttributeCards(inlineForm);

      const setFieldValue = (id: string, value: number): void => {
        const field = document.getElementById(id) as HTMLInputElement | null;
        if (field) field.value = String(value);
      };
      const rollDndAttributes = () => {
        const values = Array.from({ length: 6 }, () => {
          const rolls = Array.from({ length: 4 }, () => DiceService.sortearNumero(1, 6)).sort((a, b) => a - b);
          return rolls.slice(1).reduce((sum, value) => sum + value, 0);
        });
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((attribute, index) => setFieldValue(`inline-dnd-${attribute}`, values[index]));
        inlineForm.querySelectorAll<HTMLInputElement>('.dnd-attribute-score-row input').forEach(input => {
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        this.showToast(`D&D: atributos rolados com 4d6, descartando o menor: ${values.join(', ')}.`);
      };
      const rollCocAttributes = async () => {
        try {
          await this.generateCharacterAttributes('call-of-cthulhu', '7a-edicao', 'inline-coc');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível gerar os atributos.');
        }
      };
      const distributeVampireAttributes = async () => {
        try {
          await this.generateCharacterAttributes('vampiro-a-mascara', 'v5', 'inline-vampire');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível gerar os atributos.');
        }
      };
      document.getElementById('btn-roll-dnd-attributes')?.addEventListener('click', rollDndAttributes);
      document.getElementById('btn-roll-coc-attributes')?.addEventListener('click', rollCocAttributes);
      document.getElementById('btn-roll-vampire-attributes')?.addEventListener('click', distributeVampireAttributes);

      document.getElementById('btn-cancel-ficha-inline')?.addEventListener('click', () => {
        if (formHasChanges(inlineForm) && !window.confirm('Descartar as alterações não salvas?')) return;
        const cancelCreation = this.criandoFichaSistema && !this.fichaSistemaEmEdicaoId;
        this.fichaSistemaEmEdicaoId = null;
        this.criandoFichaSistema = cancelCreation;
        this.criandoFichaGuiada = false;
        this.sistemaFichaEmCriacao = null;
        this.renderCurrentView();
      });

      inlineForm.addEventListener('submit', event => {
        event.preventDefault();
        const isNewCharacter = this.criandoFichaSistema && !this.fichaSistemaEmEdicaoId;
        if (
          document.getElementById('inline-vampire-strength')
          && !this.validateVampireAttributeDistribution('inline-vampire', isNewCharacter)
        ) return;
        if (
          document.getElementById('inline-coc-str')
          && !this.validateCocAttributes('inline-coc', isNewCharacter)
        ) return;
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destinationId = value('inline-ficha-destination');
        const destination = this.sistemaItens.find(item => item.id === destinationId && item.tipo === 'pasta');
        if (!destination) {
          this.showToast('Escolha uma pasta válida para salvar a ficha.');
          return;
        }
        const fichaAtual = this.fichaSistemaEmEdicaoId
          ? this.sistemaItens.find(item => item.id === this.fichaSistemaEmEdicaoId)
          : undefined;
        const selectedSystem = fichaAtual?.sistema || this.sistemaFichaEmCriacao;
        const sheetName = (document.getElementById('inline-ficha-name') as HTMLInputElement | null)?.value.trim();
        if (selectedSystem !== 'D&D' && !sheetName) {
          this.showToast('Informe o nome do personagem para continuar.');
          inlineForm.querySelector<HTMLButtonElement>('[data-required-panel]')?.click();
          document.getElementById('inline-ficha-name')?.focus();
          return;
        }
        const preserveExistingFields = Boolean(fichaAtual && fichaAtual.sistema !== 'D&D');
        const dados: Record<string, string | number> = preserveExistingFields
          ? { ...(fichaAtual?.dados || {}) }
          : {};
        const dndFieldNames: Record<string, string> = {
          'inline-dnd-player': 'playerName',
          'inline-dnd-class': 'class',
          'inline-dnd-level': 'level',
          'inline-dnd-race': 'race',
          'inline-dnd-background': 'background',
          'inline-dnd-alignment': 'alignment',
          'inline-dnd-xp': 'experiencePoints',
          'inline-dnd-goal': 'guidedGoal',
          'inline-dnd-str': 'strength',
          'inline-dnd-dex': 'dexterity',
          'inline-dnd-con': 'constitution',
          'inline-dnd-int': 'intelligence',
          'inline-dnd-wis': 'wisdom',
          'inline-dnd-cha': 'charisma',
          'inline-dnd-ac': 'armorClass',
          'inline-dnd-initiative': 'initiative',
          'inline-dnd-speed': 'speed',
          'inline-dnd-hp': 'maxHitPoints',
          'inline-dnd-current-hp': 'currentHitPoints',
          'inline-dnd-temp-hp': 'temporaryHitPoints',
          'inline-dnd-hit-dice': 'hitDice',
          'inline-dnd-proficiency': 'proficiencyBonus',
          'inline-dnd-skills': 'skillsAndSavingThrows',
          'inline-dnd-attacks': 'attacksAndSpellcasting',
          'inline-dnd-equipment': 'equipmentAndTreasure',
          'inline-dnd-spells': 'spellsAndSlots',
          'inline-dnd-personality': 'personalityIdealsBondsFlaws',
          'inline-dnd-backstory': 'historyAlliesOrganizations'
        };
        const dndNumericFields = new Set([
          'level', 'experiencePoints', 'strength', 'dexterity', 'constitution',
          'intelligence', 'wisdom', 'charisma', 'armorClass', 'maxHitPoints',
          'currentHitPoints', 'temporaryHitPoints'
        ]);
        let invalidDndNumber = false;
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('#form-ficha-inline input, #form-ficha-inline textarea, #form-ficha-inline select').forEach(input => {
          if (input.id === 'inline-ficha-name' || input.id === 'inline-ficha-description') return;
          const value = input.value.trim();
          const isDndSheet = (fichaAtual?.sistema || this.sistemaFichaEmCriacao) === 'D&D';
          const key = isDndSheet
            ? dndFieldNames[input.id] || input.id.replace(/^inline-/, '')
            : input.id.replace(/^inline-/, '');
          if (!value) {
            const hadValue = input instanceof HTMLSelectElement
              ? Array.from(input.options).some(option => option.defaultSelected && option.value)
              : input.defaultValue.trim() !== '';
            if (preserveExistingFields && hadValue) dados[key] = '';
            return;
          }
          if (isDndSheet && dndNumericFields.has(key)) {
            const numericValue = Number(value);
            if (!Number.isSafeInteger(numericValue) || (key === 'level' && numericValue < 1)) {
              this.showToast(key === 'level'
                ? 'O nível deve ser um número inteiro maior ou igual a 1.'
                : `O campo ${key} deve ser um número inteiro válido.`);
              invalidDndNumber = true;
              return;
            }
            dados[key] = numericValue;
          } else {
            dados[key] = value;
          }
        });
        if (invalidDndNumber) return;

        let fichaSalva: SistemaPasta;
        if (fichaAtual) {
          fichaAtual.nome = value('inline-ficha-name') || fichaAtual.nome;
          fichaAtual.descricao = value('inline-ficha-description');
          fichaAtual.parentId = destination.id;
          fichaAtual.dados = dados;
          fichaSalva = fichaAtual;
        } else {
          fichaSalva = {
            id: crypto.randomUUID(),
            nome: value('inline-ficha-name') || 'Novo investigador',
            tipo: 'ficha',
            sistema: this.sistemaFichaEmCriacao || 'Call of Cthulhu',
            descricao: value('inline-ficha-description'),
            parentId: destination.id,
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            dados
          };
          this.sistemaItens.push(fichaSalva);
        }

        this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
        this.updateCharacterSelector();
        this.fichaSistemaEmEdicaoId = fichaSalva.id;
        this.criandoFichaSistema = false;
        this.sistemaFichaEmCriacao = null;
        this.showToast('Ficha salva com sucesso.');
        this.renderCurrentView();
      });
      return;
    }

    const modal = document.getElementById('modal-sistema-item');
    const form = document.getElementById('form-sistema-item') as HTMLFormElement | null;
    const itemIdInput = document.getElementById('sistema-item-id') as HTMLInputElement | null;
    const itemTypeInput = document.getElementById('sistema-item-type') as HTMLInputElement | null;
    const nameInput = document.getElementById('sistema-item-name') as HTMLInputElement | null;
    const descriptionInput = document.getElementById('sistema-item-description') as HTMLTextAreaElement | null;
    const folderDestinationGroup = document.getElementById('sistema-folder-destination-group');
    const folderDestinationSelect = document.getElementById('sistema-folder-destination') as HTMLSelectElement | null;
    const saveFolderButton = document.getElementById('btn-salvar-pasta');
    const modalTitle = document.getElementById('modal-sistema-title');

    const getFolderPath = (folder: SistemaPasta): string => {
      const path: string[] = [folder.nome];
      let parentId = folder.parentId;
      while (parentId) {
        const parent = this.sistemaItens.find(item => item.id === parentId && item.tipo === 'pasta');
        if (!parent) break;
        path.unshift(parent.nome);
        parentId = parent.parentId;
      }
      return path.join(' / ');
    };

    const isDescendant = (folderId: string, possibleAncestorId: string): boolean => {
      let parentId = this.sistemaItens.find(item => item.id === folderId)?.parentId || null;
      while (parentId) {
        if (parentId === possibleAncestorId) return true;
        parentId = this.sistemaItens.find(item => item.id === parentId)?.parentId || null;
      }
      return false;
    };

    const updateFolderDestinations = (selectedId: string | null, editingId = '') => {
      if (!folderDestinationSelect) return;
      const folders = this.sistemaItens.filter(folder =>
        folder.tipo === 'pasta' &&
        folder.id !== editingId &&
        !isDescendant(folder.id, editingId) &&
        (!this.folderApiAvailable || !/^\d+$/.test(editingId) || /^\d+$/.test(folder.id))
      );
      folderDestinationSelect.innerHTML = [
        '<option value="">🗂️ Sistemas (pasta raiz)</option>',
        ...folders.map(folder => `<option value="${folder.id}" ${folder.id === selectedId ? 'selected' : ''}>📁 ${this.escapeHtml(getFolderPath(folder))}</option>`)
      ].join('');
      if (selectedId && !folders.some(folder => folder.id === selectedId)) {
        folderDestinationSelect.value = '';
      }
    };

    const closeModal = () => modal?.classList.add('hidden');
    const openModal = (tipo: 'pasta', item?: SistemaPasta) => {
      if (itemIdInput) itemIdInput.value = item?.id || '';
      if (itemTypeInput) itemTypeInput.value = item?.tipo || tipo;
      if (nameInput) nameInput.value = item?.nome || '';
      if (descriptionInput) descriptionInput.value = item?.descricao || '';
      if (modalTitle) modalTitle.textContent = item ? `Editar ${item.tipo}` : `Nova ${tipo}`;
      if (saveFolderButton) saveFolderButton.textContent = item ? 'Salvar alterações' : 'Criar pasta';
      folderDestinationGroup?.classList.toggle('hidden', tipo !== 'pasta');
      if (tipo === 'pasta') {
        updateFolderDestinations(item?.parentId ?? this.pastaSistemaAtualId, item?.id || '');
      }
      modal?.classList.remove('hidden');
      nameInput?.focus();
    };

    document.getElementById('btn-close-sistema-modal')?.addEventListener('click', closeModal);
    modal?.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-open-sistema-item').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.dataset.id || null;
        this.pastaSistemaAtualId = id;
        this.fichaSistemaEmEdicaoId = null;
        this.criandoFichaSistema = false;
        this.criandoFichaGuiada = false;
        this.sistemaFichaEmCriacao = null;
        this.renderCurrentView();
      });
    });

    document.getElementById('btn-sistema-up')?.addEventListener('click', () => {
      const pastaAtual = this.sistemaItens.find(item => item.id === this.pastaSistemaAtualId);
      this.pastaSistemaAtualId = pastaAtual?.parentId || null;
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = false;
      this.criandoFichaGuiada = false;
      this.sistemaFichaEmCriacao = null;
      this.renderCurrentView();
    });

    document.getElementById('btn-new-sistema-folder')?.addEventListener('click', () => openModal('pasta'));
    document.getElementById('btn-new-sistema-sheet')?.addEventListener('click', () => {
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = true;
      this.sistemaFichaEmCriacao = null;
      this.renderCurrentView();
    });

    document.getElementById('btn-cancel-ficha-picker')?.addEventListener('click', () => {
      this.fichaSistemaEmEdicaoId = null;
      this.criandoFichaSistema = false;
      this.criandoFichaGuiada = false;
      this.sistemaFichaEmCriacao = null;
      this.renderCurrentView();
    });

    document.getElementById('btn-open-ficha-guided')?.addEventListener('click', () => {
      this.criandoFichaGuiada = true;
      this.criandoFichaSistema = false;
      this.renderCurrentView();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-select-sistema-inline').forEach(button => {
      button.addEventListener('click', () => {
        this.sistemaFichaEmCriacao = button.dataset.sistema || 'Call of Cthulhu';
        this.renderCurrentView();
      });
    });


    document.querySelectorAll<HTMLButtonElement>('.btn-edit-sistema-item').forEach(button => {
      button.addEventListener('click', () => {
        const item = this.sistemaItens.find(entry => entry.id === button.dataset.id);
        if (!item) return;
        if (item.tipo === 'ficha') {
          this.fichaSistemaEmEdicaoId = item.id;
          this.criandoFichaSistema = false;
          this.sistemaFichaEmCriacao = null;
          this.renderCurrentView();
        } else {
          openModal('pasta', item);
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-delete-sistema-item').forEach(button => {
      button.addEventListener('click', async () => {
        const item = this.sistemaItens.find(entry => entry.id === button.dataset.id);
        if (!item || !confirm(`Excluir ${item.tipo} "${item.nome}"?`)) return;

        if (item.tipo === 'pasta' && item.id.match(/^\d+$/) && this.authToken && this.folderApiAvailable) {
          try {
            await FolderService.excluir(item.id, this.authToken);
          } catch (error) {
            if (!(error instanceof TypeError)) {
              this.showToast(error instanceof Error ? error.message : 'Não foi possível excluir a pasta.');
              return;
            }
            this.folderApiAvailable = false;
            console.warn('API de pastas indisponível; a pasta será removida somente do armazenamento local.', error);
          }
        }

        const idsParaExcluir = new Set([item.id]);
        let encontrouFilho = true;
        while (encontrouFilho) {
          encontrouFilho = false;
          this.sistemaItens.forEach(entry => {
            if (entry.parentId && idsParaExcluir.has(entry.parentId) && !idsParaExcluir.has(entry.id)) {
              idsParaExcluir.add(entry.id);
              encontrouFilho = true;
            }
          });
        }

        this.sistemaItens = this.sistemaItens.filter(entry => !idsParaExcluir.has(entry.id));
        this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
        this.showToast(`${item.tipo === 'pasta' ? 'Pasta' : 'Ficha'} excluída.`);
        this.renderCurrentView();
      });
    });

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const nome = nameInput?.value.trim() || '';
      const descricao = descriptionInput?.value.trim() || '';
      const id = itemIdInput?.value || '';
      const tipo = itemTypeInput?.value as 'pasta' | 'ficha';
      const folderParentId = folderDestinationSelect?.value || null;
      const destinationFolder = folderParentId
        ? this.sistemaItens.find(item => item.id === folderParentId && item.tipo === 'pasta')
        : undefined;
      if (!nome) return;

      if (id) {
        const item = this.sistemaItens.find(entry => entry.id === id);
        if (item) {
          if (tipo === 'pasta' && item.id.match(/^\d+$/) && this.authToken && this.folderApiAvailable) {
            try {
              const updated = await FolderService.atualizar(item.id, nome, folderParentId, this.authToken);
              item.id = updated.id;
              item.parentId = updated.parentId;
            } catch (error) {
              if (!(error instanceof TypeError)) {
                this.showToast(error instanceof Error ? error.message : 'Não foi possível salvar a pasta.');
                return;
              }
              this.folderApiAvailable = false;
              console.warn('API de pastas indisponível; a alteração será mantida localmente.', error);
            }
          }
          item.nome = nome;
          item.descricao = descricao;
          if (tipo === 'pasta') {
            item.parentId = folderParentId;
            item.sistema = destinationFolder?.sistema || item.sistema;
          }
        }
      } else {
        let folderId: string = crypto.randomUUID();
        let parentId = tipo === 'pasta' ? folderParentId : this.pastaSistemaAtualId;
        if (tipo === 'pasta' && this.authToken && this.folderApiAvailable && (!folderParentId || /^\d+$/.test(folderParentId))) {
          try {
            const created = await FolderService.criar(nome, folderParentId, this.authToken);
            folderId = created.id;
            parentId = created.parentId;
          } catch (error) {
            if (!(error instanceof TypeError)) {
              this.showToast(error instanceof Error ? error.message : 'Não foi possível criar a pasta.');
              return;
            }
            this.folderApiAvailable = false;
            console.warn('API de pastas indisponível; a pasta será criada localmente.', error);
          }
        }
        this.sistemaItens.push({
          id: folderId,
          nome,
          tipo,
          sistema: destinationFolder?.sistema || 'Personalizado',
          descricao,
          parentId,
          dataCriacao: new Date().toLocaleDateString('pt-BR')
        });
      }

      this.persistStorage(StorageService.salvarSistemaPastas(this.sistemaItens));
      closeModal();
      this.showToast(`${tipo === 'pasta' ? 'Pasta' : 'Ficha'} salva com sucesso.`);
      this.renderCurrentView();
    });
  }

  /* ================= FICHA EVENTS ================= */
  private bindFichaEvents(): void {
    const p = this.personagemAtivo;
    if (!p) {
      document.getElementById('btn-goto-wizard')?.addEventListener('click', () => this.switchTab('wizard'));
      return;
    }

    // Subir nível
    document.getElementById('btn-subir-nivel')?.addEventListener('click', () => {
      p.subirNivel();
      void this.persistirPersonagens(p);
      this.showToast(`⭐ Parabéns! ${p.nomePersonagem} alcançou o Nível ${p.nivel}! PV Máximo aumentado.`);
      this.renderCurrentView();
    });

    // Excluir Personagem
    document.getElementById('btn-excluir-personagem')?.addEventListener('click', () => {
      if (confirm(`Deseja realmente excluir a ficha de ${p.nomePersonagem}?`)) {
        this.personagens = this.personagens.filter(item => item.idPersonagem !== p.idPersonagem);
        this.jogador.removerPersonagem(p.idPersonagem);
        void this.persistirPersonagens();
        void this.excluirPersonagemNoBackend(p.backendId);
        this.personagemAtivoId = this.personagens[0]?.idPersonagem || null;
        this.updateCharacterSelector();
        this.showToast(`Personagem excluído com sucesso.`);
        this.renderCurrentView();
      }
    });

    // Ajuste de PV (+/-)
    document.querySelectorAll('.btn-hp-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        p.atualizarVida(delta);
        void this.persistirPersonagens(p);
        this.renderCurrentView();
      });
    });

    // Ajuste de Mana (+/-)
    document.querySelectorAll('.btn-mana-adjust').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.getAttribute('data-delta') || '0', 10);
        p.pontosMana = Math.max(0, Math.min(p.pontosManaMax, p.pontosMana + delta));
        void this.persistirPersonagens(p);
        this.renderCurrentView();
      });
    });

    // Adicionar XP
    document.querySelectorAll('.btn-xp-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const xp = parseInt(btn.getAttribute('data-xp') || '0', 10);
        const subiu = p.adicionarXP(xp);
        void this.persistirPersonagens(p);
        if (subiu) {
          this.showToast(`⭐ ${p.nomePersonagem} acumulou XP suficiente e subiu para o Nível ${p.nivel}!`);
        } else {
          this.showToast(`+${xp} XP adicionados.`);
        }
        this.renderCurrentView();
      });
    });

    // Rolagem rápida ao clicar no box do atributo
    document.querySelectorAll('.btn-roll-attr').forEach(box => {
      box.addEventListener('click', () => {
        const attr = box.getAttribute('data-attr') || 'Atributo';
        const mod = parseInt(box.getAttribute('data-mod') || '0', 10);
        this.executarRolagemD20(`Teste de ${attr.toUpperCase()}`, mod, p.nomePersonagem);
      });
    });

    // Botões de atalho para Inventário / Magias completos
    document.getElementById('btn-goto-inventario-full')?.addEventListener('click', () => this.switchTab('inventario'));
    document.getElementById('btn-goto-magias-full')?.addEventListener('click', () => this.switchTab('magias'));
  }

  /* ================= WIZARD EVENTS ================= */
  private bindWizardEvents(): void {
    const btnNext = document.getElementById('btn-wizard-next') as HTMLButtonElement;
    const btnPrev = document.getElementById('btn-wizard-prev') as HTMLButtonElement;
    const btnFinish = document.getElementById('btn-wizard-finish') as HTMLButtonElement;

    const racaSelect = document.getElementById('w-raca') as HTMLSelectElement;
    const classeSelect = document.getElementById('w-classe') as HTMLSelectElement;
    const bonusText = document.getElementById('w-bonus-text');

    const updateBonusPreview = () => {
      if (bonusText && racaSelect && classeSelect) {
        bonusText.innerHTML = `
          <strong>Raça ${racaSelect.value}:</strong> Aplica modificadores raciais e traços biológicos.<br/>
          <strong>Classe ${classeSelect.value}:</strong> Define o Dado de Vida básico, equipamentos iniciais e competências arcanas/marciais.
        `;
      }
    };

    racaSelect?.addEventListener('change', updateBonusPreview);
    classeSelect?.addEventListener('change', updateBonusPreview);
    updateBonusPreview();

    btnNext?.addEventListener('click', () => {
      if (this.wizardStep === 1) {
        const nome = (document.getElementById('w-nome') as HTMLInputElement)?.value.trim();
        if (!nome) {
          alert('Por favor, informe o nome do personagem.');
          return;
        }
        this.wizardStep = 2;
      } else if (this.wizardStep === 2) {
        this.wizardStep = 3;
      } else if (this.wizardStep === 3) {
        // Validação dos atributos informados pelo jogador.
        const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
        const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
        const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
        const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
        const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
        const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

        const atributos = [forca, destreza, constituicao, inteligencia, sabedoria, carisma];
        const invalidos = atributos.some(val => isNaN(val) || val < 8 || val > 18);

        const errBox = document.getElementById('w-attr-error');
        if (invalidos) {
          errBox?.classList.remove('hidden');
          return;
        }
        errBox?.classList.add('hidden');

        // Gerar resumo no Passo 4
        this.wizardStep = 4;
        this.generateWizardSummary();
      }

      this.updateWizardStepUI();
    });

    btnPrev?.addEventListener('click', () => {
      if (this.wizardStep > 1) {
        this.wizardStep--;
        this.updateWizardStepUI();
      }
    });

    btnFinish?.addEventListener('click', () => {
      const nome = (document.getElementById('w-nome') as HTMLInputElement).value.trim();
      const sistema = (document.getElementById('w-sistema') as HTMLSelectElement).value;
      const raca = (document.getElementById('w-raca') as HTMLSelectElement).value;
      const classe = (document.getElementById('w-classe') as HTMLSelectElement).value;

      const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
      const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
      const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
      const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
      const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
      const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

      const novo = new Personagem(nome, classe, raca, sistema, {
        forca, destreza, constituicao, inteligencia, sabedoria, carisma
      });

      // Itens iniciais padrão
      novo.inventario.adicionarItem(new Item('Mochila de Aventureiro', 2.0, 1));
      novo.inventario.adicionarItem(new Item('Cantil de Água', 1.0, 1));
      novo.inventario.adicionarItem(new Item('Adaga Curta', 0.5, 1));

      this.personagens.push(novo);
      this.jogador.adicionarPersonagem(novo);
      void this.persistirPersonagens();
      void this.criarPersonagemNoBackend(novo);

      this.personagemAtivoId = novo.idPersonagem;
      this.updateCharacterSelector();
      this.showToast(`✨ Personagem "${novo.nomePersonagem}" criado com sucesso!`);
      this.switchTab('personagens');
    });
  }

  private updateWizardStepUI(): void {
    for (let i = 1; i <= 4; i++) {
      const panel = document.getElementById(`wizard-step-${i}`);
      const stepItem = document.querySelector(`.step-item[data-step="${i}"]`);

      if (panel) {
        panel.classList.toggle('hidden', i !== this.wizardStep);
      }
      if (stepItem) {
        stepItem.classList.toggle('active', i === this.wizardStep);
        stepItem.classList.toggle('completed', i < this.wizardStep);
      }
    }

    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnFinish = document.getElementById('btn-wizard-finish');

    if (btnPrev) btnPrev.classList.toggle('hidden', this.wizardStep === 1);
    if (btnNext) btnNext.classList.toggle('hidden', this.wizardStep === 4);
    if (btnFinish) btnFinish.classList.toggle('hidden', this.wizardStep !== 4);
  }

  private generateWizardSummary(): void {
    const summaryBox = document.getElementById('w-summary-box');
    if (!summaryBox) return;

    const nome = (document.getElementById('w-nome') as HTMLInputElement).value;
    const sistema = (document.getElementById('w-sistema') as HTMLSelectElement).value;
    const raca = (document.getElementById('w-raca') as HTMLSelectElement).value;
    const classe = (document.getElementById('w-classe') as HTMLSelectElement).value;

    const forca = parseInt((document.getElementById('w-forca') as HTMLInputElement).value, 10);
    const destreza = parseInt((document.getElementById('w-destreza') as HTMLInputElement).value, 10);
    const constituicao = parseInt((document.getElementById('w-constituicao') as HTMLInputElement).value, 10);
    const inteligencia = parseInt((document.getElementById('w-inteligencia') as HTMLInputElement).value, 10);
    const sabedoria = parseInt((document.getElementById('w-sabedoria') as HTMLInputElement).value, 10);
    const carisma = parseInt((document.getElementById('w-carisma') as HTMLInputElement).value, 10);

    const temp = new Personagem(nome, classe, raca, sistema, {
      forca, destreza, constituicao, inteligencia, sabedoria, carisma
    });
    const mods = temp.calcularModificadores();

    summaryBox.innerHTML = `
      <div style="margin-bottom: 14px;">
        <h3 style="font-family: var(--font-title); color: #fde047;">${temp.nomePersonagem}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">${temp.raca} ${temp.classe} • Sistema: ${temp.sistema}</p>
      </div>

      <div class="grid-3" style="margin-bottom: 16px;">
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">PV CALCULADO</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #ef4444;">❤️ ${temp.pontosVidaMax}</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">CA CALCULADA</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #60a5fa;">🛡️ ${temp.ca}</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">LIMITE DE CARGA</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: #34d399;">🎒 ${temp.inventario.limiteCarga} kg</div>
        </div>
      </div>

      <h5 style="color: #818cf8; margin-bottom: 8px;">Atributos e Modificadores Derivados:</h5>
      <div class="attr-grid" style="margin-bottom: 12px;">
        <div class="attr-box"><div class="attr-name">FOR</div><div class="attr-value">${forca}</div><div class="attr-mod">${mods.forca >= 0 ? '+' : ''}${mods.forca}</div></div>
        <div class="attr-box"><div class="attr-name">DES</div><div class="attr-value">${destreza}</div><div class="attr-mod">${mods.destreza >= 0 ? '+' : ''}${mods.destreza}</div></div>
        <div class="attr-box"><div class="attr-name">CON</div><div class="attr-value">${constituicao}</div><div class="attr-mod">${mods.constituicao >= 0 ? '+' : ''}${mods.constituicao}</div></div>
        <div class="attr-box"><div class="attr-name">INT</div><div class="attr-value">${inteligencia}</div><div class="attr-mod">${mods.inteligencia >= 0 ? '+' : ''}${mods.inteligencia}</div></div>
        <div class="attr-box"><div class="attr-name">SAB</div><div class="attr-value">${sabedoria}</div><div class="attr-mod">${mods.sabedoria >= 0 ? '+' : ''}${mods.sabedoria}</div></div>
        <div class="attr-box"><div class="attr-name">CAR</div><div class="attr-value">${carisma}</div><div class="attr-mod">${mods.carisma >= 0 ? '+' : ''}${mods.carisma}</div></div>
      </div>
    `;
  }

  /* ================= INVENTÁRIO EVENTS ================= */
  private bindInventarioEvents(): void {
    const p = this.personagemAtivo;
    if (!p) return;

    const modal = document.getElementById('modal-add-item');
    document.getElementById('btn-add-item-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-item-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-novo-item')?.addEventListener('click', () => {
      const nome = (document.getElementById('item-nome') as HTMLInputElement)?.value.trim();
      const peso = parseFloat((document.getElementById('item-peso') as HTMLInputElement)?.value || '0');
      const qtd = parseInt((document.getElementById('item-qtd') as HTMLInputElement)?.value || '1', 10);

      if (!nome) {
        alert('Informe o nome do item.');
        return;
      }

      p.inventario.adicionarItem(new Item(nome, peso, qtd));
      void this.persistirPersonagens(p);
      modal?.classList.add('hidden');
      this.showToast(`Item "${nome}" adicionado ao inventário.`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id && p.inventario.removerItem(id)) {
          void this.persistirPersonagens(p);
          this.showToast('Item removido do inventário.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= MAGIAS EVENTS ================= */
  private bindMagiasEvents(): void {
    const p = this.personagemAtivo;
    if (!p) return;

    const modal = document.getElementById('modal-add-spell');
    document.getElementById('btn-add-spell-modal')?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
    });

    document.getElementById('btn-close-spell-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-nova-magia')?.addEventListener('click', () => {
      const nome = (document.getElementById('spell-nome') as HTMLInputElement)?.value.trim();
      const mana = parseInt((document.getElementById('spell-mana') as HTMLInputElement)?.value || '0', 10);
      const tempo = (document.getElementById('spell-tempo') as HTMLInputElement)?.value.trim() || '1 Ação';
      const efeito = (document.getElementById('spell-efeito') as HTMLTextAreaElement)?.value.trim();

      if (!nome || !efeito) {
        alert('Preencha o nome e a descrição do efeito da magia.');
        return;
      }

      p.magiasHabilidades.push(new MagiaHabilidade(nome, mana, tempo, efeito));
      void this.persistirPersonagens(p);
      modal?.classList.add('hidden');
      this.showToast(`Habilidade "${nome}" cadastrada com sucesso.`);
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-spell').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          p.magiasHabilidades = p.magiasHabilidades.filter(m => m.id !== id);
          void this.persistirPersonagens(p);
          this.showToast('Habilidade removida.');
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= DADOS EVENTS ================= */
  private bindDadosEvents(): void {
    const p = this.personagemAtivo;

    document.getElementById('dice-sheet-select')?.addEventListener('change', event => {
      const selected = (event.target as HTMLSelectElement).value;
      this.fichaRolagemSelecionadaId = selected === 'legacy' ? null : selected || null;
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-roll-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const attr = btn.getAttribute('data-attr') || 'Atributo';
        const valor = parseInt(btn.getAttribute('data-value') || '0', 10);
        const sistema = btn.getAttribute('data-system') || 'D&D';
        const nome = this.fichaRolagemSelecionadaId
          ? this.sistemaItens.find(ficha => ficha.id === this.fichaRolagemSelecionadaId)?.nome
          : p?.nomePersonagem;
        if (sistema === 'Call of Cthulhu') {
          const resultado = DiceService.rolarGenerico(100, 1, 0);
          this.showToast(`🎲 ${attr}: d100(${resultado.total}) contra ${valor}%.`);
        } else if (sistema === 'Vampiro: A Máscara') {
          const resultado = DiceService.rolarGenerico(10, Math.max(1, valor), 0);
          this.showToast(`🎲 ${attr}: ${valor}d10 = ${resultado.dados.join(', ')} | Sucessos: ${resultado.dados.filter(dado => dado >= 6).length}.`);
        } else {
          const modificador = Math.floor((valor - 10) / 2);
          this.executarRolagemD20(`Teste de ${attr}`, modificador, nome);
        }
      });
    });

    document.querySelectorAll('.btn-roll-dice').forEach(btn => {
      btn.addEventListener('click', () => {
        const sides = parseInt(btn.getAttribute('data-sides') || '20', 10);
        if (sides === 20) {
          this.executarRolagemD20('d20 Puro', 0, p?.nomePersonagem);
        } else {
          const resultado = DiceService.rolarGenerico(sides, 1, 0);
          this.showToast(`🎲 Rolagem d${sides}: Resultado = ${resultado.total}`);
        }
      });
    });

    document.getElementById('btn-limpar-historico-dados')?.addEventListener('click', () => {
      this.historicoDados = [];
      this.persistStorage(StorageService.salvarHistoricoDados(this.historicoDados));
      this.renderCurrentView();
    });
  }

  private executarRolagemD20(rotulo: string, mod: number, nomePers?: string): void {
    const res = DiceService.rolarD20(rotulo, mod, nomePers);
    this.historicoDados.unshift(res);
    this.persistStorage(StorageService.salvarHistoricoDados(this.historicoDados));

    // Modal Popup com Animação
    const modal = document.getElementById('dice-modal');
    const modalBody = document.getElementById('dice-modal-body');

    if (modal && modalBody) {
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 20px 10px;">
          <div style="font-size: 0.9rem; color: var(--text-muted);">${res.periciaOuAtributo} ${res.nomePersonagem ? `(${res.nomePersonagem})` : ''}</div>
          <div style="font-family: var(--font-mono); font-size: 3.5rem; font-weight: 900; margin: 12px 0; color: ${
            res.tipoResultado === 'critico' ? 'var(--gold)' :
            res.tipoResultado === 'falha' ? 'var(--danger)' : 'white'
          }; text-shadow: 0 0 25px ${
            res.tipoResultado === 'critico' ? 'var(--gold-glow)' :
            res.tipoResultado === 'falha' ? 'var(--danger)' : 'var(--primary-glow)'
          };">
            ${res.total}
          </div>

          <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">
            ${res.tipoResultado === 'critico' ? '🌟 ACERTO CRÍTICO! (Natural 20)' :
              res.tipoResultado === 'falha' ? '💀 FALHA CRÍTICA! (Natural 1)' : 'Rolagem Normal'}
          </div>

          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm); display: inline-block;">
            ${res.detalheCalculo}
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
    }

    if (this.currentTab === 'dados') {
      this.renderCurrentView();
    }
  }

  private async loadPlayerCampaignAccess(): Promise<void> {
    if (!this.authToken) return;
    this.playerCampaignAccessLoading = true;
    if (this.currentTab === 'campaign-access') this.renderCurrentView();
    try {
      await this.carregarCampanhasBackend();
      const [invitations, requests] = await Promise.all([
        CampaignService.meusConvites(this.authToken),
        CampaignService.minhasSolicitacoes(this.authToken)
      ]);
      this.playerCampaignInvitations = invitations;
      this.playerCampaignRequests = requests;
      if (this.currentTab === 'campaign-access') this.renderCurrentView();
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Não foi possível carregar convites e solicitações.');
    } finally {
      this.playerCampaignAccessLoading = false;
      if (this.currentTab === 'campaign-access') this.renderCurrentView();
    }
  }

  private async loadFriendshipData(): Promise<void> {
    if (!this.authToken) {
      this.friendshipError = 'Entre na sua conta para usar as amizades.';
      this.friendshipData = null;
      this.friendshipFriends = [];
      this.renderCurrentView();
      return;
    }
    this.friendshipLoading = true;
    this.friendshipError = null;
    this.renderCurrentView();
    try {
      const friendships = await FriendshipService.list(this.authToken);
      this.friendshipData = friendships;
      this.friendshipFriends = friendships.friends;
    } catch (error) {
      this.friendshipError = error instanceof Error
        ? error.message
        : 'Não foi possível carregar as amizades.';
    } finally {
      this.friendshipLoading = false;
      if (this.currentTab === 'friendships') this.renderCurrentView();
    }
  }

  private async searchFriendshipUsers(username: string): Promise<void> {
    if (!this.authToken) return;
    this.friendshipSearchTerm = username.trim();
    this.friendshipSearchResults = [];
    this.friendshipMessage = null;
    this.friendshipError = null;
    this.friendshipLoading = true;
    this.renderCurrentView();
    try {
      this.friendshipSearchResults = await FriendshipService.search(
        this.friendshipSearchTerm,
        this.authToken
      );
    } catch (error) {
      this.friendshipError = error instanceof Error
        ? error.message
        : 'Não foi possível pesquisar usuários.';
    } finally {
      this.friendshipLoading = false;
      if (this.currentTab === 'friendships') this.renderCurrentView();
    }
  }

  private bindFriendshipEvents(): void {
    document.querySelector<HTMLFormElement>('.friendship-search-form')
      ?.addEventListener('submit', event => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const username = String(new FormData(form).get('username') || '').trim();
        if (username) void this.searchFriendshipUsers(username);
      });

    document.querySelectorAll<HTMLButtonElement>('.btn-send-friend-request')
      .forEach(button => button.addEventListener('click', async () => {
        const recipientId = button.dataset.userId;
        if (!recipientId || !this.authToken) return;
        button.disabled = true;
        try {
          await FriendshipService.sendRequest(recipientId, this.authToken);
          this.friendshipMessage = 'Solicitação de amizade enviada.';
          await this.loadFriendshipData();
          if (this.friendshipSearchTerm) {
            this.friendshipSearchResults = await FriendshipService.search(
              this.friendshipSearchTerm,
              this.authToken
            );
          }
        } catch (error) {
          this.friendshipError = error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.';
        } finally {
          if (this.currentTab === 'friendships') this.renderCurrentView();
        }
      }));

    document.querySelectorAll<HTMLButtonElement>('.btn-respond-friend-request')
      .forEach(button => button.addEventListener('click', async () => {
        const requestId = button.dataset.id;
        const action = button.dataset.action;
        if (!requestId || (action !== 'accept' && action !== 'reject') || !this.authToken) return;
        button.disabled = true;
        try {
          await FriendshipService.respond(requestId, action, this.authToken);
          this.friendshipMessage = action === 'accept' ? 'Solicitação aceita.' : 'Solicitação recusada.';
          await this.loadFriendshipData();
        } catch (error) {
          this.friendshipError = error instanceof Error ? error.message : 'Não foi possível responder à solicitação.';
        } finally {
          if (this.currentTab === 'friendships') this.renderCurrentView();
        }
      }));

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-friend')
      .forEach(button => button.addEventListener('click', async () => {
        const friendshipId = button.dataset.id;
        if (!friendshipId || !this.authToken
          || !confirm('Remover esta amizade?')) return;
        button.disabled = true;
        try {
          await FriendshipService.remove(friendshipId, this.authToken);
          this.friendshipMessage = 'Amizade removida.';
          await this.loadFriendshipData();
          if (this.friendshipSearchTerm) {
            this.friendshipSearchResults = await FriendshipService.search(
              this.friendshipSearchTerm,
              this.authToken
            );
          }
        } catch (error) {
          this.friendshipError = error instanceof Error ? error.message : 'Não foi possível remover a amizade.';
        } finally {
          if (this.currentTab === 'friendships') this.renderCurrentView();
        }
      }));
  }

  private async previewPlayerInvite(code: string): Promise<void> {
    if (!this.authToken) return;
    this.playerInviteCode = code.trim();
    this.playerInviteRequestSent = false;
    try {
      this.playerInvitePreview = await CampaignService.visualizarCodigoConvite(
        this.playerInviteCode,
        this.authToken
      );
      if (this.currentTab === 'campaign-access') this.renderCurrentView();
    } catch (error) {
      this.playerInvitePreview = null;
      this.showToast(error instanceof Error ? error.message : 'Código de convite inválido.');
      if (this.currentTab === 'campaign-access') this.renderCurrentView();
    }
  }

  private bindPlayerCampaignAccessEvents(): void {
    const form = document.getElementById('form-campaign-join-code') as HTMLFormElement | null;
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const code = String(new FormData(form).get('code') || '').trim();
      this.playerInviteCode = code;
      void this.previewPlayerInvite(code);
    });

    document.getElementById('btn-request-campaign-join')?.addEventListener('click', async () => {
      if (!this.authToken || !this.playerInviteCode) return;
      try {
        await CampaignService.solicitarParticipacao(this.playerInviteCode, this.authToken);
        this.playerInvitePreview = null;
        this.playerInviteRequestSent = true;
        this.showToast('Solicitação enviada. Aguarde a aprovação do Mestre.');
        await this.loadPlayerCampaignAccess();
      } catch (error) {
        this.showToast(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.');
      }
      if (this.currentTab === 'campaign-access') this.renderCurrentView();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-respond-campaign-invitation').forEach(button => {
      button.addEventListener('click', async () => {
        const invitationId = button.dataset.invitationId;
        const action = button.dataset.action;
        if (!invitationId || !this.authToken || (action !== 'accept' && action !== 'decline')) return;
        const confirmation = action === 'accept'
          ? 'Aceitar o convite e entrar nesta campanha?'
          : 'Recusar este convite?';
        if (!confirm(confirmation)) return;
        button.disabled = true;
        try {
          await CampaignService.responderConvite(invitationId, action, this.authToken);
          if (action === 'accept') await this.carregarCampanhasBackend();
          this.showToast(action === 'accept' ? 'Convite aceito.' : 'Convite recusado.');
          await this.loadPlayerCampaignAccess();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível responder ao convite.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-cancel-campaign-request').forEach(button => {
      button.addEventListener('click', async () => {
        const requestId = button.dataset.requestId;
        if (!requestId || !this.authToken) return;
        if (!confirm('Cancelar esta solicitação de participação?')) return;
        button.disabled = true;
        try {
          await CampaignService.cancelarSolicitacao(requestId, this.authToken);
          await this.loadPlayerCampaignAccess();
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível cancelar a solicitação.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.getElementById('btn-scan-campaign-qr')?.addEventListener('click', () => {
      void this.startPlayerQrScanner();
    });
    document.getElementById('btn-stop-campaign-qr')?.addEventListener('click', () => {
      void this.stopPlayerQrScanner();
    });
  }

  private async startPlayerQrScanner(): Promise<void> {
    const reader = document.getElementById('campaign-qr-reader');
    const closeButton = document.getElementById('btn-stop-campaign-qr');
    if (!reader || this.playerQrScanner) return;
    reader.classList.remove('hidden');
    closeButton?.classList.remove('hidden');
    let scanner: Html5QrcodeType | null = null;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (this.currentTab !== 'campaign-access' || reader.classList.contains('hidden')) {
        return;
      }
      scanner = new Html5Qrcode('campaign-qr-reader');
      this.playerQrScanner = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        decodedText => {
          void (async () => {
            await this.stopPlayerQrScanner();
            await this.previewPlayerInvite(decodedText);
          })();
        },
        () => undefined
      );
    } catch (error) {
      if (this.playerQrScanner === scanner) this.playerQrScanner = null;
      if (scanner?.isScanning) {
        try {
          await scanner.stop();
          scanner.clear();
        } catch (stopError) {
          console.warn('Não foi possível parar a câmera após erro no leitor.', stopError);
        }
      }
      reader.classList.add('hidden');
      closeButton?.classList.add('hidden');
      this.showToast(error instanceof Error
        ? `Não foi possível iniciar a câmera: ${error.message}`
        : 'Não foi possível iniciar a câmera para ler o QR Code.');
    }
  }

  private async stopPlayerQrScanner(): Promise<void> {
    const scanner = this.playerQrScanner;
    this.playerQrScanner = null;
    if (!scanner) {
      document.getElementById('campaign-qr-reader')?.classList.add('hidden');
      document.getElementById('btn-stop-campaign-qr')?.classList.add('hidden');
      return;
    }
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch (error) {
      console.warn('Não foi possível encerrar o leitor de QR Code.', error);
      this.showToast('Não foi possível encerrar o leitor de QR Code.');
    }
    document.getElementById('campaign-qr-reader')?.classList.add('hidden');
    document.getElementById('btn-stop-campaign-qr')?.classList.add('hidden');
  }

  /* ================= CAMPANHAS EVENTS ================= */
  private bindCampanhasEvents(): void {
    const modal = document.getElementById('modal-add-campanha');
    const nomeInput = document.getElementById('camp-nome') as HTMLInputElement | null;
    const loreInput = document.getElementById('camp-lore') as HTMLTextAreaElement | null;
    const modalTitle = document.getElementById('camp-modal-title');
    const saveButton = document.getElementById('btn-salvar-nova-campanha');

    const prepararModal = (campanha?: Campanha) => {
      this.campanhaEmEdicaoId = campanha?.idCampanha || null;
      if (nomeInput) nomeInput.value = campanha?.nomeCampanha || '';
      if (loreInput) loreInput.value = campanha?.lore || '';
      if (modalTitle) modalTitle.textContent = campanha ? '📜 Editar Campanha' : '📜 Criar Nova Campanha';
      if (saveButton) saveButton.textContent = campanha ? 'Salvar alterações' : 'Salvar Campanha';
      document.querySelectorAll<HTMLInputElement>('.chk-camp-personagem').forEach(check => {
        check.checked = campanha?.personagens.some(personagem => personagem.idPersonagem === check.value) || false;
        check.disabled = Boolean(campanha?.backendId && this.campaignApiAvailable);
      });
      document.getElementById('campaign-character-link-note')?.classList.toggle(
        'hidden',
        !campanha?.backendId || !this.campaignApiAvailable
      );
      document.querySelectorAll<HTMLInputElement>('.chk-camp-ficha').forEach(check => {
        check.checked = campanha?.fichas.some(ficha => ficha.id === check.value) || false;
      });
      document.querySelectorAll<HTMLInputElement>('.chk-camp-monstro').forEach(check => {
        check.checked = campanha?.monstros.some(monstro => monstro.id === check.value) || false;
      });
      modal?.classList.remove('hidden');
    };

    document.getElementById('btn-add-campanha-modal')?.addEventListener('click', () => {
      prepararModal();
    });

    document.getElementById('btn-close-campanha-modal')?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    document.getElementById('btn-salvar-nova-campanha')?.addEventListener('click', async () => {
      const nome = (document.getElementById('camp-nome') as HTMLInputElement)?.value.trim();
      const lore = (document.getElementById('camp-lore') as HTMLTextAreaElement)?.value.trim();

      if (!nome || !lore) {
        alert('Preencha o nome e a história (lore) da campanha.');
        return;
      }

      const checks = document.querySelectorAll<HTMLInputElement>('.chk-camp-personagem:checked');
      const selecionados = Array.from(checks).map(c => this.personagens.find(p => p.idPersonagem === c.value)).filter(Boolean) as Personagem[];
      const fichaChecks = document.querySelectorAll<HTMLInputElement>('.chk-camp-ficha:checked');
      const fichas = Array.from(fichaChecks).map(c => this.sistemaItens.find(item => item.id === c.value)).filter(Boolean) as SistemaPasta[];
      const monstroChecks = document.querySelectorAll<HTMLInputElement>('.chk-camp-monstro:checked');
      const monstros = Array.from(monstroChecks).map(c => this.monstroItens.find(item => item.id === c.value)).filter(Boolean) as MonstroPasta[];

      const campanhaExistente = this.campanhaEmEdicaoId
        ? this.campanhas.find(campanha => campanha.idCampanha === this.campanhaEmEdicaoId)
        : undefined;

      let campaignApiError: unknown;
      if (this.authToken && this.campaignApiAvailable && campanhaExistente?.backendId) {
        try {
          const updated = await CampaignService.atualizar(campanhaExistente.backendId, { name: nome, description: lore }, this.authToken);
          Object.assign(campanhaExistente, this.converterCampanha(updated, campanhaExistente));
        } catch (error) {
          campaignApiError = error;
          if (!(error instanceof TypeError)) {
            this.showToast(error instanceof Error ? error.message : 'Não foi possível atualizar a campanha.');
            return;
          }
          this.campaignApiAvailable = false;
          console.warn('API de campanhas indisponível; a alteração será mantida localmente.', error);
        }
      }

      let newRemoteCampaign: ApiCampaign | undefined;
      let remoteCreationWarning: string | null = null;
      if (!campanhaExistente && this.authToken && this.campaignApiAvailable) {
        try {
          newRemoteCampaign = await CampaignService.criar({ name: nome, description: lore }, this.authToken);
          const ownedCharacterIds = selecionados
            .map(personagem => personagem.backendId)
            .filter((id): id is string => Boolean(id));
          const results = await Promise.allSettled(ownedCharacterIds.map(id =>
            CampaignService.adicionarPersonagem(newRemoteCampaign!.id, id, this.authToken!)
          ));
          const failedLink = results.find(result => result.status === 'rejected');
          if (failedLink?.status === 'rejected') {
            remoteCreationWarning = failedLink.reason instanceof Error
              ? `A campanha foi criada; não foi possível vincular um personagem: ${failedLink.reason.message}`
              : 'A campanha foi criada, mas um personagem não pôde ser vinculado.';
          }
        } catch (error) {
          campaignApiError = error;
          if (!(error instanceof TypeError)) {
            this.showToast(error instanceof Error ? error.message : 'Não foi possível criar a campanha.');
            return;
          }
          this.campaignApiAvailable = false;
          console.warn('API de campanhas indisponível; a campanha será criada somente no armazenamento local.', error);
        }
      }

      if (campanhaExistente) {
        campanhaExistente.nomeCampanha = nome;
        campanhaExistente.lore = lore;
        if (!campanhaExistente.backendId) campanhaExistente.personagens = selecionados;
        campanhaExistente.fichas = fichas;
        campanhaExistente.monstros = monstros;
      } else {
        const nova = new Campanha(nome, lore, newRemoteCampaign?.createdAt, newRemoteCampaign ? [] : selecionados, [], newRemoteCampaign?.id, fichas, monstros);
        if (newRemoteCampaign) {
          nova.backendId = newRemoteCampaign.id;
          nova.ownerId = newRemoteCampaign.ownerId;
          if (this.authToken) {
            try {
              this.campaignCharacters[newRemoteCampaign.id] = await CampaignService.listarPersonagens(newRemoteCampaign.id, this.authToken);
              nova.personagens = this.campaignCharacters[newRemoteCampaign.id]
                .map(character => this.personagens.find(personagem => personagem.backendId === character.id))
                .filter((personagem): personagem is Personagem => Boolean(personagem));
            } catch (error) {
              console.warn('A campanha foi criada, mas os personagens vinculados não puderam ser atualizados na interface.', error);
              remoteCreationWarning = 'A campanha foi criada, mas não foi possível atualizar a lista de personagens.';
            }
          }
        }
        this.campanhas.push(nova);
        this.mestre.adicionarCampanha(nova);
      }
      this.persistStorage(StorageService.salvarCampanhas(this.campanhas));

      modal?.classList.add('hidden');
      this.campanhaEmEdicaoId = null;
      this.showToast(remoteCreationWarning || (campaignApiError instanceof TypeError
        ? 'A alteração foi salva localmente; a API de campanhas está indisponível.'
        : campanhaExistente ? `Campanha "${nome}" atualizada.` : `Campanha "${nome}" criada com sucesso!`));
      this.renderCurrentView();
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-edit-campanha').forEach(button => {
      button.addEventListener('click', async () => {
        const campanha = this.campanhas.find(item => item.idCampanha === button.dataset.id);
        if (!campanha) return;
        if (campanha.backendId && this.authToken && !this.campaignCharacters[campanha.backendId]) {
          try {
            const characters = await CampaignService.listarPersonagens(campanha.backendId, this.authToken);
            this.campaignCharacters[campanha.backendId] = characters;
            campanha.personagens = characters
              .map(character => this.personagens.find(personagem => personagem.backendId === character.id))
              .filter((personagem): personagem is Personagem => Boolean(personagem));
          } catch (error) {
            this.showToast(error instanceof Error ? error.message : 'Não foi possível carregar os personagens da campanha.');
            return;
          }
        }
        prepararModal(campanha);
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-campanha').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const campaign = this.campanhas.find(item => item.idCampanha === id);
        if (!id || !campaign || !confirm('Deseja realmente remover esta campanha?')) return;
        if (campaign.backendId && this.authToken && this.campaignApiAvailable) {
          try {
            await CampaignService.excluir(campaign.backendId, this.authToken);
          } catch (error) {
            if (!(error instanceof TypeError)) {
              this.showToast(error instanceof Error ? error.message : 'Não foi possível excluir a campanha.');
              return;
            }
            this.campaignApiAvailable = false;
            console.warn('API de campanhas indisponível; a campanha será removida somente do armazenamento local.', error);
          }
        }
        const backendId = campaign.backendId;
        this.campanhas = this.campanhas.filter(item => item.idCampanha !== id);
        if (backendId) {
          delete this.campaignInviteStatuses[backendId];
          delete this.campaignInviteCodes[backendId];
          delete this.campaignInviteQrCodes[backendId];
          delete this.campaignJoinRequests[backendId];
          delete this.campaignUserInvitations[backendId];
          delete this.campaignSearchResults[backendId];
        }
        if (this.campanhaEmEdicaoId === id) this.campanhaEmEdicaoId = null;
        this.mestre.removerCampanha(id);
        this.persistStorage(StorageService.salvarCampanhas(this.campanhas));
        this.showToast('Campanha removida.');
        this.renderCurrentView();
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-toggle-campaign-details').forEach(button => {
      button.addEventListener('click', async () => {
        const id = button.dataset.id;
        if (!id) return;
        if (this.openCampaignDetails.has(id)) {
          this.openCampaignDetails.delete(id);
          this.renderCurrentView();
        } else {
          await this.carregarDetalhesCampanha(id);
        }
      });
    });

    document.querySelectorAll<HTMLFormElement>('.form-campaign-search-user').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const campaignId = form.dataset.campaignId;
        const data = new FormData(form);
        const username = String(data.get('username') || '').trim();
        if (!campaignId || !username || !this.authToken) return;
        delete this.campaignSearchResults[campaignId];
        const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        try {
          this.campaignSearchResults[campaignId] = await CampaignService.pesquisarUsuario(
            campaignId,
            username,
            this.authToken
          );
          await this.carregarDetalhesCampanha(campaignId);
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível pesquisar o usuário.');
          this.renderCurrentView();
        } finally {
          if (submitButton?.isConnected) submitButton.disabled = false;
        }
      });

      document.querySelectorAll<HTMLInputElement>('.campaign-friend-filter').forEach(input => {
        input.addEventListener('input', () => {
          const term = input.value.trim().toLowerCase();
          const form = input.closest<HTMLFormElement>('.form-campaign-invite-friends');
          form?.querySelectorAll<HTMLElement>('.campaign-friend-option').forEach(option => {
            option.hidden = !option.dataset.username?.includes(term);
          });
        });
      });

      document.querySelectorAll<HTMLFormElement>('.form-campaign-invite-friends').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const campaignId = form.dataset.campaignId;
          if (!campaignId || !this.authToken) return;
          const selectedIds = new Set(
            Array.from(form.querySelectorAll<HTMLInputElement>('input[name="friendIds"]:checked'))
              .map(input => input.value)
          );
          const selectedFriends = this.friendshipFriends.filter(friend => selectedIds.has(friend.userId));
          if (!selectedFriends.length) {
            this.showToast('Selecione ao menos um amigo para convidar.');
            return;
          }
          const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
          if (submit) submit.disabled = true;
          const invited: string[] = [];
          const failed: string[] = [];
          for (const friend of selectedFriends) {
            try {
              await CampaignService.enviarConviteUsuario(campaignId, friend.username, this.authToken);
              invited.push(friend.username);
            } catch (error) {
              failed.push(`${friend.username}: ${error instanceof Error ? error.message : 'falha ao enviar'}`);
            }
          }
          await this.carregarDetalhesCampanha(campaignId);
          if (failed.length) {
            this.showToast(`${invited.length} convite(s) enviado(s). Falhas: ${failed.join('; ')}`);
          } else {
            this.showToast(`${invited.length} convite(s) enviado(s). Os jogadores precisarão aceitar.`);
          }
        });
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-generate-campaign-code').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        if (!campaignId || !this.authToken) return;
        if (this.campaignInviteStatuses[campaignId]?.status === 'active'
          && !confirm('Renovar o código invalida o código atual. Deseja continuar?')) return;
        button.disabled = true;
        try {
          const invite = await CampaignService.gerarCodigoConvite(campaignId, this.authToken);
          if (!invite.code) throw new Error('A API não retornou o código do convite.');
          this.campaignInviteCodes[campaignId] = invite.code;
          this.campaignInviteStatuses[campaignId] = invite;
          let qrGenerationFailed = false;
          try {
            const QRCode = (await import('qrcode')).default;
            this.campaignInviteQrCodes[campaignId] = await QRCode.toDataURL(invite.code, {
              errorCorrectionLevel: 'M',
              margin: 2,
              width: 240
            });
          } catch (error) {
            delete this.campaignInviteQrCodes[campaignId];
            console.error('O código foi criado, mas não foi possível gerar seu QR Code.', error);
            qrGenerationFailed = true;
          }
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast(qrGenerationFailed
            ? 'Código criado, mas não foi possível gerar o QR Code.'
            : 'Código de convite criado. A entrada ainda exige aprovação do Mestre.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível gerar o convite.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-revoke-campaign-code').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        if (!campaignId || !this.authToken || !confirm('Revogar o código de convite ativo?')) return;
        button.disabled = true;
        try {
          await CampaignService.revogarCodigoConvite(campaignId, this.authToken);
          delete this.campaignInviteCodes[campaignId];
          delete this.campaignInviteQrCodes[campaignId];
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Código de convite revogado.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível revogar o código.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-copy-campaign-code').forEach(button => {
      button.addEventListener('click', async () => {
        const code = this.campaignInviteCodes[button.dataset.campaignId || ''];
        if (!code) return;
        try {
          await navigator.clipboard.writeText(code);
          this.showToast('Código copiado.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível copiar o código.');
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-share-campaign-code').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId || '';
        const code = this.campaignInviteCodes[campaignId];
        const campaign = this.campanhas.find(item => item.backendId === campaignId);
        if (!code || !campaign) return;
        const shareText = `Convite para "${campaign.nomeCampanha}". Código: ${code}. A entrada depende da aprovação do Mestre.`;
        try {
          if (navigator.share) {
            await navigator.share({ title: 'Convite para campanha', text: shareText });
          } else {
            await navigator.clipboard.writeText(shareText);
            this.showToast('Detalhes do convite copiados.');
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          this.showToast(error instanceof Error ? error.message : 'Não foi possível compartilhar o convite.');
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-send-campaign-invitation').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const user = campaignId ? this.campaignSearchResults[campaignId] : undefined;
        if (!campaignId || !user || !this.authToken) return;
        if (!confirm(`Enviar convite para ${user.name} (@${user.username})? O jogador precisará aceitar.`)) return;
        button.disabled = true;
        try {
          await CampaignService.enviarConviteUsuario(campaignId, user.username, this.authToken);
          delete this.campaignSearchResults[campaignId];
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Convite enviado. O jogador precisa aceitá-lo para entrar.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível enviar o convite.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-review-campaign-request').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const requestId = button.dataset.requestId;
        const action = button.dataset.action;
        if (!campaignId || !requestId || !this.authToken || (action !== 'approve' && action !== 'reject')) return;
        const confirmation = action === 'approve'
          ? 'Aprovar esta solicitação e adicionar o jogador à campanha?'
          : 'Rejeitar esta solicitação? O jogador não será adicionado à campanha.';
        if (!confirm(confirmation)) return;
        button.disabled = true;
        try {
          await CampaignService.revisarSolicitacao(campaignId, requestId, action, this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast(action === 'approve' ? 'Jogador aprovado.' : 'Solicitação recusada.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível revisar a solicitação.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-cancel-campaign-invitation').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const invitationId = button.dataset.invitationId;
        if (!campaignId || !invitationId || !this.authToken) return;
        if (!confirm('Cancelar este convite pendente?')) return;
        button.disabled = true;
        try {
          await CampaignService.cancelarConviteUsuario(campaignId, invitationId, this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Convite pendente cancelado.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível cancelar o convite.');
        } finally {
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-save-campaign-role').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const userId = button.dataset.userId;
        const roleInput = document.querySelector<HTMLInputElement>(
          `.campaign-member-role[data-campaign-id="${campaignId}"][data-user-id="${userId}"]`
        );
        if (!campaignId || !userId || !roleInput || !this.authToken) return;
        try {
          await CampaignService.atualizarPapel(campaignId, userId, roleInput.value.trim(), this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Papel do membro atualizado.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível alterar o papel.');
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-campaign-member').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const userId = button.dataset.userId;
        if (!campaignId || !userId || !this.authToken || !confirm('Remover este membro da campanha?')) return;
        try {
          await CampaignService.removerMembro(campaignId, userId, this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Membro removido da campanha.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível remover o membro.');
        }
      });
    });

    document.querySelectorAll<HTMLFormElement>('.form-campaign-add-character').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const campaignId = form.dataset.campaignId;
        const characterId = String(new FormData(form).get('characterId') || '');
        if (!campaignId || !characterId || !this.authToken) return;
        try {
          await CampaignService.adicionarPersonagem(campaignId, characterId, this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Personagem vinculado à campanha.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível vincular o personagem.');
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.btn-remove-campaign-character').forEach(button => {
      button.addEventListener('click', async () => {
        const campaignId = button.dataset.campaignId;
        const characterId = button.dataset.characterId;
        if (!campaignId || !characterId || !this.authToken || !confirm('Desvincular este personagem da campanha?')) return;
        try {
          await CampaignService.removerPersonagem(campaignId, characterId, this.authToken);
          await this.carregarDetalhesCampanha(campaignId);
          this.showToast('Personagem desvinculado da campanha.');
        } catch (error) {
          this.showToast(error instanceof Error ? error.message : 'Não foi possível desvincular o personagem.');
        }
      });
    });
  }

  /* ================= NPCS EVENTS ================= */
  private bindMonstrosEvents(): void {
    const inlineForm = document.getElementById('form-monstro-inline') as HTMLFormElement | null;
    if (inlineForm) {
      document.getElementById('btn-cancel-monstro')?.addEventListener('click', () => {
        this.monstroEmEdicaoId = null;
        this.criandoMonstro = false;
        this.renderCurrentView();
      });
      inlineForm.addEventListener('submit', event => {
        event.preventDefault();
        const value = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value.trim() || '';
        const destination = value('monstro-destination');
        const dados: Record<string, string | number> = {};
        inlineForm.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(input => {
          if (input.value.trim()) dados[input.id] = input.value.trim();
        });
        const atual = this.monstroEmEdicaoId ? this.monstroItens.find(item => item.id === this.monstroEmEdicaoId) : undefined;
        if (atual) {
          atual.nome = value('monstro-nome') || atual.nome;
          atual.descricao = value('monstro-description');
          atual.parentId = destination || null;
          atual.dados = dados;
        } else {
          this.monstroItens.push({ id: crypto.randomUUID(), nome: value('monstro-nome') || 'Novo monstro', tipo: 'ficha', sistema: 'D&D', descricao: value('monstro-description'), parentId: destination || null, dataCriacao: new Date().toLocaleDateString('pt-BR'), dados });
        }
        this.persistStorage(StorageService.salvarMonstroPastas(this.monstroItens));
        this.monstroEmEdicaoId = null;
        this.criandoMonstro = false;
        this.showToast('Ficha de monstro salva.');
        this.renderCurrentView();
      });
      return;
    }

    document.querySelectorAll<HTMLButtonElement>('.btn-open-monstro').forEach(button => button.addEventListener('click', () => {
      this.pastaMonstroAtualId = button.dataset.id || null;
      this.monstroEmEdicaoId = null;
      this.criandoMonstro = false;
      this.renderCurrentView();
    }));
    document.getElementById('btn-monstro-up')?.addEventListener('click', () => {
      const atual = this.monstroItens.find(item => item.id === this.pastaMonstroAtualId);
      this.pastaMonstroAtualId = atual?.parentId || null;
      this.renderCurrentView();
    });
    document.getElementById('btn-new-monstro-sheet')?.addEventListener('click', () => {
      this.monstroEmEdicaoId = null;
      this.criandoMonstro = true;
      this.renderCurrentView();
    });
    document.querySelectorAll<HTMLButtonElement>('.btn-edit-monstro').forEach(button => button.addEventListener('click', () => {
      const item = this.monstroItens.find(entry => entry.id === button.dataset.id);
      if (item) { this.monstroEmEdicaoId = item.id; this.criandoMonstro = false; this.renderCurrentView(); }
    }));
    document.querySelectorAll<HTMLButtonElement>('.btn-delete-monstro').forEach(button => button.addEventListener('click', () => {
      const item = this.monstroItens.find(entry => entry.id === button.dataset.id);
      const confirmation = item?.tipo === 'pasta'
        ? `Excluir a pasta "${item.nome}"? As notas e missões vinculadas serão mantidas sem pasta.`
        : `Excluir ficha "${item?.nome}"?`;
      if (!item || !confirm(confirmation)) return;
      const ids = new Set([item.id]);
      let changed = true;
      while (changed) { changed = false; this.monstroItens.forEach(entry => { if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.id)) { ids.add(entry.id); changed = true; } }); }
      this.monstroItens = this.monstroItens.filter(entry => !ids.has(entry.id));
      this.persistStorage(StorageService.salvarMonstroPastas(this.monstroItens));
      this.renderCurrentView();
    }));
    const modal = document.getElementById('modal-monstro-folder');
    document.getElementById('btn-new-monstro-folder')?.addEventListener('click', () => modal?.classList.remove('hidden'));
    document.getElementById('btn-close-monstro-modal')?.addEventListener('click', () => modal?.classList.add('hidden'));
    document.getElementById('form-monstro-folder')?.addEventListener('submit', event => {
      event.preventDefault();
      const name = (document.getElementById('monstro-folder-name') as HTMLInputElement).value.trim();
      if (!name) return;
      const parentId = (document.getElementById('monstro-folder-parent') as HTMLSelectElement).value || null;
      this.monstroItens.push({ id: crypto.randomUUID(), nome: name, tipo: 'pasta', sistema: 'D&D', descricao: (document.getElementById('monstro-folder-description') as HTMLTextAreaElement).value.trim(), parentId, dataCriacao: new Date().toLocaleDateString('pt-BR') });
      this.persistStorage(StorageService.salvarMonstroPastas(this.monstroItens));
      modal?.classList.add('hidden');
      this.renderCurrentView();
    });
  }

  /* ================= INICIATIVA EVENTS ================= */
  private bindIniciativaEvents(): void {
    document.getElementById('btn-add-init-personagem')?.addEventListener('click', () => {
      const sel = document.getElementById('select-init-personagem') as HTMLSelectElement;
      const selected = sel?.value || '';
      const ficha = selected.startsWith('ficha:')
        ? this.sistemaItens.find(item => item.id === selected.slice('ficha:'.length))
        : undefined;
      const p = this.personagens.find(item => item.idPersonagem === selected);
      if (ficha) {
        const dados = ficha.dados || {};
        const prefixo = ficha.sistema === 'D&D' ? 'dnd' : ficha.sistema === 'Vampiro: A Máscara' ? 'vampire' : 'coc';
        const ler = (campo: string, alternativo = '') => Number(dados[`${prefixo}-${campo}`] || dados[`inline-${prefixo}-${campo}`] || dados[`guided-${prefixo}-${campo}`] || dados[alternativo] || 0);
        const destreza = ler(ficha.sistema === 'Vampiro: A Máscara' ? 'dexterity' : 'dex');
        const pontosVida = ler(ficha.sistema === 'D&D' ? 'current-hp' : ficha.sistema === 'Vampiro: A Máscara' ? 'health' : 'hp') || 1;
        const iniciativa = DiceService.sortearNumero(1, 20) + (ficha.sistema === 'D&D' ? Math.floor((destreza - 10) / 2) : Math.floor(destreza / 10));
        this.mestre.adicionarCombatente({ id: crypto.randomUUID(), nome: ficha.nome, tipo: 'Personagem', iniciativa, vidaAtual: pontosVida, vidaMax: pontosVida, ca: ler('ac') || undefined });
        this.showToast(`⚔️ ${ficha.nome} entrou na iniciativa.`);
        this.renderCurrentView();
        return;
      }
      if (p) {
        const modDes = p.obterModificador('destreza');
        const d20 = DiceService.sortearNumero(1, 20);
        const init = d20 + modDes;

        const combatente: CombatenteIniciativa = {
          id: crypto.randomUUID(),
          nome: p.nomePersonagem,
          tipo: 'Personagem',
          iniciativa: init,
          vidaAtual: p.pontosVida,
          vidaMax: p.pontosVidaMax,
          ca: p.ca
        };
        this.mestre.adicionarCombatente(combatente);
        this.showToast(`⚔️ ${p.nomePersonagem} rolou iniciativa: d20(${d20}) + ${modDes} = ${init}`);
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-add-init-npc')?.addEventListener('click', () => {
      const sel = document.getElementById('select-init-npc') as HTMLSelectElement;
      const selected = sel?.value || '';
      const fichaMonstro = selected.startsWith('monstro:')
        ? this.monstroItens.find(item => item.id === selected.slice('monstro:'.length))
        : undefined;
      const n = this.npcs.find(item => item.idNpc === selected);
      if (fichaMonstro) {
        const dados = fichaMonstro.dados || {};
        const ler = (campo: string) => Number(dados[`inline-${campo}`] || dados[campo] || 0);
        const vida = ler('monstro-current-hp') || ler('monstro-hp') || 1;
        const destreza = ler('monstro-dex');
        const iniciativa = DiceService.sortearNumero(1, 20) + Math.floor((destreza - 10) / 2);
        this.mestre.adicionarCombatente({ id: crypto.randomUUID(), nome: fichaMonstro.nome, tipo: 'NPC', iniciativa, vidaAtual: vida, vidaMax: vida, ca: ler('monstro-ac') || undefined });
        this.showToast(`🐉 ${fichaMonstro.nome} entrou na iniciativa.`);
        this.renderCurrentView();
        return;
      }
      if (n) {
        const d20 = DiceService.sortearNumero(1, 20);
        const init = d20;

        const combatente: CombatenteIniciativa = {
          id: crypto.randomUUID(),
          nome: n.nome,
          tipo: 'NPC',
          iniciativa: init,
          vidaAtual: n.vida,
          vidaMax: n.vidaMax
        };
        this.mestre.adicionarCombatente(combatente);
        this.showToast(`🐉 ${n.nome} rolou iniciativa: ${init}`);
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-limpar-iniciativa')?.addEventListener('click', () => {
      this.mestre.limparIniciativa();
      this.showToast('Fila de iniciativa limpa.');
      this.renderCurrentView();
    });

    document.querySelectorAll('.btn-remove-init').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) {
          this.mestre.removerCombatente(id);
          this.renderCurrentView();
        }
      });
    });
  }

  /* ================= TOAST SYSTEM ================= */
  private showToast(mensagem: string, tipo: 'normal' | 'critico' | 'falha' = 'normal'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo === 'critico' ? 'toast-critico' : tipo === 'falha' ? 'toast-falha' : ''}`;
    toast.innerHTML = `<span>💬 ${mensagem}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Inicializar aplicação
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
