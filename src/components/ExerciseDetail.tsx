import { useState, useEffect, useRef, useCallback } from 'react';
import PoseTracker from './PoseTracker';
import PoseBodyTracker from './PoseBodyTracker';
import { Exercise, TrackingSummary } from '../data/types';
import { getExerciseTrackingProfile } from '../utils/trackingProfile';

interface ExerciseDetailProps {
  exercise: Exercise;
  onBack: () => void;
  onComplete: (exerciseId: string, repetitions?: number, tracking?: TrackingSummary) => void;
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
  neck: '頸部運動',
  shoulder: '肩膀運動',
  trismus: '張口訓練',
  lymphedema: '淋巴水腫',
};

export default function ExerciseDetail({ exercise, onBack, onComplete }: ExerciseDetailProps) {
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exercise.duration || 60);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [camError, setCamError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackingProfile = getExerciseTrackingProfile(exercise);
  const [trackingSummary, setTrackingSummary] = useState<TrackingSummary | undefined>();
  const handleTrackingSummary = useCallback((summary: TrackingSummary) => {
    setTrackingSummary(summary);
  }, []);

  // 開啟/關閉鏡頭
  const toggleCamera = async () => {
    setCamError('');
    if (!showCamera) {
      setShowCamera(true);
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
            audio: false 
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        } catch (err: any) {
          console.error('相機開啟失敗:', err);
          setCamError(err.message || '無法開啟鏡頭');
          setShowCamera(false);
        }
      }, 100);
    } else {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setShowCamera(false);
    }
  };

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
  // 自動對應：videoUrl 或依練習名稱自動查找
  const videoSrc = (exercise as any).videoUrl || `/videos/${exercise.name}.mp4`;
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800">← 返回</button>
        <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">{categoryNames[exercise.category]}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4 items-start">
        {videoSrc ? (
          <div className="relative w-20 h-20 flex-shrink-0 cursor-pointer" onClick={() => setShowVideoPlayer(true)}>
            <img src={imgSrc} alt={categoryNames[exercise.category]} className="w-full h-full object-cover rounded-lg" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
              <span className="text-xl">▶️</span>
            </div>
          </div>
        ) : (
          <img src={imgSrc} alt={categoryNames[exercise.category]} className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-800">{exercise.name}</h2>
          <p className="text-gray-600 mt-1">{exercise.description}</p>
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            <span>{difficultyText[exercise.difficulty]}</span>
            <span>{exercise.duration}秒</span>
          </div>
          {videoSrc && !showVideoPlayer && (
            <button 
              onClick={() => setShowVideoPlayer(true)}
              className="mt-2 text-sm text-blue-600 font-medium hover:text-blue-800"
            >
              🎬 觀看示範影片
            </button>
          )}
        </div>
      </div>

      {/* 影片播放器 */}
      {videoSrc && showVideoPlayer && (
        <div className="bg-black rounded-xl overflow-hidden">
          <video 
            key={exercise.id}
            src={videoSrc} 
            controls
            autoPlay
            playsInline
            className="w-full max-h-[70vh] object-contain"
          />
          <div className="flex justify-end p-2">
            <button 
              onClick={() => setShowVideoPlayer(false)}
              className="text-white/60 text-sm hover:text-white"
            >
              關閉影片 ✕
            </button>
          </div>
        </div>
      )}

      {/* 詳細步驟說明 */}
      {exercise.instructions && exercise.instructions.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
          <h3 className="font-bold text-blue-800 mb-3">📋 練習步驟</h3>
          <ol className="space-y-2">
            {exercise.instructions.map((step, idx) => (
              <li key={idx} className="flex gap-2 text-gray-700">
                <span className="font-bold text-blue-600">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 技巧提示 */}
      {exercise.tips && exercise.tips.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <h3 className="font-bold text-amber-800 mb-3">💡 小技巧</h3>
          <ul className="space-y-1">
            {exercise.tips.map((tip, idx) => (
              <li key={idx} className="flex gap-2 text-gray-700">
                <span className="text-amber-600">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="font-bold text-gray-800 mb-3">開始練習</h3>
        
        {!isCompleted ? (
          <div className="space-y-3">
            {timeLeft > 0 && (
              <div className="text-center text-3xl font-bold text-blue-600">{timeLeft}秒</div>
            )}
            <button onClick={startTimer} disabled={isTimerRunning} className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">{isTimerRunning ? '計時中...' : '▶ 開始計時'}</button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-2xl mb-3">🎉 練習完成！</div>
            <button onClick={() => { setIsCompleted(false); setTimeLeft(exercise.duration || 60); }} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">再練一次</button>
            <button onClick={() => onComplete(exercise.id, trackingSummary?.reps, trackingSummary)} className="ml-2 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">完成</button>
          </div>
        )}
      </div>

      <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
        <button
          onClick={toggleCamera}
          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
            showCamera 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {showCamera ? '關閉鏡頭' : '開啟鏡頭'}
        </button>
        <div className={`mt-2 rounded-lg border px-3 py-2 text-sm ${trackingProfile.quantifiable ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {trackingProfile.patientNotice}
        </div>
        {camError && <div className="mt-2 text-red-600 text-sm">{camError}</div>}
        
        {showCamera && (
          <div className="mt-3 relative aspect-video rounded-lg bg-black" style={{ marginBottom: trackingProfile.quantifiable ? '300px' : '130px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full rounded-lg object-contain"
              style={{ transform: 'scaleX(-1)' }}
            />
            {trackingProfile.module === 'pose' ? (
              <PoseBodyTracker videoRef={videoRef} isTracking={showCamera} profile={trackingProfile} onTrackingSummary={handleTrackingSummary} />
            ) : (
              <PoseTracker videoRef={videoRef} isTracking={showCamera} profile={trackingProfile} onTrackingSummary={handleTrackingSummary} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
