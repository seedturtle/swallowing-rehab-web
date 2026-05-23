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

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('swallow-rehab-progress');
    if (saved) {
      setProgress(JSON.parse(saved));
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem('swallow-rehab-progress', JSON.stringify(progress));
  }, [progress]);

  const filteredExercises = selectedCategory === 'all'
    ? exercises
    : exercises.filter(e => e.category === selectedCategory);

  const handleExerciseClick = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setCurrentView('exercise');
  };

  const handleCompleteExercise = (exerciseId: string, repetitions?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const existing = progress.find(p => p.exerciseId === exerciseId && p.date === today);
    
    if (existing) {
      setProgress(progress.filter(p => !(p.exerciseId === exerciseId && p.date === today)));
    }
    
    const newProgress: PatientProgress = {
      exerciseId,
      date: today,
      completed: true,
      repetitions,
    };
    setProgress([...progress, newProgress]);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onNavigate={setCurrentView} currentView={currentView} />
      
      <main className="container mx-auto px-4 py-6">
        {currentView === 'home' && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">復健項目</h2>
              <p className="text-gray-600">選擇下方分類開始您的居家復健之旅</p>
            </div>
            
            <CategoryNav
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
            
            <ExerciseList
              exercises={filteredExercises}
              onExerciseClick={handleExerciseClick}
              progress={progress}
            />
          </>
        )}
        
        {currentView === 'exercise' && selectedExercise && (
          <ExerciseDetail
            exercise={selectedExercise}
            onBack={() => setCurrentView('home')}
            onComplete={handleCompleteExercise}
          />
        )}
        
        {currentView === 'progress' && (
          <ProgressTracker progress={progress} exercises={exercises} />
        )}
      </main>
      
      <footer className="bg-gray-800 text-white py-4 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm"> Mennonite Christian Hospital · 吞嚥復健系統</p>
        </div>
      </footer>
    </div>
  );
}

export default App;