import { useState, useRef, useEffect } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface PoseTrackerProps {
  onPoseDetected?: (landmarks: any) => void;
}

export default function PoseTracker({ onPoseDetected }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string>('');
  const detectorRef = useRef<any>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

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
      setCameraReady(true);

      try {
        const model = poseDetection.SupportedModels.MoveNet;
        const detector = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        detectorRef.current = detector;
        setModelReady(true);
      } catch (modelErr) {
        console.error('AI model load error:', modelErr);
        setError('\u{1F4E1} \u{1F4E1} AI\u{1F4E1}');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('\u{1F4E1} \u{1F4E1} \u{1F4E1}');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    setIsRunning(false);
    setCameraReady(false);
  };

  const detectPose = async () => {
    if (!videoRef.current || !detectorRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
        drawKeypoints(ctx, keypoints);
        ctx.restore();
        onPoseDetected?.(keypoints);
      }
    } catch (e) {
      console.error('Pose detection error:', e);
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <h3 className="text-white font-bold mb-3 flex items-center gap-2">
        Camera Tracking Mode
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
        <div className="bg-yellow-900/50 border border-yellow-600 text-yellow-200 text-sm p-3 rounded mb-3">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {!cameraReady ? (
          <button onClick={startCamera} className="btn-primary flex-1">
            Open Camera
          </button>
        ) : !isRunning ? (
          <button 
            onClick={startTracking} 
            className="btn-primary flex-1 bg-green-600 hover:bg-green-700"
            disabled={!modelReady}
          >
            {modelReady ? 'Start Tracking' : 'Loading AI Model...'}
          </button>
        ) : (
          <button onClick={stopCamera} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
            Stop Camera
          </button>
        )}
      </div>
    </div>
  );
}
