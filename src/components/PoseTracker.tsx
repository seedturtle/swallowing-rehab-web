import { useState, useRef } from 'react';

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [modelStatus, setModelStatus] = useState<string>('');
  const animRef = useRef<number>();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsTracking(true);
      setModelStatus('ready');
      drawGuide();
    } catch (e: any) {
      setModelStatus('camera-denied');
    }
  };

  const drawGuide = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 3;
    const rx = canvas.width * 0.18;
    const ry = canvas.height * 0.22;
    ctx.strokeStyle = 'rgba(0, 255, 128, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.stroke();
    animRef.current = requestAnimationFrame(drawGuide);
  };

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setIsTracking(false);
    setModelStatus('');
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="mt-4">
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ maxWidth: 400, margin: '0 auto' }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full -scale-x-100" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
      <div className="mt-3 text-center">
        {modelStatus === 'ready' && (
          <div className="bg-green-900/50 text-green-300 rounded-lg p-3">
            ✅ 追蹤中 - 請對齊綠色虛線橢圓引導框
          </div>
        )}
        {modelStatus === 'camera-denied' && (
          <div className="bg-red-900/50 text-red-300 rounded-lg p-3">
            ⚠️ 無法存取鏡頭 - 請確認瀏覽器已授權
          </div>
        )}
        <div className="mt-3 flex gap-3">
          {!isTracking ? (
            <button onClick={startCamera} className="btn-primary flex-1 bg-blue-600 hover:bg-blue-700">
              📷 開啟鏡頭追蹤
            </button>
          ) : (
            <button onClick={stopCamera} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
              ⏹️ 關閉鏡頭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
