import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { STORAGE_KEY, FIREBASE_COLLECTION, DEFAULT_SPORTS } from './constants';
import type { OddsConfig } from './types';

export class OddsStorage {
  static async loadFromLocalStorage(): Promise<OddsConfig | null> {
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        return {
          ...parsed,
          sports: { ...DEFAULT_SPORTS, ...parsed.sports }
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  }

  static async loadFromFirebase(): Promise<OddsConfig | null> {
    try {
      const configDoc = await getDoc(doc(db, FIREBASE_COLLECTION, 'settings'));
      if (configDoc.exists()) {
        const firebaseConfig = configDoc.data() as OddsConfig;
        return {
          ...firebaseConfig,
          sports: { ...DEFAULT_SPORTS, ...firebaseConfig.sports }
        };
      }
      return null;
    } catch (error) {
      console.error('Error loading from Firebase:', error);
      return null;
    }
  }

  static async saveToLocalStorage(config: OddsConfig): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  static async saveToFirebase(config: OddsConfig): Promise<void> {
    try {
      await setDoc(doc(db, FIREBASE_COLLECTION, 'settings'), {
        ...config,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving to Firebase:', error);
    }
  }
}