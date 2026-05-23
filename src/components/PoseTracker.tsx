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
      setCameraError('Cannot access camera');
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

        // Mirror video
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

            // Draw face box (mirrored)
            ctx.save();
            ctx.scale(-1, 1);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(-box.x - box.width, box.y, box.width, box.height);
            ctx.restore();

            // Draw 68 landmarks (mirrored)
            const pts = landmarks.positions;
            // Draw each point as a filled circle
            ctx.save();
            ctx.scale(-1, 1);
            for (let i = 0; i < pts.length; i++) {
              const pt = pts[i];
              // Color by facial region
              if (i < 17) { // jaw line
                ctx.fillStyle = '#ffffff';
              } else if (i < 22) { // left eyebrow
                ctx.fillStyle = '#00ff00';
              } else if (i < 27) { // right eyebrow
                ctx.fillStyle = '#00ff00';
              } else if (i < 31) { // nose bridge
                ctx.fillStyle = '#ff00ff';
              } else if (i < 36) { // nose tip
                ctx.fillStyle = '#ff00ff';
              } else if (i < 42) { // left eye
                ctx.fillStyle = '#ffff00';
              } else if (i < 48) { // right eye
                ctx.fillStyle = '#ffff00';
              } else if (i < 60) { // outer lips
                ctx.fillStyle = '#ff8800';
              } else { // inner lips
                ctx.fillStyle = '#ff4400';
              }
              ctx.beginPath();
              ctx.arc(-pt.x, pt.y, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            // Draw connections for eyes and mouth
            // Left eye outline
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const leftEye = [36,37,38,39,40,41];
            for (let i = 0; i < leftEye.length; i++) {
              const p = pts[leftEye[i]];
              if (i === 0) ctx.moveTo(-p.x, p.y);
              else ctx.lineTo(-p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();

            // Right eye outline
            ctx.beginPath();
            const rightEye = [42,43,44,45,46,47];
            for (let i = 0; i < rightEye.length; i++) {
              const p = pts[rightEye[i]];
              if (i === 0) ctx.moveTo(-p.x, p.y);
              else ctx.lineTo(-p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();

            // Mouth outline
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const outerLip = [48,49,50,51,52,53,54,55,56,57,58,59];
            for (let i = 0; i < outerLip.length; i++) {
              const p = pts[outerLip[i]];
              if (i === 0) ctx.moveTo(-p.x, p.y);
              else ctx.lineTo(-p.x, p.y);
            }
            ctx.closePath();
            ctx.stroke();

            ctx.restore();
          } else {
            setFaceDetected(false);
          }
        } catch (e) {
          // detection failed
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; };
  }, [modelLoaded]);

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

  return (
    <div className="space-y-3">
      {cameraError && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-600 text-sm">⚠ {cameraError}</div>
      )}
      {loadingModel && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-600 text-sm animate-pulse">Loading AI model...</div>
      )}
      {modelLoaded && !loadingModel && (
        <div className="bg-green-50 border border-green-200 rounded p-2 text-green-700 text-sm">
          AI model ready {faceDetected ? '✓ Face detected' : '- Look at the camera'}
        </div>
      )}
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 320 }}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain scale-x-[-1]" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
      </div>
      <div className="flex gap-3">
        <button onClick={startCamera} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition">
          Start Camera
        </button>
        <button onClick={stopCamera} className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition">
          Stop Camera
        </button>
      </div>
      <div className="text-xs text-gray-500 text-center space-y-1">
        <div className="flex justify-center gap-4">
          <span><span className="inline-block w-3 h-3 rounded-full bg-white mr-1"></span> Jaw</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span> Eyebrow</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span> Eye</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1"></span> Nose</span>
          <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"></span> Mouth</span>
        </div>
      </div>
    </div>
  );
}
