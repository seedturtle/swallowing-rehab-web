import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import type { TrackingProfile } from '../utils/trackingProfile';

interface PoseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
  profile: TrackingProfile;
  onLandmarksDetected?: (landmarks: any) => void;
}

type Point = { x: number; y: number };
type FaceMetrics = {
  eyeDistance: number;
  mouthOpenRatio: number;
  mouthWidthRatio: number;
  mouthAspectRatio: number;
  pointCount: number;
};
type CalibrationKey = 'closed' | 'open' | 'smile' | 'pucker' | 'neutralPose' | 'targetPose';
type CalibrationValues = Record<CalibrationKey, FaceMetrics | null>;

type CalibrationUi = {
  active: boolean;
  stepIndex: number;
  remainingMs: number;
  message: string;
};

type TrainingState = {
  openPercent: number;
  holdMs: number;
  reps: number;
  readyForNextRep: boolean;
};

const MODEL_URL = '/models';
const HOLD_MS = 6000;
const TARGET_REPS = 10;

const COLORS = {
  box: '#22C55E',
  face: '#FFFFFF',
  brow: '#FACC15',
  eye: '#34D399',
  nose: '#60A5FA',
  mouth: '#F472B6',
  dot: '#EF4444',
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      err => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function center(points: Point[]) {
  const valid = points.filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (!valid.length) return { x: 0, y: 0 };
  return {
    x: valid.reduce((sum, pt) => sum + pt.x, 0) / valid.length,
    y: valid.reduce((sum, pt) => sum + pt.y, 0) / valid.length,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asPoints(landmarks: any): Point[] {
  if (Array.isArray(landmarks?.positions)) return landmarks.positions;
  if (Array.isArray(landmarks?._positions)) return landmarks._positions;
  if (typeof landmarks?.arraySync === 'function') return landmarks.arraySync();
  return [];
}

function pointSlice(points: Point[], start: number, end: number) {
  return points.slice(start, end).filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));
}

function meanMetrics(samples: FaceMetrics[]): FaceMetrics | null {
  if (!samples.length) return null;
  return {
    eyeDistance: samples.reduce((sum, item) => sum + item.eyeDistance, 0) / samples.length,
    mouthOpenRatio: samples.reduce((sum, item) => sum + item.mouthOpenRatio, 0) / samples.length,
    mouthWidthRatio: samples.reduce((sum, item) => sum + item.mouthWidthRatio, 0) / samples.length,
    mouthAspectRatio: samples.reduce((sum, item) => sum + item.mouthAspectRatio, 0) / samples.length,
    pointCount: Math.round(samples.reduce((sum, item) => sum + item.pointCount, 0) / samples.length),
  };
}

function computeMetrics(points: Point[]): FaceMetrics | null {
  if (points.length < 68) return null;
  const rightEyeCenter = center(pointSlice(points, 36, 42));
  const leftEyeCenter = center(pointSlice(points, 42, 48));
  const eyeDistance = distance(rightEyeCenter, leftEyeCenter);
  if (!Number.isFinite(eyeDistance) || eyeDistance < 5) return null;

  const mouthOpen = distance(points[62], points[66]);
  const mouthWidth = distance(points[48], points[54]);
  const mouthOpenRatio = mouthOpen / eyeDistance;
  const mouthWidthRatio = mouthWidth / eyeDistance;

  return {
    eyeDistance,
    mouthOpenRatio,
    mouthWidthRatio,
    mouthAspectRatio: mouthOpen / Math.max(mouthWidth, 1),
    pointCount: points.length,
  };
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Point[], color: string, close = false) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 3;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawDots(ctx: CanvasRenderingContext2D, pts: Point[]) {
  for (const pt of pts) {
    ctx.beginPath();
    ctx.fillStyle = COLORS.dot;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.arc(pt.x, pt.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawGuide(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radiusX = canvas.width * 0.26;
  const radiusY = canvas.height * 0.36;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(0, canvas.height - 42, canvas.width, 42);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${Math.max(14, canvas.width * 0.035)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('請將臉部置於橢圓內，正面看鏡頭', centerX, canvas.height - 16);
}

function drawBox(ctx: CanvasRenderingContext2D, detection: any) {
  const box = detection?.box || detection?._box;
  if (!box) return;
  const x = box.x ?? box._x ?? 0;
  const y = box.y ?? box._y ?? 0;
  const width = box.width ?? box._width ?? 0;
  const height = box.height ?? box._height ?? 0;
  ctx.strokeStyle = COLORS.box;
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.strokeRect(x, y, width, height);
  ctx.shadowBlur = 0;
}

function drawLandmarks(canvas: HTMLCanvasElement, video: HTMLVideoElement, results: any[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.length) {
    drawGuide(ctx, canvas);
    return;
  }

  for (const result of results) {
    drawBox(ctx, result.detection);
    const points = asPoints(result.landmarks);

    if (points.length >= 68) {
      const jaw = pointSlice(points, 0, 17);
      const rightBrow = pointSlice(points, 17, 22);
      const leftBrow = pointSlice(points, 22, 27);
      const noseBridge = pointSlice(points, 27, 31);
      const noseBase = pointSlice(points, 31, 36);
      const rightEye = pointSlice(points, 36, 42);
      const leftEye = pointSlice(points, 42, 48);
      const outerMouth = pointSlice(points, 48, 60);
      const innerMouth = pointSlice(points, 60, 68);

      drawPath(ctx, jaw, COLORS.face);
      drawPath(ctx, rightBrow, COLORS.brow);
      drawPath(ctx, leftBrow, COLORS.brow);
      drawPath(ctx, noseBridge, COLORS.nose);
      drawPath(ctx, noseBase, COLORS.nose);
      drawPath(ctx, rightEye, COLORS.eye, true);
      drawPath(ctx, leftEye, COLORS.eye, true);
      drawPath(ctx, outerMouth, COLORS.mouth, true);
      drawPath(ctx, innerMouth, COLORS.mouth, true);
      drawDots(ctx, [...rightEye, ...leftEye, ...outerMouth, ...innerMouth]);
    }
  }
}

function defaultCalibration(): CalibrationValues {
  return { closed: null, open: null, smile: null, pucker: null, neutralPose: null, targetPose: null };
}

function calibrationComplete(values: CalibrationValues, profile: TrackingProfile) {
  if (!profile.quantifiable || profile.calibrationSteps.length === 0) return false;
  return profile.calibrationSteps.every(step => Boolean(values[step.key]));
}

export default function PoseTracker({ videoRef, isTracking, profile, onLandmarksDetected }: PoseTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef(0);
  const activeRef = useRef(false);
  const lastDetectedAtRef = useRef(Date.now());
  const calibrationSamplesRef = useRef<Record<CalibrationKey, FaceMetrics[]>>({ closed: [], open: [], smile: [], pucker: [], neutralPose: [], targetPose: [] });
  const calibrationStartedAtRef = useRef(0);
  const calibrationStepIndexRef = useRef(-1);
  const trainingRef = useRef<TrainingState>({ openPercent: 0, holdMs: 0, reps: 0, readyForNextRep: true });
  const lastFrameAtRef = useRef(Date.now());

  const [status, setStatus] = useState('尚未啟動');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [detectCount, setDetectCount] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStep, setLoadStep] = useState('尚未啟動');
  const [latestMetrics, setLatestMetrics] = useState<FaceMetrics | null>(null);
  const [calibration, setCalibration] = useState<CalibrationValues>(defaultCalibration);
  const [calibrationUi, setCalibrationUi] = useState<CalibrationUi>({
    active: false,
    stepIndex: -1,
    remainingMs: HOLD_MS,
    message: '尚未校正',
  });
  const [training, setTraining] = useState<TrainingState>({ openPercent: 0, holdMs: 0, reps: 0, readyForNextRep: true });

  const startCalibration = () => {
    if (!profile.quantifiable || profile.calibrationSteps.length === 0) return;
    calibrationSamplesRef.current = { closed: [], open: [], smile: [], pucker: [], neutralPose: [], targetPose: [] };
    calibrationStartedAtRef.current = Date.now();
    calibrationStepIndexRef.current = 0;
    setCalibration(defaultCalibration());
    trainingRef.current = { openPercent: 0, holdMs: 0, reps: 0, readyForNextRep: true };
    setTraining(trainingRef.current);
    setCalibrationUi({
      active: true,
      stepIndex: 0,
      remainingMs: HOLD_MS,
      message: '校正開始，請照著畫面指示做。',
    });
  };

  const resetTraining = () => {
    trainingRef.current = { openPercent: 0, holdMs: 0, reps: 0, readyForNextRep: true };
    setTraining(trainingRef.current);
  };

  function updateCalibration(metrics: FaceMetrics) {
    const index = calibrationStepIndexRef.current;
    if (index < 0 || index >= profile.calibrationSteps.length) return;

    const step = profile.calibrationSteps[index];
    calibrationSamplesRef.current[step.key].push(metrics);
    const elapsed = Date.now() - calibrationStartedAtRef.current;
    const remainingMs = Math.max(0, HOLD_MS - elapsed);

    setCalibrationUi({
      active: true,
      stepIndex: index,
      remainingMs,
      message: `${step.title}：請維持 ${Math.ceil(remainingMs / 1000)} 秒`,
    });

    if (elapsed < HOLD_MS) return;

    const nextIndex = index + 1;
    if (nextIndex >= profile.calibrationSteps.length) {
      const nextCalibration = {
        closed: meanMetrics(calibrationSamplesRef.current.closed),
        open: meanMetrics(calibrationSamplesRef.current.open),
        smile: meanMetrics(calibrationSamplesRef.current.smile),
        pucker: meanMetrics(calibrationSamplesRef.current.pucker),
        neutralPose: meanMetrics(calibrationSamplesRef.current.neutralPose),
        targetPose: meanMetrics(calibrationSamplesRef.current.targetPose),
      };
      setCalibration(nextCalibration);
      calibrationStepIndexRef.current = -1;
      setCalibrationUi({
        active: false,
        stepIndex: -1,
        remainingMs: 0,
        message: `校正完成，可以開始${profile.title}。`,
      });
      resetTraining();
      return;
    }

    calibrationStepIndexRef.current = nextIndex;
    calibrationStartedAtRef.current = Date.now();
    const nextStep = profile.calibrationSteps[nextIndex];
    setCalibrationUi({
      active: true,
      stepIndex: nextIndex,
      remainingMs: HOLD_MS,
      message: `下一步：${nextStep.title}`,
    });
  }

  function metricPercent(metrics: FaceMetrics, values: CalibrationValues) {
    if (!values.closed) return null;
    if (profile.mode === 'mouth-open') {
      if (!values.open) return null;
      const range = values.open.mouthOpenRatio - values.closed.mouthOpenRatio;
      if (!Number.isFinite(range) || range < 0.02) return null;
      return ((metrics.mouthOpenRatio - values.closed.mouthOpenRatio) / range) * 100;
    }
    if (profile.mode === 'lip-pucker') {
      if (!values.pucker) return null;
      const range = values.closed.mouthWidthRatio - values.pucker.mouthWidthRatio;
      if (!Number.isFinite(range) || range < 0.02) return null;
      return ((values.closed.mouthWidthRatio - metrics.mouthWidthRatio) / range) * 100;
    }
    if (profile.mode === 'smile') {
      if (!values.smile) return null;
      const range = values.smile.mouthWidthRatio - values.closed.mouthWidthRatio;
      if (!Number.isFinite(range) || range < 0.02) return null;
      return ((metrics.mouthWidthRatio - values.closed.mouthWidthRatio) / range) * 100;
    }
    return null;
  }

  function updateTraining(metrics: FaceMetrics, values: CalibrationValues) {
    const percent = metricPercent(metrics, values);
    if (percent === null) return;

    const now = Date.now();
    const deltaMs = Math.min(250, Math.max(0, now - lastFrameAtRef.current));
    const currentPercent = clamp(percent, 0, 130);
    const current = { ...trainingRef.current, openPercent: currentPercent };

    if (currentPercent >= profile.targetPercent && current.readyForNextRep) {
      current.holdMs = Math.min(HOLD_MS, current.holdMs + deltaMs);
      if (current.holdMs >= HOLD_MS) {
        current.reps = Math.min(TARGET_REPS, current.reps + 1);
        current.readyForNextRep = false;
        current.holdMs = 0;
      }
    } else if (currentPercent < 50) {
      current.readyForNextRep = true;
      current.holdMs = 0;
    } else if (currentPercent < profile.targetPercent) {
      current.holdMs = 0;
    }

    trainingRef.current = current;
    setTraining(current);
  }

  useEffect(() => {
    let cancelled = false;
    activeRef.current = isTracking;

    async function init() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!isTracking || !video || !canvas) {
        setModelLoaded(false);
        setFaceCount(0);
        setDetectCount(0);
        setLoadProgress(0);
        setLoadStep('尚未啟動');
        return;
      }

      setModelLoaded(false);
      setFaceCount(0);
      setDetectCount(0);
      setLoadProgress(5);
      setLoadStep('初始化相機');
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

      if (cancelled) return;
      setLoadProgress(25);
      setLoadStep('相機已啟動');
      if (!canvas.width || !canvas.height) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGuide(ctx, canvas);
      }

      try {
        setLoadProgress(35);
        setLoadStep('載入 TinyFaceDetector');
        setStatus('載入模型：TinyFaceDetector...');
        await withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), 15000, 'TinyFaceDetector');
        if (cancelled) return;

        setLoadProgress(70);
        setLoadStep('載入 FaceLandmark68Tiny');
        setStatus('載入模型：FaceLandmark68Tiny...');
        await withTimeout(faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), 15000, 'FaceLandmark68Tiny');
        if (cancelled) return;
      } catch (err) {
        setLoadStep('模型載入失敗');
        setStatus(`模型載入失敗：${String(err)}`);
        setModelLoaded(false);
        return;
      }

      setLoadProgress(100);
      setLoadStep('模型準備完成');
      setModelLoaded(true);
      if (profile.quantifiable) {
        setStatus('模型已就緒，請先做此項目的動作校正');
      } else {
        setStatus('模型已就緒。本項目提供鏡頭自我觀察，不顯示量化分數。');
      }
      lastDetectedAtRef.current = Date.now();
      lastFrameAtRef.current = Date.now();

      async function tick() {
        const currentVideo = videoRef.current;
        const currentCanvas = canvasRef.current;
        if (!activeRef.current || !currentVideo || !currentCanvas) return;

        if (currentVideo.readyState >= 2) {
          try {
            const results = await faceapi
              .detectAllFaces(currentVideo, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
              .withFaceLandmarks(true);

            drawLandmarks(currentCanvas, currentVideo, results as any[]);
            setFaceCount(results.length);
            onLandmarksDetected?.(results);

            if (results.length > 0) {
              const points = asPoints((results[0] as any).landmarks);
              const metrics = computeMetrics(points);
              setDetectCount(count => count + 1);
              lastDetectedAtRef.current = Date.now();

              if (metrics) {
                setLatestMetrics(metrics);
                updateCalibration(metrics);
                setCalibration(currentCalibration => {
                  if (profile.quantifiable && calibrationComplete(currentCalibration, profile)) updateTraining(metrics, currentCalibration);
                  return currentCalibration;
                });
                setStatus(`已偵測到臉部｜五官點：${metrics.pointCount}｜${profile.targetLabel}：${Math.round(clamp(metricPercent(metrics, calibration) ?? 0, 0, 100))}%`);
              } else {
                setStatus(`已偵測到臉部，但五官點不足：${points.length}`);
              }
            } else if (Date.now() - lastDetectedAtRef.current > 3000) {
              setStatus('尚未偵測到臉，請正面看鏡頭並保持光線充足');
            }
          } catch (err) {
            setStatus(`偵測錯誤：${String(err)}`);
          }
        }

        lastFrameAtRef.current = Date.now();
        rafIdRef.current = requestAnimationFrame(tick);
      }

      tick();
    }

    init();

    return () => {
      cancelled = true;
      activeRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [isTracking, videoRef, onLandmarksDetected]);

  const currentStep = calibrationUi.active ? profile.calibrationSteps[calibrationUi.stepIndex] : null;
  const isCalibrated = profile.quantifiable && calibrationComplete(calibration, profile);
  const holdPercent = clamp((training.holdMs / HOLD_MS) * 100, 0, 100);
  const scorePercent = Math.round(training.openPercent);
  const displayScorePercent = clamp(scorePercent, 0, 100);

  return (
    <>
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />

        <div className="absolute left-2 right-2 top-2 flex flex-wrap items-start justify-between gap-2 text-xs">
          <div className="flex flex-col gap-1">
            <span className={`w-fit rounded px-2 py-1 text-white shadow ${modelLoaded ? 'bg-green-600/90' : 'bg-amber-600/90'}`}>
              {modelLoaded ? '模型已就緒' : `模型載入中 ${loadProgress}%`}
            </span>
            <span className="w-fit rounded bg-slate-900/65 px-2 py-1 text-white shadow">
              臉：{faceCount}｜偵測：{detectCount}
            </span>
          </div>
        </div>

        <div className="absolute bottom-2 left-2 right-2 rounded bg-slate-900/55 px-2 py-1 text-center text-[11px] leading-snug text-white">
          {calibrationUi.active && currentStep ? `${currentStep.title}｜${Math.ceil(calibrationUi.remainingMs / 1000)} 秒` : status}
        </div>
      </div>

      <div className="absolute left-0 right-0 top-full mt-3 rounded-xl border border-purple-200 bg-white p-3 text-gray-800 shadow-sm">
        {!modelLoaded && isTracking && (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
              <span>{loadStep}</span>
              <span>{loadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${loadProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-500">請保持臉在鏡頭中，模型載入完成後會開始偵測。</p>
          </div>
        )}

        {modelLoaded && !calibrationUi.active && !isCalibrated && profile.quantifiable && (
          <div>
            <div className="text-base font-bold text-purple-800">{profile.title}校正</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{profile.patientNotice}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{profile.metricNote}</p>
            <button
              type="button"
              onClick={startCalibration}
              disabled={!latestMetrics}
              className="mt-3 w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {latestMetrics ? '開始校正' : '請先讓臉出現在畫面中'}
            </button>
          </div>
        )}

        {modelLoaded && !profile.quantifiable && !calibrationUi.active && (
          <div>
            <div className="text-base font-bold text-amber-800">鏡頭自我觀察</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{profile.patientNotice}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{profile.metricNote}</p>
          </div>
        )}

        {modelLoaded && isCalibrated && !calibrationUi.active && (
          <div>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-base font-bold text-gray-900">{profile.title}</div>
                <div className="text-xs text-gray-500">達到目標以上並維持 {(HOLD_MS / 1000).toFixed(0)} 秒，算 1 次有效練習。</div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={startCalibration} className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                  重新校正
                </button>
                <button type="button" onClick={resetTraining} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700">
                  重置
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-amber-50 p-2">
                <div className="text-gray-500">{profile.targetLabel}</div>
                <div className={`text-2xl font-bold ${displayScorePercent >= profile.targetPercent ? 'text-green-600' : 'text-amber-600'}`}>
                  {displayScorePercent}%
                </div>
              </div>
              <div className="rounded-lg bg-sky-50 p-2">
                <div className="text-gray-500">維持時間</div>
                <div className="text-2xl font-bold text-sky-600">{(training.holdMs / 1000).toFixed(1)}秒</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-2">
                <div className="text-gray-500">有效次數</div>
                <div className="text-2xl font-bold text-purple-600">{training.reps}/{TARGET_REPS}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>{profile.targetLabel} 0%</span>
              <span className="font-semibold text-green-600">目標 {profile.targetPercent}%</span>
              <span>100%</span>
            </div>
            <div className="relative mt-1 h-6 overflow-hidden rounded-full bg-gray-200 shadow-inner">
              <div
                className={`h-full rounded-full transition-all ${displayScorePercent >= profile.targetPercent ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${displayScorePercent}%` }}
              />
              <div className="absolute top-0 h-full w-1 bg-green-800/70" style={{ left: `${profile.targetPercent}%` }} />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">
                {displayScorePercent}%
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
