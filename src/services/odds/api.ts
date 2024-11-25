import axios from 'axios';
import { BASE_URL, DEFAULT_SPORTS } from './constants';
import { OddsStorage } from './storage';
import { OddsApiError, ERROR_MESSAGES } from './errors';
import type { Sport, Event, OddsConfig } from './types';

export class OddsApi {
  private config: OddsConfig;
  private isInitialized: boolean;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.config = {
      apiKey: '',
      sports: DEFAULT_SPORTS,
      lastUpdated: new Date().toISOString()
    };
    this.isInitialized = false;
    this.initPromise = this.initialize();
  }

  private async initialize() {
    try {
      // Load from localStorage first
      const localConfig = await OddsStorage.loadFromLocalStorage();
      if (localConfig) {
        this.config = localConfig;
      }

      // Then check Firebase for newer config
      const firebaseConfig = await OddsStorage.loadFromFirebase();
      if (firebaseConfig && (!this.config.lastUpdated || 
          (firebaseConfig.lastUpdated && firebaseConfig.lastUpdated > this.config.lastUpdated))) {
        this.config = firebaseConfig;
        await OddsStorage.saveToLocalStorage(this.config);
      }

      this.isInitialized = !!this.config.apiKey;
    } catch (error) {
      console.error('Error initializing OddsApi:', error);
      throw new OddsApiError(ERROR_MESSAGES.INITIALIZATION_ERROR, 'INITIALIZATION_ERROR');
    }
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  async setApiKey(key: string) {
    await this.ensureInitialized();
    this.config.apiKey = key;
    this.isInitialized = true;
    await this.saveConfig(true);
  }

  getApiKey(): string {
    return this.config.apiKey;
  }

  async setSportConfig(sportKey: string, enabled: boolean, refreshInterval: number) {
    await this.ensureInitialized();
    this.config.sports[sportKey] = { enabled, refreshInterval };
    await this.saveConfig(true);
  }

  getSportConfig(sportKey: string) {
    return this.config.sports[sportKey] || DEFAULT_SPORTS[sportKey] || { enabled: false, refreshInterval: 30 };
  }

  getAllSportsConfig() {
    return this.config.sports;
  }

  private async saveConfig(updateFirebase = true) {
    await OddsStorage.saveToLocalStorage(this.config);
    if (updateFirebase) {
      await OddsStorage.saveToFirebase(this.config);
    }
  }

  isConfigured(): boolean {
    return this.isInitialized && !!this.config.apiKey;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await axios.get(BASE_URL, { params: { apiKey } });
      return response.status === 200;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new OddsApiError(ERROR_MESSAGES.API_KEY_INVALID, 'API_KEY_INVALID');
        }
        if (error.response?.status === 429) {
          throw new OddsApiError(ERROR_MESSAGES.API_RATE_LIMIT, 'API_RATE_LIMIT');
        }
      }
      throw new OddsApiError(ERROR_MESSAGES.API_CONNECTION_ERROR, 'API_CONNECTION_ERROR');
    }
  }

  private async validateApiKey() {
    if (!this.config.apiKey) {
      throw new OddsApiError(ERROR_MESSAGES.API_KEY_REQUIRED, 'API_KEY_REQUIRED');
    }
    await this.ensureInitialized();
  }

  private async request<T>(endpoint: string, params = {}): Promise<T> {
    await this.validateApiKey();

    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`, {
        params: {
          apiKey: this.config.apiKey,
          ...params
        }
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new OddsApiError(ERROR_MESSAGES.API_KEY_INVALID, 'API_KEY_INVALID');
        }
        if (error.response?.status === 429) {
          throw new OddsApiError(ERROR_MESSAGES.API_RATE_LIMIT, 'API_RATE_LIMIT');
        }
        if (error.response?.status === 404) {
          throw new OddsApiError(ERROR_MESSAGES.RESOURCE_NOT_FOUND, 'RESOURCE_NOT_FOUND');
        }
      }
      throw new OddsApiError(ERROR_MESSAGES.API_CONNECTION_ERROR, 'API_CONNECTION_ERROR');
    }
  }

  async getSports(): Promise<Sport[]> {
    return this.request<Sport[]>('/');
  }

  async getOdds(sportKey: string, regions = 'eu'): Promise<Event[]> {
    const config = this.getSportConfig(sportKey);
    if (!config.enabled) {
      throw new OddsApiError(ERROR_MESSAGES.SPORT_DISABLED, 'SPORT_DISABLED');
    }
    return this.request<Event[]>(`/${sportKey}/odds`, {
      regions,
      markets: 'h2h'
    });
  }

  async getLiveEvents(sportKey: string): Promise<Event[]> {
    const config = this.getSportConfig(sportKey);
    if (!config.enabled) {
      throw new OddsApiError(ERROR_MESSAGES.SPORT_DISABLED, 'SPORT_DISABLED');
    }
    return this.request<Event[]>(`/${sportKey}/odds-live`, {
      markets: 'h2h'
    });
  }

  async getScores(sportKey: string, daysFrom = 1): Promise<Event[]> {
    const config = this.getSportConfig(sportKey);
    if (!config.enabled) {
      throw new OddsApiError(ERROR_MESSAGES.SPORT_DISABLED, 'SPORT_DISABLED');
    }
    return this.request<Event[]>(`/${sportKey}/scores`, {
      daysFrom
    });
  }
}

export const oddsApi = new OddsApi();