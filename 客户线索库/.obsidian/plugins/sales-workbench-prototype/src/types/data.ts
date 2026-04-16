// Common data types shared across workbenches

// Status item for header
export interface StatusItem {
  icon: string;
  text: string;
  animate?: boolean;
}

// Stat card configuration
export interface StatCardConfig {
  icon: string;
  value: number | string;
  label: string;
  colorVar: string;
  progress?: number; // 0-100
  animate?: boolean;
}

// Button configuration
export interface ButtonConfig {
  text: string;
  type: 'primary' | 'secondary' | 'danger' | 'weak';
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
}

// Tag configuration
export interface TagConfig {
  text: string;
  colorVar: string;
  type?: 'default' | 'clip-path';
}

// Audio player state
export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number; // 0-100
}

// Highlight segment in transcript
export interface TranscriptHighlight {
  id: string;
  text: string;
  timeRange: string; // e.g. "3:45-3:52"
  fieldKey: string; // which field this highlights
}