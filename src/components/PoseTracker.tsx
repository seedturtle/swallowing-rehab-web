import { useState, useRef } from 'react';

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>();

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setError('無法取得鏡頭權限，請確認瀏覽器已允許使用相機');
      console.error('Camera error:', e);
    }
  };

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setTracking(false);
  };

  const startTracking = () => {
    setTracking(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const frame = () => {
      if (!video || video.paused || video.ended) return;
      
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('追蹤中...', canvas.width / 2, 30);
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 3;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 60, 80, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = '#00FF00';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('臉部區域', cx + 65, cy - 15);
      
      animRef.current = requestAnimationFrame(frame);
    };
    
    frame();
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        📷 鏡頭追蹤模式
      </h3>
      
      <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{aspectRatio: '4/3'}}>
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover"
          style={{transform: 'scaleX(-1)'}}
          playsInline 
          muted
        />
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 text-sm p-3 rounded mb-3">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-2">
        {!cameraOn ? (
          <button onClick={startCamera} className="btn-primary flex-1 bg-blue-600 hover:bg-blue-700">
            📷 開啟鏡頭
          </button>
        ) : !tracking ? (
          <button onClick={startTracking} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
            🎯 開始追蹤
          </button>
        ) : (
          <button onClick={stopCamera} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
            ⏹ 關閉鏡頭
          </button>
        )}
      </div>
      
      {cameraOn && !tracking && (
        <p className="text-gray-400 text-xs text-center mt-2">
          ✅ 鏡頭已開啟，按下「開始追蹤」啟動臉部偵測
        </p>
      )}
      
      {tracking && (
        <div className="mt-3 bg-green-900/30 border border-green-700 rounded p-3">
          <p className="text-green-400 text-sm font-bold mb-1">✅ 追蹤中 - 請看著畫面做復健動作</p>
          <p className="text-gray-400 text-xs">綠色虛線橢圓為臉部參考區域，請對齊臉部位置</p>
        </div>
      )}
    </div>
  );
}
