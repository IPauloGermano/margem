/**
 * src/core/dictionary/dictionaryTypes.ts
 * Interfaces e tipos para o motor de dicionário do Margem.
 */

export type DictionarySource = 'local' | 'wiktionary' | 'wikipedia' | 'freedictionary';

export interface DictionaryEntry {
  word: string;
  partOfSpeech: string;
  etymology?: string;
  definitions: string[];
  synonyms?: string[];
  example?: string;
  phonetic?: string;
  url?: string;
  thumbnailUrl?: string;
  source?: DictionarySource;
}

export interface DictionaryLookupResult {
  found: boolean;
  entry: DictionaryEntry;
  searchedWord: string;
  suggestions?: string[];
  source?: DictionarySource;
}

export interface DualDictionaryResult {
  searchedWord: string;
  defaultTab: 'dictionary' | 'wikipedia';
  dictionary: DictionaryLookupResult | null;
  wikipedia: DictionaryLookupResult | null;
  isLoading?: boolean;
}

export const DICTIONARY_VERSION = '1.4';
