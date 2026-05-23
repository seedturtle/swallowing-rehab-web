import { useState, useRef, useEffect } from 'react';

interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const modelRef = useRef<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const drawFaceGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) * 0.35;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 10, radius * 0.7, radius, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#22c55e';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('請將臉部置於框內', centerX, h - 20);
    
    // Static guides
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.25, centerY - radius * 0.1, radius * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.25, centerY - radius * 0.1, radius * 0.1, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawFaceLandmarks = (ctx: CanvasRenderingContext2D, landmarks: FaceLandmark[], w: number, h: number) => {
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;

    // Draw key landmarks
    const keyPoints = [33, 133, 362, 263, 61, 291, 199, 168, 4, 234, 454, 323, 93, 323];
    for (const idx of keyPoints) {
      if (landmarks[idx]) {
        const point = landmarks[idx];
        const x = point.x * w;
        const y = point.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw jaw line
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    const jaw = [0, 17, 33, 61, 81, 82, 291, 199, 152, 148, 176, 148, 152, 121, 234, 93, 37, 0];
    ctx.beginPath();
    jaw.forEach((idx, i) => {
      if (landmarks[idx]) {
        const p = landmarks[idx];
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw eyebrows
    ctx.beginPath();
    [70, 63, 105, 66, 107, 65, 109, 151].forEach((idx, i) => {
      if (landmarks[idx]) {
        const p = landmarks[idx];
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.beginPath();
    [300, 293, 334, 296, 336, 295, 338, 382].forEach((idx, i) => {
      if (landmarks[idx]) {
        const p = landmarks[idx];
        const x = p.x * w;
        const y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
    } catch (err) {
      setError('無法存取鏡頭：請確保已授予鏡頭權限');
      console.error('Camera error:', err);
    }
  };

  const loadModel = async () => {
    setLoading(true);
    setError(null);
    try {
      const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection');
      const tf = await import('@tensorflow/tfjs-core');
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu');
      }
      
      const model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        { runtime: 'tfjs', maxFaces: 1, refineLandmarks: true }
      );
      modelRef.current = model;
      setModelReady(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.warn('Model loading failed, using static guides:', err);
      setModelReady(false);
      setLoading(false);
      return false;
    }
  };

  const startTracking = async () => {
    // Try to load model, but continue even if it fails
    if (!modelRef.current) {
      await loadModel();
    }

    setIsTracking(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detect = async () => {
      if (!isTracking) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (modelReady && modelRef.current && video.readyState === 4) {
        try {
          const faces = await modelRef.current.estimateFaces(video);
          if (faces.length > 0 && faces[0].keypoints) {
            drawFaceLandmarks(ctx, faces[0].keypoints, canvas.width, canvas.height);
          } else {
            drawFaceGuide(ctx, canvas.width, canvas.height);
          }
        } catch (err) {
          drawFaceGuide(ctx, canvas.width, canvas.height);
        }
      } else {
        drawFaceGuide(ctx, canvas.width, canvas.height);
      }

      animationRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ aspectRatio: '4/3', maxHeight: '400px' }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black rounded-lg"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          width={640}
          height={480}
        />
      </div>

      {loading && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
          <div className="text-blue-600 font-medium">AI 模型載入中，請稍候...</div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <p className="text-red-600 text-center">{error}</p>
        </div>
      )}

      <div className="mt-4 flex gap-3">
        {!isTracking ? (
          <button
            onClick={startTracking}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? '模型載入中...' : '開始追蹤'}
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-lg font-medium"
          >
            停止追蹤
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
        <p className="font-medium text-gray-700">功能說明：</p>
        <ul className="mt-2 text-gray-600 space-y-1">
          <li>• 請將臉部置於綠色橢圓框內</li>
          <li>• 追蹤啟動後會顯示臉部特徵點（橙色）</li>
          <li>• AI 模型載入可能需要一些時間</li>
          {modelReady && <li className="text-green-600">✓ AI 人臉追蹤已就緒</li>}
          {!modelReady && !loading && <li className="text-orange-500">⚠ AI 模型載入失敗，將使用引導線</li>}
        </ul>
      </div>
    </div>
  );
}
