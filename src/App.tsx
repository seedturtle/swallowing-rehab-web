import { useState } from 'react';
import Header from './components/Header';
import CategoryNav from './components/CategoryNav';
import ExerciseList from './components/ExerciseList';
import ExerciseDetail from './components/ExerciseDetail';
import ProgressTracker from './components/ProgressTracker';
import { Exercise, PatientProgress, TrackingSummary } from './data/types';
import { exercises, categories } from './data/exercises';

type View = 'home' | 'exercise' | 'progress';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const [visitCount] = useState<number>(() => {
    const prev = parseInt(localStorage.getItem('swallow-rehab-visit') || '0');
    localStorage.setItem('swallow-rehab-visit', String(prev + 1));
    return prev + 1;
  });

  const [progress, setProgress] = useState<PatientProgress[]>(() => {
    try {
      const saved = localStorage.getItem('swallow-rehab-progress');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const saveProgress = (newProgress: PatientProgress[]) => {
    setProgress(newProgress);
    localStorage.setItem('swallow-rehab-progress', JSON.stringify(newProgress));
  };

  const completeExercise = (exerciseId: string, repetitions?: number, tracking?: TrackingSummary) => {
    const now = new Date().toISOString();
    saveProgress([...progress, {
      date: now,
      exerciseId,
      completed: true,
      repetitions: repetitions ?? 0,
      duration: selectedExercise?.duration ?? 0,
      tracking
    }]);
  };

  const handleNavigate = (view: View) => {
    if (view === 'home') {
      setSelectedExercise(null);
      setSelectedCategory('all');
    }
    setCurrentView(view);
  };

  const handleBack = () => {
    setSelectedExercise(null);
    setCurrentView('home');
  };

  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setCurrentView('exercise');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header onNavigate={handleNavigate} currentView={currentView} />

      {currentView === 'progress' && (
        <div className="p-4">
          <button onClick={() => handleNavigate('home')} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
            ← 返回
          </button>
          <ProgressTracker progress={progress} exercises={exercises} onReset={() => saveProgress([])} />
        </div>
      )}

      {currentView === 'home' && !selectedExercise && (
        <div className="p-4">
          <div className="text-center mb-6">
            <p className="text-gray-600 text-sm">選擇復健項目開始練習</p>
          </div>
          <CategoryNav
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <ExerciseList
            exercises={selectedCategory === 'all' ? exercises : exercises.filter(e => e.category === selectedCategory)}
            onExerciseClick={handleSelectExercise}
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

          {/* Footer — 僅首頁顯示 */}
          <div className="text-center text-xs text-gray-400 mt-8 pb-4">
            耳鼻喉科 洪士涵醫師 | 2026年5月23日<br />
            造訪 {visitCount} 次
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