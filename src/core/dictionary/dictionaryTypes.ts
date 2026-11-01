/**
 * src/core/dictionary/dictionaryTypes.ts
 * Interfaces e tipos para o motor de dicionário do Margem.
 */

export interface DictionaryEntry {
  word: string;
  partOfSpeech: string;
  etymology?: string;
  definitions: string[];
  synonyms?: string[];
  example?: string;
  phonetic?: string;
  source?: 'local' | 'freedictionary';
}

export interface DictionaryLookupResult {
  found: boolean;
  entry: DictionaryEntry;
  searchedWord: string;
  suggestions?: string[];
  source?: 'local' | 'freedictionary';
}

export const DICTIONARY_VERSION = '1.0';
