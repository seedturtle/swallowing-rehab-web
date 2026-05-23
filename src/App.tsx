import { useState, useEffect } from 'react';
import Header from './components/Header';
import CategoryNav from './components/CategoryNav';
import ExerciseList from './components/ExerciseList';
import ExerciseDetail from './components/ExerciseDetail';
import ProgressTracker from './components/ProgressTracker';
import { Exercise, PatientProgress } from './data/types';
import { exercises, categories } from './data/exercises';

type View = 'home' | 'exercise' | 'progress';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [progress, setProgress] = useState<PatientProgress[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('swallow-rehab-progress');
    if (saved) {
      setProgress(JSON.parse(saved));
    }
  }, []);

  const saveProgress = (newProgress: PatientProgress[]) => {
    setProgress(newProgress);
    localStorage.setItem('swallow-rehab-progress', JSON.stringify(newProgress));
  };

  const completeExercise = (exerciseId: string, repetitions?: number, duration?: number) => {
    const now = new Date().toISOString().split('T')[0];
    const existing = progress.find(p => p.date === now && p.exerciseId === exerciseId);
    
    if (existing) {
      saveProgress(progress.map(p => 
        p.date === now && p.exerciseId === exerciseId
          ? { ...p, completedSessions: p.completedSessions + 1, totalDuration: p.totalDuration + duration }
          : p
      ));
    } else {
      saveProgress([...progress, {
        date: now,
        exerciseId,
        completedSessions: 1,
        totalDuration: duration
      }]);
    }
  };

  const getTodayProgress = () => {
    const today = new Date().toISOString().split('T')[0];
    return progress.filter(p => p.date === today);
  };

  const handleBack = () => {
    setSelectedExercise(null);
    setCurrentView('home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      
      {currentView === 'progress' && (
        <div className="p-4">
          <button onClick={() => setCurrentView('home')} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
            ← 返回
          </button>
          <ProgressTracker progress={progress} exercises={exercises} />
        </div>
      )}

      {currentView === 'home' && !selectedExercise && (
        <div className="p-4">
          <div className="text-center mb-6">
            <p className="text-gray-600 text-sm">選擇復健項目開始練習</p>
          </div>
          <CategoryNav 
            categories={categories} 
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <ExerciseList 
            exercises={exercises}
            categoryFilter={selectedCategory}
            onSelectExercise={(exercise) => {
              setSelectedExercise(exercise);
              setCurrentView('exercise');
            }}
            progress={progress}
          />
          <div className="mt-6 flex gap-2">
            <button 
              onClick={() => setCurrentView('progress')}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              📊 查看進度
            </button>
          </div>
        </div>
      )}

      {currentView === 'exercise' && selectedExercise && (
        <ExerciseDetail 
          exercise={selectedExercise}
          onBack={handleBack}
          onComplete={completeExercise}
        />
      )}
    </div>
  );
}

export default App;
