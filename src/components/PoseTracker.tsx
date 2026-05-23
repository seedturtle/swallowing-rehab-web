import { useState, useRef, useEffect } from 'react';

interface PoseTrackerProps {
  preloadedModel?: any;
}

export default function PoseTracker({ preloadedModel }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const animationRef = useRef<number | null>(null);

  const loadModel = async () => {
    if (modelRef.current || modelError) return;
    
    try {
      console.log('[PoseTracker] 開始載入人臉模型...');
      const faceDetection = await import('@tensorflow-models/face-detection');
      const model = faceDetection.SupportedModels.MediaPipeFaceMesh;
      const detector = await faceDetection.createDetector(model, {
        runtime: 'tfjs',
        maxFaces: 1,
      });
      modelRef.current = detector;
      setModelReady(true);
      console.log('[PoseTracker] 人臉模型載入成功!');
    } catch (error) {
      console.error('[PoseTracker] 模型載入失敗:', error);
      setModelError('AI模型載入失敗，將使用引導線');
      setModelReady(false);
    }
  };

  const drawGuide = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, cx * 0.7, cy * 0.75, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,255,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 20 + i * 10, cy - 10);
      ctx.lineTo(cx - 20 + i * 10, cy + 10);
      ctx.strokeStyle = 'rgba(0,255,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    ctx.fillStyle = 'rgba(0,255,0,0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('請將臉部放入橢圓內', cx, cy + h * 0.4);
  };

  const detectFaces = async () => {
    if (!modelRef.current || !videoRef.current || !canvasRef.current || !isTracking) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    if (video.readyState !== 4) {
      animationRef.current = requestAnimationFrame(detectFaces);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(video, 0, 0);
    
    if (showGuide) drawGuide(ctx, canvas.width, canvas.height);
    
    try {
      const faces = await modelRef.current.estimateFaces(video);
      
      faces.forEach((face: any) => {
        ctx.fillStyle = 'rgba(0,200,255,0.8)';
        
        if (face.keypoints) {
          face.keypoints.forEach((kp: any) => {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        
        if (face.boundingBox) {
          ctx.strokeStyle = 'rgba(255,200,0,0.8)';
          ctx.lineWidth = 2;
          const bb = face.boundingBox;
          ctx.strokeRect(bb.xMin, bb.yMin, bb.xMax - bb.xMin, bb.yMax - bb.yMin);
        }
      });
      
      if (faces.length > 0) {
        ctx.fillStyle = 'rgba(0,255,0,0.8)';
        ctx.font = '16px sans-serif';
        ctx.fillText(`偵測到 ${faces.length} 張臉`, 20, 30);
      }
    } catch (error) {
      console.error('[PoseTracker] 偵測錯誤:', error);
    }
    
    animationRef.current = requestAnimationFrame(detectFaces);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          setStreamActive(true);
        };
      }
    } catch (error) {
      console.error('[PoseTracker] 鏡頭錯誤:', error);
      setModelError('鏡頭無法存取');
    }
  };

  const startTracking = async () => {
    if (isTracking) {
      setIsTracking(false);
      setShowGuide(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }
    
    await loadModel();
    setIsTracking(true);
    setShowGuide(true);
    detectFaces();
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsTracking(false);
    setStreamActive(false);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex gap-2 mb-4">
        <button onClick={startCamera} className="btn-secondary flex-1">
          📷 開啟鏡頭
        </button>
        <button onClick={startTracking} disabled={!streamActive} className="btn-primary flex-1">
          🎯 {isTracking ? '停止追蹤' : '開始追蹤'}
        </button>
        <button onClick={stopCamera} className="btn-secondary">✕ 關閉</button>
      </div>

      {modelReady && (
        <div className="mb-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg text-sm">
          ✅ AI 人臉追蹤已就緒
        </div>
      )}

      {modelError && (
        <div className="mb-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
          ⚠️ {modelError}
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden bg-gray-900" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        
        {!streamActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <p>請先開啟鏡頭</p>
          </div>
        )}
      </div>

      <div className="mt-3 text-sm text-gray-600">
        <p>📌 追蹤說明：{modelReady ? 'AI 即時追蹤已啟用' : '按「開始追蹤」載入 AI 模型'}</p>
      </div>
    </div>
  );
}
