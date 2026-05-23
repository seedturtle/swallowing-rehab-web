import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>();
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [loadingModel, setLoadingModel] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    loadModels();
    return () => stopCamera();
  }, []);

  const loadModels = async () => {
    setLoadingModel(true);
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      setModelLoaded(true);
      setLoadingModel(false);
    } catch (e) {
      console.warn('face-api models failed to load, using guide only:', e);
      setLoadingModel(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      setCameraError('無法存取鏡頭');
    }
  };

  useEffect(() => {
    if (!modelLoaded) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let running = true;

    const draw = async () => {
      if (!running) return;
      if (video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (!ctx) { animRef.current = requestAnimationFrame(draw); return; }
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        // Draw video frame (mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -w, 0, w, h);
        ctx.restore();

        // Detect faces
        try {
          const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
          const result = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
          if (result.length > 0) {
            setFaceDetected(true);
            const det = result[0];
            const box = det.detection.box;
            const landmarks = det.landmarks;

            // Draw face box (mirrored position)
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(w - box.x - box.width, box.y, box.width, box.height);

            // Draw 68 landmarks (mirror X coordinate)
            const pts = landmarks.positions;
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i];
              const mx = w - pt.x; // mirror X
              if (i < 17) ctx.fillStyle = '#ffffff';
              else if (i < 27) ctx.fillStyle = '#00ff00';
              else if (i < 36) ctx.fillStyle = '#ff00ff';
              else if (i < 48) ctx.fillStyle = '#ffff00';
              else ctx.fillStyle = '#ff8800';
              ctx.beginPath();
              ctx.arc(mx, pt.y, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            // Left eye outline (mirrored)
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            [36,37,38,39,40,41].forEach((idx, i) => {
              const p = pts[idx];
              i === 0 ? ctx.moveTo(w - p.x, p.y) : ctx.lineTo(w - p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();

            // Right eye outline
            ctx.beginPath();
            [42,43,44,45,46,47].forEach((idx, i) => {
              const p = pts[idx];
              i === 0 ? ctx.moveTo(w - p.x, p.y) : ctx.lineTo(w - p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();

            // Mouth outline
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            [48,49,50,51,52,53,54,55,56,57,58,59].forEach((idx, i) => {
              const p = pts[idx];
              i === 0 ? ctx.moveTo(w - p.x, p.y) : ctx.lineTo(w - p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();
          } else {
            setFaceDetected(false);
          }
        } catch (e) { /* detection failed */ }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; };
  }, [modelLoaded]);

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="space-y-3 font-sans">
      {/* 狀態提示 */}
      {cameraError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm text-center">
          ⚠️ {cameraError}
        </div>
      )}
      {loadingModel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-600 text-sm text-center animate-pulse">
          🔄 正在載入 AI 模型，請稍候...
        </div>
      )}
      {modelLoaded && !loadingModel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm text-center">
          ✅ AI 模型已就緒 {faceDetected ? '👤 已偵測到臉部' : '請正視鏡頭以啟動辨識'}
        </div>
      )}

      {/* 鏡頭畫面 */}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 320, maxHeight: 480 }}>
        <video ref={videoRef} autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-contain scale-x-[-1]" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
        {!streamRef.current && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60">
            <p className="text-gray-400 text-lg">按下「開啟鏡頭」啟動追蹤</p>
          </div>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-3">
        <button onClick={startCamera}
          className="flex-1 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition shadow-md">
          📷 開啟鏡頭
        </button>
        <button onClick={stopCamera}
          className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-base transition shadow-md">
          ✋ 關閉鏡頭
        </button>
      </div>

      {/* 圖例 */}
      {modelLoaded && !loadingModel && (
        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
          <div className="flex justify-center gap-3 flex-wrap text-xs text-gray-500">
            <span><span className="inline-block w-3 h-3 rounded-full bg-white border border-gray-300 mr-1 align-middle"></span> 下巴</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1 align-middle"></span> 眉毛</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1 align-middle"></span> 眼睛</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1 align-middle"></span> 鼻子</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1 align-middle"></span> 嘴巴</span>
          </div>
        </div>
      )}
    </div>
  );
}
