import { useState, useEffect } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export function useFaceModel() {
  const [model, setModel] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadModel() {
      try {
        const model = await faceLandmarksDetection.load(
          faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
          { runtime: 'tfjs', maxFaces: 1, refineLandmarks: true }
        );
        if (mounted) setModel(model);
      } catch (err) {
        console.error('Model load error:', err);
        if (mounted) setError('模型載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    loadModel();
    return () => { mounted = false; };
  }, []);

  return { model, loading, error };
}
