import { useEffect, useRef, useState } from 'react';
import * as posedetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import type { TrackingProfile } from '../utils/trackingProfile';
import type { TrackingSummary } from '../data/types';

type PracticeState = 'idle' | 'countdown' | 'active';
type CalibrationStep = 'neutral' | 'maximum';
type Keypoint = posedetection.Keypoint;

type PoseMeasure = {
  raw: number;
  note: string;
};

type PoseCalibration = {
  neutral: number | null;
  maximum: number | null;
};

interface PoseBodyTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
  profile: TrackingProfile;
  onTrackingSummary?: (summary: TrackingSummary) => void;
}

const HOLD_MS = 6000;
const CALIBRATION_MS = 6000;
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

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

async function ensureTfBackend(onProgress?: (message: string) => void) {
  const current = tf.getBackend();
  if (current && current !== 'webgpu') {
    await tf.ready();
    return current;
  }

  try {
    onProgress?.('初始化 WebGL 後端');
    await tf.setBackend('webgl');
    await tf.ready();
    return 'webgl';
  } catch (webglError) {
    console.warn('WebGL backend failed, falling back to CPU', webglError);
    onProgress?.('WebGL 不可用，改用 CPU 後端');
    await tf.setBackend('cpu');
    await tf.ready();
    return 'cpu';
  }
}

function poseRawMeasure(pose: posedetection.Pose, profile: TrackingProfile): PoseMeasure | null {
  const nose = getKeypoint(pose, 'nose');
  const leftEye = getKeypoint(pose, 'left_eye');
  const rightEye = getKeypoint(pose, 'right_eye');
  const leftEar = getKeypoint(pose, 'left_ear');
  const rightEar = getKeypoint(pose, 'right_ear');
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
    for (const [shoulder, wrist] of [[leftShoulder, leftWrist], [rightShoulder, rightWrist]] as const) {
      if (!shoulder || !wrist) continue;
      const verticalLift = (shoulder.y - wrist.y) / shoulderWidth;
      const sideReach = Math.abs(wrist.x - shoulder.x) / shoulderWidth;
      candidates.push(Math.max(verticalLift, sideReach));
    }
    if (!candidates.length) return null;
    return {
      raw: Math.max(...candidates),
      note: leftElbow || rightElbow ? '已追蹤肩膀、手肘、手腕' : '請讓手肘與手腕入鏡',
    };
  }

  if (profile.mode === 'pose-neck') {
    if (!nose) return null;
    const dx = (nose.x - shoulderMid.x) / shoulderWidth;
    const dy = (shoulderMid.y - nose.y) / shoulderWidth;
    const eyeTilt = leftEye && rightEye ? Math.abs(leftEye.y - rightEye.y) / shoulderWidth : 0;
    const earShift = leftEar && rightEar ? Math.abs(leftEar.x - rightEar.x) / shoulderWidth : 0;
    const raw = Math.hypot(dx, dy * 0.55) + eyeTilt * 0.5 + Math.max(0, 0.7 - earShift) * 0.15;
    return {
      raw,
      note: 'MoveNet 沒有直接頸椎點；此處以鼻子、眼耳與雙肩位置估算頭頸動作',
    };
  }

  if (profile.mode === 'pose-posture') {
    if (!nose) return null;
    const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y) / shoulderWidth;
    const headCenter = Math.abs(nose.x - shoulderMid.x) / shoulderWidth;
    const raw = shoulderTilt * 0.65 + headCenter * 0.35;
    return {
      raw,
      note: '已追蹤鼻子與雙肩；以頭部中線與肩膀水平估算坐姿穩定度',
    };
  }

  return null;
}

function calibratedPercent(measure: PoseMeasure, calibration: PoseCalibration, profile: TrackingProfile) {
  if (profile.mode === 'pose-posture') {
    if (calibration.neutral === null) return null;
    const deviation = Math.abs(measure.raw - calibration.neutral);
    return clamp(100 - deviation * 260, 0, 100);
  }

  if (calibration.neutral === null || calibration.maximum === null) return null;
  const range = calibration.maximum - calibration.neutral;
  if (!Number.isFinite(range) || Math.abs(range) < 0.03) return null;
  return clamp(((measure.raw - calibration.neutral) / range) * 100, 0, 120);
}

export default function PoseBodyTracker({ videoRef, isTracking, profile, onTrackingSummary }: PoseBodyTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const rafIdRef = useRef(0);
  const lastFrameAtRef = useRef(Date.now());
  const trainingRef = useRef({ percent: 0, holdMs: 0, reps: 0, readyForNextRep: true, maxPercent: 0, sumPercent: 0, samples: 0, totalHoldMs: 0 });
  const practiceCountdownStartedAtRef = useRef(0);
  const calibrationSamplesRef = useRef<number[]>([]);

  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState('尚未啟動');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [personCount, setPersonCount] = useState(0);
  const [rawMeasure, setRawMeasure] = useState<PoseMeasure | null>(null);
  const [calibration, setCalibration] = useState<PoseCalibration>({ neutral: null, maximum: null });
  const [calibrationStep, setCalibrationStep] = useState<CalibrationStep | null>(null);
  const [calibrationRemainingMs, setCalibrationRemainingMs] = useState(0);
  const [percent, setPercent] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [reps, setReps] = useState(0);
  const [status, setStatus] = useState('尚未啟動');
  const [practiceState, setPracticeState] = useState<PracticeState>('idle');
  const [practiceCountdownMs, setPracticeCountdownMs] = useState(0);

  const requiresMaximum = profile.mode !== 'pose-posture';
  const calibrated = calibration.neutral !== null && (!requiresMaximum || calibration.maximum !== null);

  function resetTraining() {
    trainingRef.current = { percent: 0, holdMs: 0, reps: 0, readyForNextRep: true, maxPercent: 0, sumPercent: 0, samples: 0, totalHoldMs: 0 };
    setPercent(0);
    setHoldMs(0);
    setReps(0);
    setPracticeState('idle');
  }

  function startCalibration(step: CalibrationStep) {
    calibrationSamplesRef.current = [];
    setCalibrationStep(step);
    setCalibrationRemainingMs(CALIBRATION_MS);
    setPracticeState('idle');
    resetTraining();
  }

  function finishCalibrationStep(step: CalibrationStep) {
    const value = average(calibrationSamplesRef.current);
    if (value === null) {
      setStatus('校正失敗：請讓需要追蹤的身體部位完整入鏡後再試一次');
      setCalibrationStep(null);
      return;
    }

    setCalibration(current => {
      const next = { ...current, [step]: value };
      if (step === 'neutral' && requiresMaximum) {
        window.setTimeout(() => startCalibration('maximum'), 400);
      }
      return next;
    });

    if (step === 'maximum' || !requiresMaximum) {
      setStatus('姿勢校正完成，請按開始練習');
      setCalibrationStep(null);
    }
  }

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
        setLoadProgress(35);
        setLoadStep('初始化 TensorFlow 後端');
        const backend = await ensureTfBackend(step => setLoadStep(step));
        if (cancelled) return;
        setLoadProgress(55);
        setLoadStep(`載入 MoveNet 單人骨架模型（${backend}）`);
        detectorRef.current = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        if (cancelled) return;
        setLoadProgress(100);
        setLoadStep('姿勢模型準備完成');
        setModelLoaded(true);
        setStatus('請先做姿勢校正：自然中立位，必要時再做最大可接受幅度');
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
            const measure = poseRawMeasure(poses[0], profile);
            setRawMeasure(measure);
            if (measure) {
              const now = Date.now();
              const delta = Math.min(500, Math.max(0, now - lastFrameAtRef.current));

              if (calibrationStep) {
                calibrationSamplesRef.current.push(measure.raw);
                setStatus(calibrationStep === 'neutral' ? '校正中：請保持自然中立姿勢' : '校正中：請做到最大可接受幅度');
              }

              const calibrated = calibratedPercent(measure, calibration, profile);
              if (calibrated !== null) {
                const current = { ...trainingRef.current, percent: calibrated };
                if (practiceState === 'active') {
                  const capped = clamp(calibrated, 0, 100);
                  current.maxPercent = Math.max(current.maxPercent, capped);
                  current.sumPercent += capped;
                  current.samples += 1;
                  if (calibrated >= profile.targetPercent) current.totalHoldMs += delta;
                }
                if (practiceState === 'active' && calibrated >= profile.targetPercent && current.readyForNextRep) {
                  current.holdMs = Math.min(HOLD_MS, current.holdMs + delta);
                  if (current.holdMs >= HOLD_MS) {
                    current.reps = Math.min(TARGET_REPS, current.reps + 1);
                    current.readyForNextRep = false;
                    current.holdMs = 0;
                  }
                } else if (practiceState === 'active' && calibrated < 50) {
                  current.readyForNextRep = true;
                  current.holdMs = 0;
                } else if (practiceState === 'active' && calibrated < profile.targetPercent) {
                  current.holdMs = 0;
                }
                trainingRef.current = current;
                setPercent(Math.round(calibrated));
                setHoldMs(current.holdMs);
                setReps(current.reps);
              }
              setStatus(measure.note);
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
  }, [isTracking, videoRef, profile, calibration, calibrationStep, practiceState]);

  useEffect(() => {
    if (!calibrationStep) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, CALIBRATION_MS - (Date.now() - startedAt));
      setCalibrationRemainingMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
        finishCalibrationStep(calibrationStep);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [calibrationStep]);

  useEffect(() => {
    const current = trainingRef.current;
    onTrackingSummary?.({
      module: profile.module,
      mode: profile.mode,
      targetLabel: profile.targetLabel,
      reps,
      maxPercent: Math.round(current.maxPercent),
      avgPercent: current.samples > 0 ? Math.round(current.sumPercent / current.samples) : undefined,
      targetHoldSeconds: Number((current.totalHoldMs / 1000).toFixed(1)),
      totalHoldSeconds: Number((current.totalHoldMs / 1000).toFixed(1)),
      completedTarget: reps >= TARGET_REPS,
      samples: current.samples,
    });
  }, [reps, percent, holdMs, profile, onTrackingSummary]);

  const displayPercent = practiceState === 'idle' ? 0 : clamp(percent, 0, 100);

  useEffect(() => {
    if (practiceState !== 'countdown') return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 3000 - (Date.now() - practiceCountdownStartedAtRef.current));
      setPracticeCountdownMs(remaining);
      if (remaining <= 0) {
        setPracticeState('active');
        setPracticeCountdownMs(0);
        lastFrameAtRef.current = Date.now();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [practiceState]);

  const holdPercent = clamp((holdMs / HOLD_MS) * 100, 0, 100);
  const canStartPractice = modelLoaded && calibrated && rawMeasure !== null;

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
        {calibrationStep && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-3xl bg-purple-950/65 px-10 py-7 text-center text-white shadow-2xl backdrop-blur-sm">
              <div className="text-sm font-semibold tracking-wide text-purple-200">
                {calibrationStep === 'neutral' ? '姿勢校正：自然中立位' : '姿勢校正：最大可接受幅度'}
              </div>
              <div className="mt-3 text-8xl font-black leading-none tabular-nums drop-shadow-lg">
                {Math.max(1, Math.ceil(calibrationRemainingMs / 1000))}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-purple-300" style={{ width: `${clamp((1 - calibrationRemainingMs / CALIBRATION_MS) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
        {practiceState === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-3xl bg-green-950/65 px-10 py-7 text-center text-white shadow-2xl backdrop-blur-sm">
              <div className="text-sm font-semibold tracking-wide text-green-200">準備開始練習</div>
              <div className="mt-3 text-8xl font-black leading-none tabular-nums drop-shadow-lg">
                {Math.max(1, Math.ceil(practiceCountdownMs / 1000))}
              </div>
              <div className="mt-2 text-xs text-slate-200">倒數結束後開始計算有效次數</div>
            </div>
          </div>
        )}
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
                <div className="text-xs text-gray-500">
                  MoveNet 主要追蹤鼻、眼、耳、肩、肘、腕、髖等骨架點；頭頸分數是用頭部相對肩膀位置估算，並非直接量到頸椎。
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCalibration({ neutral: null, maximum: null });
                    startCalibration('neutral');
                  }}
                  disabled={!rawMeasure || !!calibrationStep}
                  className="rounded bg-purple-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  重新校正
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetTraining();
                    practiceCountdownStartedAtRef.current = Date.now();
                    setPracticeCountdownMs(3000);
                    setPracticeState('countdown');
                  }}
                  disabled={!canStartPractice || !!calibrationStep}
                  className="rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  開始練習
                </button>
                <button type="button" onClick={resetTraining} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700">重置</button>
              </div>
            </div>
            {!calibrated && (
              <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs leading-relaxed text-purple-800">
                請先做姿勢校正：第一步記錄自然中立位；{requiresMaximum ? '第二步記錄最大可接受幅度，作為 100%。' : '此坐姿項目會把校正時的坐直姿勢作為 100%。'}
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-700">動作到位程度</div>
                  <div className="text-[11px] text-gray-500">{!calibrated ? '請先完成校正' : practiceState === 'idle' ? '請先按開始練習' : '條狀指示越滿代表越接近 100%'}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${displayPercent >= profile.targetPercent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {displayPercent >= profile.targetPercent ? '已達標' : '繼續加油'}
                </span>
              </div>
              <div className="relative h-10 overflow-hidden rounded-full bg-gray-200 shadow-inner">
                <div className={`h-full rounded-full transition-all duration-200 ${displayPercent >= profile.targetPercent ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${displayPercent}%` }} />
                <div className="absolute top-0 h-full w-1 bg-green-800/70" style={{ left: `${profile.targetPercent}%` }} />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-800">
                  {!calibrated ? '請先完成校正' : practiceState === 'idle' ? '請按開始練習' : `${profile.targetLabel}：${displayPercent}%`}
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-gray-500">
                <span>0%</span>
                <span>目標 {profile.targetPercent}%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-sky-50 p-2">
                <div className="text-gray-500">維持時間</div>
                <div className="text-xl font-bold text-sky-600">{(holdMs / 1000).toFixed(1)}秒</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-2">
                <div className="text-gray-500">有效次數</div>
                <div className="text-xl font-bold text-purple-600">{reps}/{TARGET_REPS}</div>
              </div>
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
