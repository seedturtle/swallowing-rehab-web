import { useState, useRef, useEffect } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface PoseTrackerProps {
  onPoseDetected?: (landmarks: any) => void;
}

export default function PoseTracker({ onPoseDetected }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string>('');
  const detectorRef = useRef<any>(null);
  const animationRef = useRef<number>();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasPermission(true);
      await initDetector();
    } catch (err) {
      setError('無法存取鏡頭，請確認已授予鏡頭權限');
      setHasPermission(false);
    }
  };

  const initDetector = async () => {
    const model = poseDetection.SupportedModels.MoveNet;
    const detector = await poseDetection.createDetector(model, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    detectorRef.current = detector;
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRunning(false);
  };

  const detectPose = async () => {
    if (!videoRef.current || !detectorRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length > 0) {
        const landmarks = poses[0].keypoints;
        drawKeypoints(ctx, landmarks);
        onPoseDetected?.(landmarks);
      }
    }
    
    animationRef.current = requestAnimationFrame(detectPose);
  };

  const drawKeypoints = (ctx: CanvasRenderingContext2D, keypoints: any[]) => {
    keypoints.forEach((kp: any) => {
      if (kp.score && kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00FF00';
        ctx.fill();
      }
    });
    
    // 繪製臉部關鍵點
    const faceKeypoints = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    faceKeypoints.forEach(i => {
      if (keypoints[i]?.score > 0.3) {
        ctx.beginPath();
        ctx.arc(keypoints[i].x, keypoints[i].y, 8, 0, 2 * Math.PI);
        ctx.strokeStyle = '#FF6600';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  };

  const startTracking = () => {
    setIsRunning(true);
    detectPose();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        🎥 鏡頭追蹤模式
      </h3>
      
      <div className="relative bg-black rounded-lg overflow-hidden mb-3">
        <video 
          ref={videoRef} 
          className="w-full h-64 object-cover flip-horizontal"
          playsInline 
          muted
        />
        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-64"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        {!hasPermission ? (
          <button onClick={startCamera} className="btn-primary flex-1">
            📷 開啟鏡頭
          </button>
        ) : !isRunning ? (
          <button onClick={startTracking} className="btn-primary flex-1 bg-green-600">
            ▶️ 開始追蹤
          </button>
        ) : (
          <button onClick={() => { stopCamera(); startCamera(); }} className="btn-primary flex-1 bg-red-600">
            ⏹️ 停止追蹤
          </button>
        )}
      </div>

      <div className="mt-3 text-gray-300 text-sm">
        <p>💡 追蹤說明：</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>請確保臉部在鏡頭範圍內</li>
          <li>綠色點為偵測到的姿勢關鍵點</li>
          <li>橙色圓圈為臉部特徵點</li>
        </ul>
      </div>
    </div>
  );
}
