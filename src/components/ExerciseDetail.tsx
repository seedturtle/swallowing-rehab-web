import { useState, useEffect, useRef } from 'react';
import PoseTracker from './PoseTracker';
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
  chewing: '/images/cartoon_chewing.jpg',
  swallow: '/images/cartoon_swallow.jpg',
  posture: '/images/cartoon_posture.jpg',
};

const difficultyText: Record<string, string> = {
  basic: '基礎',
  intermediate: '中階',
  advanced: '進階',
};

const categoryNames: Record<string, string> = {
  facial: '臉部運動',
  tongue: '舌頭運動',
  lip: '嘴唇運動',
  chewing: '咀嚼運動',
  swallow: '吞嚥練習',
  posture: '姿勢調整',
};

export default function ExerciseDetail({ exercise, onBack, onComplete }: ExerciseDetailProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exercise.duration || 60);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setIsCompleted(true);
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

  const imgSrc = categoryImages[exercise.category] || '/images/cartoon_facial.jpg';

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
      {/* 返回按鈕 + 分類標籤 */}
      <div className="flex items-center justify-between">
        <button onClick={onBack}
          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 text-base">
          ← 返回列表
        </button>
        <span className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium">
          {categoryNames[exercise.category] || exercise.category}
        </span>
      </div>

      {/* 標題 + 圖片並排 */}
      <div className="flex gap-5 items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              exercise.difficulty === 'basic' ? 'bg-green-100 text-green-700' :
              exercise.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {difficultyText[exercise.difficulty] || exercise.difficulty}
            </span>
            <span className="text-xs text-gray-400">⏱ {exercise.duration} 秒</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{exercise.name}</h2>
          <p className="text-gray-600 text-sm">{exercise.description}</p>
        </div>
        <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50 shadow-sm">
          <img src={imgSrc} alt={exercise.name}
            className="w-full h-full object-cover" loading="lazy" />
        </div>
      </div>

      {/* 步驟指示 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          📋 動作步驟
        </h3>
        <ul className="space-y-2">
          {exercise.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 小提醒 */}
      {exercise.tips && exercise.tips.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h4 className="font-bold text-amber-800 mb-2 text-sm flex items-center gap-1">💡 小提醒</h4>
          <ul className="space-y-1">
            {exercise.tips.map((tip, i) => (
              <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 計時器區塊 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 text-base">⏱ 練習計時</h3>
          {isTimerRunning ? (
            <span className="text-2xl font-mono font-bold text-blue-600">{timeLeft} 秒</span>
          ) : isCompleted ? (
            <span className="text-base font-bold text-green-600">✅ 已完成</span>
          ) : (
            <span className="text-sm text-gray-500">準備開始</span>
          )}
        </div>

        {/* 進度條 */}
        {isTimerRunning && (
          <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000 ease-linear"
              style={{ width: `${(timeLeft / (exercise.duration || 60)) * 100}%` }}
            />
          </div>
        )}

        {!isTimerRunning && !isCompleted && (
          <button onClick={startTimer}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base transition shadow-md">
            ▶ 開始練習計時（{exercise.duration} 秒）
          </button>
        )}
        {isTimerRunning && (
          <button onClick={() => { setIsTimerRunning(false); setIsCompleted(true); onComplete(exercise.id); }}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-base transition shadow-md">
            ✓ 略過 → 標示完成
          </button>
        )}
        {isCompleted && (
          <button onClick={() => { setIsCompleted(false); setTimeLeft(exercise.duration || 60); }}
            className="w-full py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-bold text-base transition shadow-md">
            🔄 重做
          </button>
        )}
      </div>

      {/* 鏡頭開關 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <button onClick={() => setShowCamera(!showCamera)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition">
          <span className="font-bold text-gray-800 text-base flex items-center gap-2">
            📷 鏡頭追蹤
            <span className="text-xs text-gray-400 font-normal">（配合動作檢查）</span>
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            showCamera ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {showCamera ? '開啟中' : '已關閉'}
          </span>
        </button>
        {showCamera && (
          <div className="px-5 pb-5">
            <video ref={videoRef} autoPlay playsInline className="hidden" />
            <PoseTracker videoRef={videoRef} isTracking={showCamera} />
          </div>
        )}
      </div>
    </div>
  );
}
