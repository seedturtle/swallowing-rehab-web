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

  const loadModels = async () => {
    setLoadingModel(true);
    try {
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      setModelLoaded(true);
      setLoadingModel(false);
    } catch (e) {
      console.warn('face-api models failed to load, using guide only');
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
      if (!modelLoaded && !loadingModel) {
        loadModels();
      }
      startDrawLoop();
    } catch (e) {
      setCameraError('Cannot access camera');
    }
  };

  const startDrawLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const draw = async () => {
      if (video.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);

        // Mirror: draw video flipped horizontally
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -w, 0, w, h);
        ctx.restore();

        if (modelLoaded) {
          try {
            const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
            const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
            if (detections.length > 0) {
              const det = detections[0];
              // Mirror landmarks drawing
              ctx.save();
              ctx.scale(-1, 1);
              // Draw face box
              const box = det.detection.box;
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 2;
              ctx.strokeRect(-box.x - box.width, box.y, box.width, box.height);
              // Draw landmarks
              const landmarks = det.landmarks.positions;
              ctx.fillStyle = '#ff8800';
              for (const pt of landmarks) {
                ctx.beginPath();
                ctx.arc(-pt.x, pt.y, 2, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }
          } catch (e) {
            // Face detection failed silently
          }
        }

        // Always draw guide ellipse
        ctx.save();
        ctx.scale(-1, 1);
        const cx = -w / 2;
        const cy = h * 0.4;
        const rx = w * 0.25;
        const ry = h * 0.3;
        ctx.strokeStyle = modelLoaded ? 'rgba(0,255,0,0.5)' : 'rgba(0,255,0,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="space-y-3">
      {cameraError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600 text-sm">
          Warning: {cameraError}
        </div>
      )}
      {loadingModel && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-600 text-sm">
          Loading AI model...
        </div>
      )}
      {modelLoaded && (
        <div className="bg-green-50 border border-green-200 rounded p-2 text-green-600 text-sm">
          AI face tracking ready
        </div>
      )}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 300 }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
      </div>
      <div className="flex gap-3">
        <button onClick={startCamera} className="btn-primary flex-1 bg-blue-600 hover:bg-blue-700">
          Start Camera
        </button>
        <button onClick={stopCamera} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
          Stop Camera
        </button>
      </div>
    </div>
  );
}
