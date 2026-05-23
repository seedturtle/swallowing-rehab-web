import { useState, useEffect } from 'react';
import { Exercise } from '../data/types';

interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onComplete: (exerciseId: string) => void;
}

const categoryImages: Record<string, string> = {
  facial: '/images/cartoon_facial.jpg',
  tongue: '/images/cartoon_tongue.jpg',
  lip: '/images/cartoon_lip.jpg',
  chewing: '/images/cartoon_facial.jpg',
  swallow: '/images/cartoon_tongue.jpg',
  posture: '/images/cartoon_lip.jpg',
};

export default function ExerciseDetail({ exercise, onBack, onComplete }: ExerciseDetailProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exercise.duration || 60);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isTimerRunning, timeLeft]);

  const startTimer = () => {
    setTimeLeft(exercise.duration || 60);
    setIsTimerRunning(true);
    setIsCompleted(false);
  };

  const _handleComplete = () => {
    setIsCompleted(true);
    setIsTimerRunning(false);
    setTimeLeft(0);
    onComplete(exercise.id);
  };

  const imgSrc = categoryImages[exercise.category] || '/images/cartoon_facial.jpg';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
          ← Back
        </button>
        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
          {(exercise as any).categoryLabel || exercise.category}
        </span>
      </div>

      {/* Title + Image side by side */}
      <div className="flex gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{exercise.name}</h2>
          <p className="text-gray-600 text-sm">{exercise.description}</p>
        </div>
        <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50">
          <img
            src={imgSrc}
            alt={exercise.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          Instructions
        </h3>
        <ul className="space-y-2">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tips */}
      {exercise.tips && exercise.tips.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-bold text-amber-800 mb-2 text-sm">Tips</h4>
          <ul className="space-y-1">
            {exercise.tips.map((tip, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span>💡</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timer */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600">Duration: {exercise.duration}s</span>
          {isTimerRunning && (
            <span className="text-2xl font-bold text-blue-600">{timeLeft}s</span>
          )}
          {isCompleted && (
            <span className="text-base font-bold text-green-600">✓ Completed</span>
          )}
        </div>
        {!isTimerRunning && !isCompleted && (
          <button onClick={startTimer} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
            Start Timer ({exercise.duration}s)
          </button>
        )}
        {isTimerRunning && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-1000" style={{ width: `${(timeLeft / (exercise.duration || 60)) * 100}%` }} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setIsTimerRunning(false); setIsCompleted(true); onComplete(exercise.id); }} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition">
                Done ✓
              </button>
              <button onClick={() => { setIsTimerRunning(false); setTimeLeft(exercise.duration || 60); }} className="flex-1 py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition">
                Cancel
              </button>
            </div>
          </div>
        )}
        {isCompleted && (
          <button onClick={() => { setIsCompleted(false); setTimeLeft(exercise.duration || 60); }} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
            Practice Again
          </button>
        )}
      </div>

      {/* Camera Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button onClick={() => setShowCamera(!showCamera)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition">
          <span className="font-medium text-sm text-gray-700">
            {showCamera ? 'Hide Camera' : 'Show Camera'}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${showCamera ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {showCamera ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>
    </div>
  );
}
