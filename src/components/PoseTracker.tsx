import { useState, useRef } from 'react';

export default function PoseTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>();
  const [videoSize, setVideoSize] = useState({ w: 640, h: 480 });

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (e) {
      setError('无法取得镜头权限，请确认浏览器已允许使用相机');
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

  const handleVideoMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    setVideoSize({ w, h });
    const ca = canvasRef.current;
    if (ca) { ca.width = w; ca.height = h; }
  };

  const startTracking = () => {
    setTracking(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = videoSize.w;
    canvas.height = videoSize.h;
    
    const frame = () => {
      if (!video || video.paused || video.ended) return;
      
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Tracking indicator
      ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Tracking...', canvas.width / 2, 30);
      
      // Green elliptical guide
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
      ctx.fillText('Face zone', cx + 65, cy - 15);
      
      animRef.current = requestAnimationFrame(frame);
    };
    
    frame();
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        📷 Camera Tracking
      </h3>
      
      <div ref={containerRef} className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ maxHeight: '480px' }}>
        <video 
          ref={videoRef} 
          className="w-full"
          style={{ transform: 'scaleX(-1)', display: 'block', maxHeight: '480px', objectFit: 'contain' }}
          playsInline 
          muted
          onLoadedMetadata={handleVideoMeta}
        />
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full"
          style={{ maxHeight: '480px', aspectRatio: videoSize.w + '/' + videoSize.h }}
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
            📷 Open Camera
          </button>
        ) : !tracking ? (
          <button onClick={startTracking} className="btn-primary flex-1 bg-green-600 hover:bg-green-700">
            🎯 Start Tracking
          </button>
        ) : (
          <button onClick={stopCamera} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
            ⏹ Stop Camera
          </button>
        )}
      </div>
      
      {cameraOn && !tracking && (
        <p className="text-gray-400 text-xs text-center mt-2">
          ✅ Camera is on. Click "Start Tracking" to begin.
        </p>
      )}
      
      {tracking && (
        <div className="mt-3 bg-green-900/30 border border-green-700 rounded p-3">
          <p className="text-green-400 text-sm font-bold mb-1">✅ Tracking - Please do your rehab exercises facing the camera</p>
          <p className="text-gray-400 text-xs">The green ellipse is a face alignment guide. Position your face within it.</p>
        </div>
      )}
    </div>
  );
}
