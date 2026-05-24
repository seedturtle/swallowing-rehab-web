import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

interface PoseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
  onLandmarksDetected?: (landmarks: any) => void;
}

const MODEL_URL = '/models';

const COLORS = {
  face: '#22C55E',
  brow: '#FACC15',
  eye: '#34D399',
  nose: '#60A5FA',
  mouth: '#F472B6',
  dot: '#FFFFFF',
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

function drawPath(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, color: string, close = false) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

function drawDots(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>) {
  ctx.fillStyle = COLORS.dot;
  for (const pt of pts) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
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

function drawLandmarks(canvas: HTMLCanvasElement, results: any[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGuide(ctx, canvas);

  for (const result of results) {
    const landmarks = result.landmarks;
    const jaw = landmarks.getJawOutline();
    const leftBrow = landmarks.getLeftEyeBrow();
    const rightBrow = landmarks.getRightEyeBrow();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();
    const mouth = landmarks.getMouth();

    drawPath(ctx, jaw, COLORS.face);
    drawPath(ctx, leftBrow, COLORS.brow);
    drawPath(ctx, rightBrow, COLORS.brow);
    drawPath(ctx, leftEye, COLORS.eye, true);
    drawPath(ctx, rightEye, COLORS.eye, true);
    drawPath(ctx, nose, COLORS.nose);
    drawPath(ctx, mouth, COLORS.mouth, true);
    drawDots(ctx, [...jaw, ...leftBrow, ...rightBrow, ...leftEye, ...rightEye, ...nose, ...mouth]);
  }
}

export default function PoseTracker({ videoRef, isTracking, onLandmarksDetected }: PoseTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafIdRef = useRef(0);
  const activeRef = useRef(false);
  const lastDetectedAtRef = useRef(Date.now());
  const [status, setStatus] = useState('尚未啟動');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [detectCount, setDetectCount] = useState(0);

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
        return;
      }

      setModelLoaded(false);
      setFaceCount(0);
      setDetectCount(0);
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
      if (!canvas.width || !canvas.height) {
        canvas.width = 640;
        canvas.height = 480;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGuide(ctx, canvas);
      }

      try {
        setStatus('載入模型：TinyFaceDetector...');
        await withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), 15000, 'TinyFaceDetector');
        if (cancelled) return;

        setStatus('載入模型：FaceLandmark68Tiny...');
        await withTimeout(faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL), 15000, 'FaceLandmark68Tiny');
        if (cancelled) return;
      } catch (err) {
        setStatus(`模型載入失敗：${String(err)}`);
        setModelLoaded(false);
        return;
      }

      setModelLoaded(true);
      setStatus('模型已就緒，請面對鏡頭');
      lastDetectedAtRef.current = Date.now();

      async function tick() {
        const currentVideo = videoRef.current;
        const currentCanvas = canvasRef.current;
        if (!activeRef.current || !currentVideo || !currentCanvas) return;

        if (currentVideo.readyState >= 2) {
          if (currentVideo.videoWidth && currentVideo.videoHeight) {
            currentCanvas.width = currentVideo.videoWidth;
            currentCanvas.height = currentVideo.videoHeight;
          }

          try {
            const results = await faceapi
              .detectAllFaces(currentVideo, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
              .withFaceLandmarks(true);

            drawLandmarks(currentCanvas, results as any[]);
            setFaceCount(results.length);
            onLandmarksDetected?.(results);

            if (results.length > 0) {
              setDetectCount(count => count + 1);
              lastDetectedAtRef.current = Date.now();
              setStatus(`已偵測到臉部：${results.length}`);
            } else if (Date.now() - lastDetectedAtRef.current > 3000) {
              setStatus('尚未偵測到臉，請正面看鏡頭並保持光線充足');
            }
          } catch (err) {
            setStatus(`偵測錯誤：${String(err)}`);
          }
        }

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

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />
      <div className="absolute top-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`px-2 py-1 rounded text-white ${modelLoaded ? 'bg-green-600' : 'bg-amber-600'}`}>
          {modelLoaded ? '模型已就緒' : '模型載入中'}
        </span>
        <span className="px-2 py-1 rounded bg-slate-900/80 text-white">
          臉：{faceCount}｜偵測：{detectCount}
        </span>
      </div>
      <div className="absolute bottom-2 left-2 right-2 rounded bg-slate-900/80 px-3 py-2 text-center text-xs text-white">
        {status}
      </div>
    </div>
  );
}
