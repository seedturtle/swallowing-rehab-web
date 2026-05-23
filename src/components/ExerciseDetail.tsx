import { useState, useEffect, useRef } from 'react';
import { Exercise } from '../data/types';
import { categories } from '../data/exercises';

interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onComplete: (exerciseId: string, repetitions?: number) => void;
}

export default function ExerciseDetail({ exercise, onBack, onComplete }: ExerciseDetailProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exercise.duration);
  const [repetitions, setRepetitions] = useState(10);
  const [isCompleted, setIsCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const category = categories.find(c => c.id === exercise.category);

  // 計時器倒數邏輯
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setIsCompleted(true);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isTimerRunning, timeLeft]);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    setTimeLeft(exercise.duration);
    setIsCompleted(false);
  };

  const handleComplete = () => {
    onComplete(exercise.id, repetitions);
    setIsTimerRunning(false);
    setIsCompleted(false);
    alert('已完成今天的練習！');
  };

  const handleReset = () => {
    setIsTimerRunning(false);
    setIsCompleted(false);
    setTimeLeft(exercise.duration);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-[#003366] hover:text-[#006699] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        返回列表
      </button>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{category?.icon}</span>
          <div>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: category?.color }}
            >
              {category?.name}
            </span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-4">{exercise.name}</h2>
        <p className="text-gray-600 mb-6">{exercise.description}</p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="text-xl">📋</span> 動作指示
          </h3>
          <ol className="space-y-3">
            {exercise.instructions.map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-[#003366] text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <span className="text-gray-700 pt-1">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>

        {exercise.tips && exercise.tips.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
              <span>💡</span> 小提示
            </h3>
            <ul className="space-y-1">
              {exercise.tips.map((tip, index) => (
                <li key={index} className="text-blue-700 text-sm">• {tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 計時器顯示區域 */}
        <div className="bg-gradient-to-r from-[#003366] to-[#006699] rounded-xl p-6 mb-6 text-center">
          <div className="text-6xl font-bold text-white mb-2">
            {timeLeft}
          </div>
          <div className="text-white/80 text-sm">
            {isTimerRunning ? '倒數中...' : isCompleted ? '練習完成！' : '設定時間（秒）'}
          </div>
          
          {/* 進度條 */}
          <div className="mt-4 bg-white/20 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-white h-full rounded-full transition-all duration-1000"
              style={{ width: `${((exercise.duration - timeLeft) / exercise.duration) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">設定目標</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">練習時間（秒）</label>
              <input
                type="number"
                value={timeLeft}
                onChange={(e) => setTimeLeft(Number(e.target.value))}
                disabled={isTimerRunning}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent disabled:bg-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">重複次數</label>
              <input
                type="number"
                value={repetitions}
                onChange={(e) => setRepetitions(Number(e.target.value))}
                disabled={isTimerRunning}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent disabled:bg-gray-200"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {!isTimerRunning && !isCompleted && (
            <button onClick={handleStartTimer} className="btn-primary flex-1">
              開始練習計時
            </button>
          )}
          {isTimerRunning && (
            <button onClick={handleReset} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
              取消計時
            </button>
          )}
          {isCompleted && (
            <button onClick={handleComplete} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
              完成練習 ✓
            </button>
          )}
          {!isTimerRunning && !isCompleted && isCompleted === false && timeLeft < exercise.duration && (
            <button onClick={handleComplete} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
              完成練習 ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
