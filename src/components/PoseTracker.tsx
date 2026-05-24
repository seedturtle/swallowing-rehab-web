import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

interface PoseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
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
type CalibrationKey = 'closed' | 'open' | 'smile' | 'pucker';
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
const TARGET_OPEN_PERCENT = 80;
const TARGET_REPS = 10;

const CALIBRATION_STEPS: Array<{
  key: CalibrationKey;
  title: string;
  instruction: string;
  tip: string;
}> = [
  {
    key: 'closed',
    title: '自然閉口',
    instruction: '嘴巴輕輕閉起來，正面看鏡頭。',
    tip: '不要用力咬牙，維持放鬆。',
  },
  {
    key: 'open',
    title: '最大張口',
    instruction: '嘴巴慢慢張到可以接受的最大程度。',
    tip: '不要勉強疼痛，維持穩定即可。',
  },
  {
    key: 'smile',
    title: '最大微笑',
    instruction: '嘴角盡量往左右打開。',
    tip: '保持頭部不要晃動。',
  },
  {
    key: 'pucker',
    title: '噘嘴／圓唇',
    instruction: '像發「ㄨ」的嘴型，嘴唇向前收圓。',
    tip: '維持 6 秒，系統會自動記錄。',
  },
];

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
  return { closed: null, open: null, smile: null, pucker: null };
}

function calibrationComplete(values: CalibrationValues) {
  return Boolean(values.closed && values.open && values.smile && values.pucker);
}

export default function PoseTracker({ videoRef, isTracking, onLandmarksDetected }: PoseTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef(0);
  const activeRef = useRef(false);
  const lastDetectedAtRef = useRef(Date.now());
  const calibrationSamplesRef = useRef<Record<CalibrationKey, FaceMetrics[]>>({ closed: [], open: [], smile: [], pucker: [] });
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
    calibrationSamplesRef.current = { closed: [], open: [], smile: [], pucker: [] };
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
    if (index < 0 || index >= CALIBRATION_STEPS.length) return;

    const step = CALIBRATION_STEPS[index];
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
    if (nextIndex >= CALIBRATION_STEPS.length) {
      const nextCalibration = {
        closed: meanMetrics(calibrationSamplesRef.current.closed),
        open: meanMetrics(calibrationSamplesRef.current.open),
        smile: meanMetrics(calibrationSamplesRef.current.smile),
        pucker: meanMetrics(calibrationSamplesRef.current.pucker),
      };
      setCalibration(nextCalibration);
      calibrationStepIndexRef.current = -1;
      setCalibrationUi({
        active: false,
        stepIndex: -1,
        remainingMs: 0,
        message: '校正完成，可以開始張口練習。',
      });
      resetTraining();
      return;
    }

    calibrationStepIndexRef.current = nextIndex;
    calibrationStartedAtRef.current = Date.now();
    const nextStep = CALIBRATION_STEPS[nextIndex];
    setCalibrationUi({
      active: true,
      stepIndex: nextIndex,
      remainingMs: HOLD_MS,
      message: `下一步：${nextStep.title}`,
    });
  }

  function updateTraining(metrics: FaceMetrics, values: CalibrationValues) {
    if (!values.closed || !values.open) return;
    const range = values.open.mouthOpenRatio - values.closed.mouthOpenRatio;
    if (!Number.isFinite(range) || range < 0.02) return;

    const now = Date.now();
    const deltaMs = Math.min(250, Math.max(0, now - lastFrameAtRef.current));
    const openPercent = clamp(((metrics.mouthOpenRatio - values.closed.mouthOpenRatio) / range) * 100, 0, 130);
    const current = { ...trainingRef.current, openPercent };

    if (openPercent >= TARGET_OPEN_PERCENT && current.readyForNextRep) {
      current.holdMs = Math.min(HOLD_MS, current.holdMs + deltaMs);
      if (current.holdMs >= HOLD_MS) {
        current.reps = Math.min(TARGET_REPS, current.reps + 1);
        current.readyForNextRep = false;
        current.holdMs = 0;
      }
    } else if (openPercent < 50) {
      current.readyForNextRep = true;
      current.holdMs = 0;
    } else if (openPercent < TARGET_OPEN_PERCENT) {
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
      setStatus('模型已就緒，請先做臉部動作校正');
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
                  if (calibrationComplete(currentCalibration)) updateTraining(metrics, currentCalibration);
                  return currentCalibration;
                });
                setStatus(`已偵測到臉部｜五官點：${metrics.pointCount}｜張口比：${metrics.mouthOpenRatio.toFixed(3)}`);
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

  const currentStep = calibrationUi.active ? CALIBRATION_STEPS[calibrationUi.stepIndex] : null;
  const isCalibrated = calibrationComplete(calibration);
  const holdPercent = clamp((training.holdMs / HOLD_MS) * 100, 0, 100);
  const openPercent = Math.round(training.openPercent);
  const displayOpenPercent = clamp(openPercent, 0, 100);

  return (
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

        {modelLoaded && !calibrationUi.active && !isCalibrated && (
          <button
            type="button"
            onClick={startCalibration}
            disabled={!latestMetrics}
            className="pointer-events-auto rounded-lg bg-purple-600/95 px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {latestMetrics ? '開始校正' : '臉入鏡後校正'}
          </button>
        )}

        {modelLoaded && isCalibrated && !calibrationUi.active && (
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-lg bg-slate-900/70 px-2 py-1 text-right text-white shadow">
              <div className="text-[11px] text-slate-200">目前張口</div>
              <div className={`text-lg font-bold leading-tight ${displayOpenPercent >= TARGET_OPEN_PERCENT ? 'text-green-300' : 'text-amber-300'}`}>
                {displayOpenPercent}%
              </div>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={startCalibration} className="pointer-events-auto rounded bg-slate-800/85 px-2 py-1 text-[11px] text-white shadow">
                重新校正
              </button>
              <button type="button" onClick={resetTraining} className="pointer-events-auto rounded bg-slate-800/85 px-2 py-1 text-[11px] text-white shadow">
                重置
              </button>
            </div>
          </div>
        )}
      </div>

      {!modelLoaded && isTracking && (
        <div className="absolute left-2 right-2 top-16 rounded-lg bg-slate-900/75 px-3 py-2 text-white shadow">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{loadStep}</span>
            <span>{loadProgress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${loadProgress}%` }} />
          </div>
        </div>
      )}

      {modelLoaded && calibrationUi.active && currentStep && (
        <div className="absolute left-2 right-2 top-16 rounded-xl bg-purple-950/80 p-2 text-white shadow-lg">
          <div className="flex items-center justify-between text-[11px] text-purple-100">
            <span>校正 {calibrationUi.stepIndex + 1} / {CALIBRATION_STEPS.length}</span>
            <span>{Math.ceil(calibrationUi.remainingMs / 1000)} 秒</span>
          </div>
          <div className="mt-0.5 text-base font-bold leading-tight">{currentStep.title}</div>
          <div className="text-xs leading-snug">{currentStep.instruction}</div>
          <div className="mt-1 text-[11px] leading-snug text-purple-100">{currentStep.tip}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-purple-800">
            <div className="h-full rounded-full bg-purple-300 transition-all" style={{ width: `${100 - (calibrationUi.remainingMs / HOLD_MS) * 100}%` }} />
          </div>
        </div>
      )}

      {modelLoaded && isCalibrated && !calibrationUi.active && (
        <div className="absolute left-2 right-2 top-[86px] rounded-lg bg-slate-900/60 px-2 py-1.5 text-white shadow">
          <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
            <div>
              <div className="text-slate-200">目標</div>
              <div className="font-bold text-green-300">{TARGET_OPEN_PERCENT}%</div>
            </div>
            <div>
              <div className="text-slate-200">維持</div>
              <div className="font-bold text-sky-300">{(training.holdMs / 1000).toFixed(1)} / {(HOLD_MS / 1000).toFixed(0)}秒</div>
            </div>
            <div>
              <div className="text-slate-200">有效</div>
              <div className="font-bold text-purple-300">{training.reps}/{TARGET_REPS}</div>
            </div>
          </div>
          <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${displayOpenPercent}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-green-300" style={{ left: `${TARGET_OPEN_PERCENT}%` }} />
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${holdPercent}%` }} />
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 rounded bg-slate-900/55 px-2 py-1 text-center text-[11px] leading-snug text-white">
        {calibrationUi.active && currentStep ? `${currentStep.title}｜${Math.ceil(calibrationUi.remainingMs / 1000)} 秒` : status}
      </div>
    </div>
  );
}
