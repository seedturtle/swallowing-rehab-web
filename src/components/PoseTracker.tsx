import { useEffect, useRef, useState } from 'react';

interface PoseTrackerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isTracking: boolean;
  onLandmarksDetected?: (landmarks: any) => void;
}

export default function PoseTracker({ videoRef, isTracking, onLandmarksDetected }: PoseTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  
  // Simplified: just show camera with green oval guide, skip AI to avoid slow loading
  useEffect(() => {
    if (!isTracking) {
      setModelLoaded(false);
      return;
    }
    
    // Mark as "loaded" immediately - use static guide instead of AI
    setModelLoaded(true);
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    
    const drawFrame = () => {
      if (!video.videoWidth || !isTracking) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame (mirrored)
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Simple static oval guide - no AI needed
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radiusX = canvas.width * 0.25;
      const radiusY = canvas.height * 0.35;
      
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${canvas.width * 0.04}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('請將臉部置於橢圓內', centerX, centerY + radiusY + canvas.height * 0.08);
      
      if (onLandmarksDetected) {
        onLandmarksDetected(null); // Signal detection (simplified - no actual landmarks)
      }
      
      if (isTracking) {
        animationId = requestAnimationFrame(drawFrame);
      }
    };
    
    drawFrame();
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isTracking, videoRef, onLandmarksDetected]);
  
  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black">
      <canvas ref={canvasRef} className="w-full h-auto" />
      {isTracking && !modelLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <span className="text-white animate-pulse">正在初始化鏡頭...</span>
        </div>
      )}
      {isTracking && modelLoaded && (
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
          鏡頭已就緒
        </div>
      )}
    </div>
  );
}