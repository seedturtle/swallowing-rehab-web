import { Exercise, PatientProgress } from '../data/types';
import { categories } from '../data/exercises';

interface ExerciseListProps {
  exercises: Exercise[];
  onExerciseClick: (exercise: Exercise) => void;
  progress: PatientProgress[];
}

export default function ExerciseList({ exercises, onExerciseClick, progress }: ExerciseListProps) {
  const getCategoryInfo = (categoryId: string) => {
    return categories.find(c => c.id === categoryId) || categories[0];
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'basic': return '基礎';
      case 'intermediate': return '中級';
      case 'advanced': return '進階';
      default: return difficulty;
    }
  };

  const isCompletedToday = (exerciseId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return progress.some(p => p.exerciseId === exerciseId && p.date === today && p.completed);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {exercises.map(exercise => {
        const category = getCategoryInfo(exercise.category);
        const completed = isCompletedToday(exercise.id);
        
        return (
          <div
            key={exercise.id}
            onClick={() => onExerciseClick(exercise)}
            className={`exercise-card relative ${completed ? 'ring-2 ring-green-500' : ''}`}
          >
            {completed && (
              <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{category.icon}</span>
              <span 
                className="px-2 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            </div>
            
            <h3 className="font-bold text-gray-800 mb-2">{exercise.name}</h3>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{exercise.description}</p>
            
            <div className="flex items-center justify-between text-sm">
              <span className={`px-2 py-1 rounded-full ${getDifficultyColor(exercise.difficulty)}`}>
                {getDifficultyText(exercise.difficulty)}
              </span>
              <span className="text-gray-500">⏱️ {exercise.duration}秒</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}