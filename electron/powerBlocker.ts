export interface PowerSaveBlockerApi {
  start: (type: 'prevent-display-sleep' | 'prevent-app-suspension') => number;
  stop: (id: number) => void;
  isStarted: (id: number) => boolean;
}

/**
 * Gerenciador do powerSaveBlocker para leitura contínua.
 * Impede o desligamento ou escurecimento da tela apenas enquanto
 * o Margem estiver aberto e em primeiro plano (ativo pelo usuário).
 */
export class DisplaySleepInhibitor {
  private blockerId: number | null = null;
  private api: PowerSaveBlockerApi;

  constructor(api: PowerSaveBlockerApi) {
    this.api = api;
  }

  /**
   * Indica se a inibição de suspensão da tela está ativa no momento.
   */
  isBlocking(): boolean {
    if (this.blockerId === null) return false;
    return this.api.isStarted(this.blockerId);
  }

  /**
   * Inibe o desligamento da tela ('prevent-display-sleep').
   * Idempotente: se já estiver ativo, não duplica requisições nem IDs.
   */
  acquire(): boolean {
    if (this.isBlocking()) {
      return true;
    }

    try {
      this.blockerId = this.api.start('prevent-display-sleep');
      return true;
    } catch (err) {
      console.warn('Aviso: falha ao iniciar inibição de suspensão de tela:', err);
      this.blockerId = null;
      return false;
    }
  }

  /**
   * Libera a inibição da tela, permitindo que o sistema operacional
   * durma e economize energia normalmente quando em segundo plano.
   */
  release(): boolean {
    if (this.blockerId === null) {
      return false;
    }

    try {
      if (this.api.isStarted(this.blockerId)) {
        this.api.stop(this.blockerId);
      }
      this.blockerId = null;
      return true;
    } catch (err) {
      console.warn('Aviso: falha ao liberar inibição de suspensão de tela:', err);
      this.blockerId = null;
      return false;
    }
  }
}
