export interface Exercise {
  id: string;
  name: string;
  category: 'facial' | 'tongue' | 'lip' | 'chewing' | 'swallow' | 'posture';
  difficulty: 'basic' | 'intermediate' | 'advanced';
  duration: number; // seconds
  description: string;
  instructions: string[];
  videoUrl?: string;
  imageUrl?: string;
  tips?: string[];
}

export interface PatientProgress {
  exerciseId: string;
  date: string;
  completed: boolean;
  repetitions?: number;
  duration?: number; // actual duration in seconds
  notes?: string;
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