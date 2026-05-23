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
  const [faceBox, setFaceBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);

  const drawFaceGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) * 0.35;

    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.ellipse(centerX, centerY + 10, radius * 0.7, radius, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.25, centerY - radius * 0.1, radius * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.25, centerY - radius * 0.1, radius * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.1, centerY + radius * 0.1);
    ctx.quadraticCurveTo(centerX, centerY + radius * 0.25, centerX + radius * 0.1, centerY + radius * 0.1);
    ctx.stroke();
  };

  const drawFaceLandmarks = (ctx: CanvasRenderingContext2D, landmarks: FaceLandmark[], w: number, h: number) => {
    ctx.fillStyle = '#f97316';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;

    if (landmarks.length === 468) {
      for (let i = 0; i < landmarks.length; i++) {
        const point = landmarks[i];
        const x = point.x * w;
        const y = point.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      const jaw = [0, 17, 33, 61, 81, 82, 291, 199, 152, 148, 176, 148, 152, 121, 234, 93, 37, 0];
      jaw.forEach((idx, i) => {
        const p = landmarks[idx];
        if (i === 0) ctx.moveTo(p.x * w, p.y * h);
        else ctx.lineTo(p.x * w, p.y * h);
      });
      ctx.stroke();
    }
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
    try {
      const tf = await import('@tensorflow/tfjs-core');
      await tf.setBackend('webgl');
      const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection');
      const model = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        { runtime: 'tfjs', maxFaces: 1, refineLandmarks: true }
      );
      modelRef.current = model;
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Model load error:', err);
      setError('AI 模型載入失敗，請稍後再試');
      setLoading(false);
      return false;
    }
  };

  const startTracking = async () => {
    if (!modelRef.current) {
      const loaded = await loadModel();
      if (!loaded) return;
    }

    setIsTracking(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detect = async () => {
      if (!isTracking || !modelRef.current || !video || !canvas) return;

      try {
        const faces = await modelRef.current.estimateFaces(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        if (faces.length > 0) {
          const face = faces[0];
          drawFaceLandmarks(ctx, face.keypoints as FaceLandmark[], canvas.width, canvas.height);
          
          if (face.box) {
            setFaceBox({
              x: (1 - face.box.xMax) * canvas.width,
              y: face.box.yMin * canvas.height,
              width: (face.box.xMax - face.box.xMin) * canvas.width,
              height: (face.box.yMax - face.box.yMin) * canvas.height
            });
          }
        } else {
          drawFaceGuide(ctx, canvas.width, canvas.height);
          setFaceBox(null);
        }
      } catch (err) {
        console.error('Detection error:', err);
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
    setFaceBox(null);
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
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="relative" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-contain"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="animate-spin text-3xl mb-2">⏳</div>
              <p>載入 AI 模型中...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 m-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="p-4 flex gap-3 flex-wrap">
        {!isTracking ? (
          <button
            onClick={startTracking}
            className="btn-primary flex-1 bg-green-600 hover:bg-green-700"
            disabled={loading}
          >
            {loading ? '載入中...' : '🎯 開始追蹤'}
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
          >
            停止追蹤
          </button>
        )}
      </div>

      {faceBox && (
        <div className="px-4 pb-4 text-sm text-green-400">
          ✓ 已偵測到臉部
        </div>
      )}
    </div>
  );
}
