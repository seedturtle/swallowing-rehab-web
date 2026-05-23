import { useState, useEffect } from 'react';
import { Exercise } from '../data/types';
import { categories } from '../data/exercises';
import PoseTracker from './PoseTracker';

interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onComplete: (exerciseId: string, repetitions?: number) => void;
}

export default function ExerciseDetail({ exercise, onBack, onComplete }: ExerciseDetailProps) {
  const [timeLeft, setTimeLeft] = useState(exercise.duration);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [repetitions, setRepetitions] = useState(10);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setIsCompleted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const handleStartTimer = () => {
    setTimeLeft(exercise.duration);
    setIsCompleted(false);
    setIsTimerRunning(true);
  };

  const handleCancelTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(exercise.duration);
  };

  const handleComplete = () => {
    onComplete(exercise.id, repetitions);
    setIsCompleted(false);
    setTimeLeft(exercise.duration);
  };

  const progress = exercise.duration > 0 
    ? ((exercise.duration - timeLeft) / exercise.duration) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#003366] to-[#006699] text-white p-4">
        <button onClick={onBack} className="text-white mb-2">← 返回列表</button>
        <h1 className="text-xl font-bold">{exercise.name}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Exercise Info */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mb-2">
            {categories.find(c => c.id === exercise.category)?.name}
          </span>
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

        {/* 鏡頭追蹤功能 */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              🎥 鏡頭追蹤模式
            </h3>
            <button 
              onClick={() => setShowCamera(!showCamera)}
              className={`px-3 py-1 rounded-full text-sm ${showCamera ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
            >
              {showCamera ? '關閉' : '開啟'}
            </button>
          </div>
          
          {showCamera && <PoseTracker />}
        </div>

        {/* Tips */}
        {exercise.tips && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <h3 className="font-bold text-yellow-800 mb-2">💡 小技巧</h3>
            <ul className="space-y-1">
              {exercise.tips.map((tip, index) => (
                <li key={index} className="text-yellow-700 text-sm flex gap-2">
                  <span>•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timer Section */}
        {exercise.duration > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              ⏱️ 計時練習
            </h3>
            
            {/* Timer Display */}
            <div className="text-center mb-4">
              <div className={`text-6xl font-bold ${isTimerRunning ? 'text-[#003366]' : 'text-gray-400'}`}>
                {timeLeft}s
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
                <div 
                  className="bg-gradient-to-r from-[#003366] to-[#006699] h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isTimerRunning && (
                <p className="text-sm text-[#003366] mt-2 animate-pulse">倒數中...</p>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-3">
              {!isTimerRunning && !isCompleted && (
                <button onClick={handleStartTimer} className="btn-primary flex-1">
                  ▶️ 開始練習計時
                </button>
              )}
              {isTimerRunning && (
                <button onClick={handleCancelTimer} className="btn-primary flex-1 bg-gray-500">
                  ❌ 取消計時
                </button>
              )}
              {isCompleted && (
                <button onClick={handleComplete} className="btn-primary flex-1 bg-green-600">
                  ✓ 完成練習！
                </button>
              )}
            </div>
          </div>
        )}

        {/* Repetition Section */}
        {exercise.repetitions {exercise.repetitions > 0 && ({exercise.repetitions > 0 && ( exercise.repetitions > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              🔄 目標次數
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">目標次數</label>
                <input 
                  type="number" 
                  value={repetitions} 
                  onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full p-3 border-2 border-gray-300 rounded-lg text-center text-xl"
                  min="1"
                />
              </div>
              <div className="flex items-center justify-center text-4xl">
                / {exercise.repetitions}
              </div>
            </div>
            {!isTimerRunning && !isCompleted && (
              <button onClick={handleComplete} className="btn-primary w-full mt-4">
                ✓ 完成 {repetitions} 次
              </button>
            )}
          </div>
        )}

        {/* Complete Button */}
        {exercise.duration === 0 && (!exercise.repetitions || exercise.repetitions === 0) && (
          <button onClick={() => onComplete(exercise.id)} className="btn-primary w-full">
            ✓ 完成練習
          </button>
        )}
      </div>
    </div>
  );
}
