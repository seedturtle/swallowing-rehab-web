import { useState } from 'react';
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
  const category = categories.find(c => c.id === exercise.category);

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    setTimeLeft(exercise.duration);
  };

  const handleComplete = () => {
    onComplete(exercise.id, repetitions);
    setIsTimerRunning(false);
    alert('已完成今天的練習！');
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

        <div className="bg-gray-100 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-gray-800 mb-3">設定目標</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">練習時間（秒）</label>
              <input
                type="number"
                value={timeLeft}
                onChange={(e) => setTimeLeft(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">重複次數</label>
              <input
                type="number"
                value={repetitions}
                onChange={(e) => setRepetitions(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {!isTimerRunning ? (
            <button onClick={handleStartTimer} className="btn-primary flex-1">
              開始練習計時
            </button>
          ) : (
            <button onClick={handleComplete} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
              完成練習 ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}