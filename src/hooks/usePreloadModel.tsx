import { useEffect, useState } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export function usePreloadModel() {
  const [model, setModel] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        console.log('Loading face model...');
        const m = await faceLandmarksDetection.load(
          faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
          { runtime: 'tfjs', maxFaces: 1, refineLandmarks: true }
        );
        setModel(m);
        console.log('Face model loaded!');
      } catch (err) {
        console.error('Model load failed:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { model, loading };
}
