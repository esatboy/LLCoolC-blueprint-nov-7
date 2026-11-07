export type CaptureType = 'text' | 'photo' | 'voice';
export type Origin = 'vision' | 'lesson' | 'inspiration';
export type PillarId = 'food' | 'guest' | 'space' | 'service' | 'brand' | 'team' | 'numbers';
export type Answer = 'fire' | 'meh' | 'no';
export type Tab = 'capture' | 'blueprint' | 'still' | 'week' | 'pager' | 'settings';

export interface Resonance {
  at: number;
  answer: Answer;
  source?: 'prompt' | 'weekly';
}

export interface Capture {
  id: string;
  type: CaptureType;
  text?: string; // note text, or optional caption for photo/voice
  blob?: Blob; // photo (downscaled JPEG) or audio
  thumb?: Blob; // photo thumbnail
  mime?: string;
  durationMs?: number;
  tags: string[];
  createdAt: number;
  origin: Origin;
  pillar: PillarId | null; // null until she confirms
  suggestedPillar: PillarId | null;
  strength: number;
  status: 'active' | 'archived';
  nextResurfaceAt: number | null;
  resonanceHistory: Resonance[];
  sample?: boolean;
}

export interface AppEvent {
  id?: number;
  at: number;
  type: string;
  data?: Record<string, unknown>;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  llmOptIn: boolean; // OFF by default: sends capture TEXT off-device when on
  llmEndpoint: string;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', llmOptIn: false, llmEndpoint: '' };
