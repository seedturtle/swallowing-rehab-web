import { useEffect, useRef, useState } from 'react';
import * as posedetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import type { TrackingProfile } from '../utils/trackingProfile';

interface PoseBodyTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
  profile: TrackingProfile;
}

type Keypoint = posedetection.Keypoint;

const HOLD_MS = 6000;
const TARGET_REPS = 10;

const EDGES: Array<[string, string]> = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getKeypoint(pose: posedetection.Pose, name: string): Keypoint | null {
  return pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.25) ?? null;
}

function distance(a: Keypoint, b: Keypoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Keypoint, b: Keypoint) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function drawSkeleton(ctx: CanvasRenderingContext2D, pose: posedetection.Pose) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#22C55E';
  ctx.fillStyle = '#EF4444';
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 3;

  for (const [aName, bName] of EDGES) {
    const a = getKeypoint(pose, aName);
    const b = getKeypoint(pose, bName);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const kp of pose.keypoints) {
    if ((kp.score ?? 0) < 0.25) continue;
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function bodyScore(pose: posedetection.Pose, profile: TrackingProfile): { percent: number; note: string } | null {
  const nose = getKeypoint(pose, 'nose');
  const leftShoulder = getKeypoint(pose, 'left_shoulder');
  const rightShoulder = getKeypoint(pose, 'right_shoulder');
  const leftWrist = getKeypoint(pose, 'left_wrist');
  const rightWrist = getKeypoint(pose, 'right_wrist');
  const leftElbow = getKeypoint(pose, 'left_elbow');
  const rightElbow = getKeypoint(pose, 'right_elbow');

  if (!leftShoulder || !rightShoulder) return null;
  const shoulderWidth = Math.max(20, distance(leftShoulder, rightShoulder));
  const shoulderMid = midpoint(leftShoulder, rightShoulder);

  if (profile.mode === 'pose-arm') {
    const candidates: number[] = [];
    for (const pair of [[leftShoulder, leftWrist], [rightShoulder, rightWrist]] as const) {
      const [shoulder, wrist] = pair;
      if (!shoulder || !wrist) continue;
      const verticalLift = (shoulder.y - wrist.y) / shoulderWidth;
      const sideReach = Math.abs(wrist.x - shoulder.x) / shoulderWidth;
      candidates.push(clamp(Math.max(verticalLift, sideReach) * 100, 0, 120));
    }
    if (candidates.length === 0) return null;
    const percent = clamp(Math.max(...candidates), 0, 100);
    return { percent, note: leftElbow || rightElbow ? '已追蹤肩膀、手肘、手腕' : '請讓手肘與手腕入鏡' };
  }

  if (profile.mode === 'pose-neck') {
    if (!nose) return null;
    const dx = Math.abs(nose.x - shoulderMid.x) / shoulderWidth;
    const dy = (shoulderMid.y - nose.y) / shoulderWidth;
    const centered = clamp(100 - dx * 160, 0, 100);
    const visibleHead = clamp((dy - 0.35) * 120, 0, 100);
    const percent = clamp(centered * 0.65 + visibleHead * 0.35, 0, 100);
    return { percent, note: '已追蹤鼻子與雙肩，提供頭頸姿勢輔助回饋' };
  }

  if (profile.mode === 'pose-posture') {
    if (!nose) return null;
    const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
    const headCenter = Math.abs(nose.x - shoulderMid.x) / shoulderWidth;
    const percent = clamp(100 - shoulderTilt * 180 - headCenter * 90, 0, 100);
    return { percent, note: '已追蹤雙肩與頭部中線，提供坐姿輔助回饋' };
  }

  return null;
}

export default function PoseBodyTracker({ videoRef, isTracking, profile }: PoseBodyTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const rafIdRef = useRef(0);
  const lastFrameAtRef = useRef(Date.now());
  const trainingRef = useRef({ percent: 0, holdMs: 0, reps: 0, readyForNextRep: true });

  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState('尚未啟動');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [personCount, setPersonCount] = useState(0);
  const [percent, setPercent] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState('尚未啟動');

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!isTracking || !video || !canvas) return;

      setLoadProgress(10);
      setLoadStep('初始化姿勢模型');
      setStatus('等待鏡頭畫面...');

      await new Promise<void>(resolve => {
        const applySize = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            resolve();
          }
        };
        applySize();
        video.onloadedmetadata = applySize;
        window.setTimeout(resolve, 1500);
      });

      if (!canvas.width || !canvas.height) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      try {
        setLoadProgress(45);
        setLoadStep('載入 MoveNet 單人骨架模型');
        detectorRef.current = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        if (cancelled) return;
        setLoadProgress(100);
        setLoadStep('姿勢模型準備完成');
        setModelLoaded(true);
        setStatus('請讓頭、肩膀、手臂盡量入鏡');
      } catch (err) {
        setStatus(`姿勢模型載入失敗：${String(err)}`);
        setModelLoaded(false);
        return;
      }

      async function tick() {
        const currentVideo = videoRef.current;
        const currentCanvas = canvasRef.current;
        const detector = detectorRef.current;
        if (!currentVideo || !currentCanvas || !detector || cancelled) return;

        try {
          if (currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0) {
            currentCanvas.width = currentVideo.videoWidth;
            currentCanvas.height = currentVideo.videoHeight;
          }
          const ctx = currentCanvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);

          const poses = await detector.estimatePoses(currentVideo, { maxPoses: 1, flipHorizontal: false });
          setPersonCount(poses.length);
          if (poses[0] && ctx) {
            drawSkeleton(ctx, poses[0]);
            const score = bodyScore(poses[0], profile);
            if (score) {
              const now = Date.now();
              const delta = Math.min(500, Math.max(0, now - lastFrameAtRef.current));
              const current = { ...trainingRef.current, percent: score.percent };
              if (score.percent >= profile.targetPercent && current.readyForNextRep) {
                current.holdMs = Math.min(HOLD_MS, current.holdMs + delta);
                if (current.holdMs >= HOLD_MS) {
                  current.reps = Math.min(TARGET_REPS, current.reps + 1);
                  current.readyForNextRep = false;
                  current.holdMs = 0;
                }
              } else if (score.percent < 50) {
                current.readyForNextRep = true;
                current.holdMs = 0;
              } else if (score.percent < profile.targetPercent) {
                current.holdMs = 0;
              }
              trainingRef.current = current;
              setPercent(Math.round(score.percent));
              setHoldMs(current.holdMs);
              setReps(current.reps);
              setStatus(score.note);
              lastFrameAtRef.current = now;
            } else {
              setStatus('請讓需要追蹤的身體部位完整入鏡');
            }
          } else {
            setStatus('尚未偵測到身體，請退後一點讓上半身入鏡');
          }
        } catch (err) {
          setStatus(`姿勢偵測錯誤：${String(err)}`);
        }

        rafIdRef.current = requestAnimationFrame(tick);
      }

      tick();
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafIdRef.current);
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, [isTracking, videoRef, profile]);

  const displayPercent = clamp(percent, 0, 100);
  const holdPercent = clamp((holdMs / HOLD_MS) * 100, 0, 100);

  return (
    <>
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-contain pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
        <div className="absolute left-2 right-2 top-2 flex flex-wrap items-start justify-between gap-2 text-xs">
          <div className="flex flex-col gap-1">
            <span className={`w-fit rounded px-2 py-1 text-white shadow ${modelLoaded ? 'bg-green-600/90' : 'bg-amber-600/90'}`}>
              {modelLoaded ? '姿勢模型已就緒' : `姿勢模型載入中 ${loadProgress}%`}
            </span>
            <span className="w-fit rounded bg-slate-900/65 px-2 py-1 text-white shadow">人：{personCount}</span>
          </div>
        </div>
        <div className="absolute bottom-2 left-2 right-2 rounded bg-slate-900/55 px-2 py-1 text-center text-[11px] leading-snug text-white">{status}</div>
      </div>

      <div className="absolute left-0 right-0 top-full mt-3 rounded-xl border border-purple-200 bg-white p-3 text-gray-800 shadow-sm">
        {!modelLoaded && isTracking ? (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
              <span>{loadStep}</span>
              <span>{loadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${loadProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">請退後一點，讓頭、肩膀與需要練習的肢體入鏡。</p>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold text-gray-900">{profile.title}</div>
                <div className="text-xs text-gray-500">到位程度達目標以上並維持 {(HOLD_MS / 1000).toFixed(0)} 秒，算 1 次有效練習。</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  trainingRef.current = { percent: 0, holdMs: 0, reps: 0, readyForNextRep: true };
                  setPercent(0);
                  setHoldMs(0);
                  setReps(0);
                }}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700"
              >
                重置
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="text-gray-500">{profile.targetLabel}</div>
                <div className={`text-2xl font-bold ${displayPercent >= profile.targetPercent ? 'text-green-600' : 'text-amber-600'}`}>{displayPercent}%</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-2">
                <div className="text-gray-500">維持時間</div>
                <div className="text-2xl font-bold text-sky-600">{(holdMs / 1000).toFixed(1)}秒</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-2">
                <div className="text-gray-500">有效次數</div>
                <div className="text-2xl font-bold text-purple-600">{reps}/{TARGET_REPS}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>動作到位 0%</span>
              <span className="font-semibold text-green-600">目標 {profile.targetPercent}%</span>
              <span>100%</span>
            </div>
            <div className="relative mt-1 h-6 overflow-hidden rounded-full bg-gray-200 shadow-inner">
              <div className={`h-full rounded-full transition-all ${displayPercent >= profile.targetPercent ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${displayPercent}%` }} />
              <div className="absolute top-0 h-full w-1 bg-green-800/70" style={{ left: `${profile.targetPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">{displayPercent}%</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">維持進度</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${holdPercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
