export interface Exercise {
  id: string;
  name: string;
  category: 'facial' | 'tongue' | 'lip' | 'chewing' | 'swallow' | 'posture' | 'neck' | 'shoulder' | 'trismus' | 'lymphedema';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  duration: number; // seconds
  description: string;
  instructions: string[];
  videoUrl?: string;
  imageUrl?: string;
  tips?: string[];
  repetitions?: number;
  imageFrames?: string[];  // 多幀圖片陣列，用於動畫展示
}



export interface TrackingSummary {
  module?: 'face' | 'pose' | 'self-view';
  mode?: string;
  targetLabel?: string;
  reps?: number;
  maxPercent?: number;
  avgPercent?: number;
  targetHoldSeconds?: number;
  totalHoldSeconds?: number;
  completedTarget?: boolean;
  samples?: number;
}

export interface PatientProgress {
  exerciseId: string;
  date: string;
  completed: boolean;
  repetitions?: number;
  duration?: number; // actual duration in seconds
  notes?: string;
  tracking?: TrackingSummary;
}

export interface PatientProfile {
  name: string;
  age?: number;
  diagnosis?: string;
  doctorRecommendations?: string;
  dietaryRestrictions?: string[];
  startDate: string;
  dailyGoal?: number; // minutes
}