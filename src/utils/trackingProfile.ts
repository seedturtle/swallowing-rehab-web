import type { Exercise } from '../data/types';

export type TrackingMode = 'mouth-open' | 'lip-pucker' | 'smile' | 'self-view';
export type CalibrationKey = 'closed' | 'open' | 'smile' | 'pucker';

export type TrackingCalibrationStep = {
  key: CalibrationKey;
  title: string;
  instruction: string;
  tip: string;
};

export type TrackingProfile = {
  mode: TrackingMode;
  quantifiable: boolean;
  title: string;
  targetLabel: string;
  targetPercent: number;
  patientNotice: string;
  metricNote: string;
  calibrationSteps: TrackingCalibrationStep[];
};

const closedStep: TrackingCalibrationStep = {
  key: 'closed',
  title: '自然放鬆',
  instruction: '嘴巴自然放鬆，正面看鏡頭。',
  tip: '不要刻意用力，保持平常表情。',
};

const mouthOpenProfile: TrackingProfile = {
  mode: 'mouth-open',
  quantifiable: true,
  title: '張口幅度量化',
  targetLabel: '目前張口',
  targetPercent: 80,
  patientNotice: '本項目打開鏡頭後，可以利用臉部辨識量化張口幅度。系統會用你的臉部比例做校正，因此手機拿近或拿遠時，數值仍會盡量保持一致。',
  metricNote: '量化方式：張口距離除以雙眼中心距離，再依你的閉口與最大張口校正成 0–100%。',
  calibrationSteps: [
    closedStep,
    {
      key: 'open',
      title: '最大張口',
      instruction: '嘴巴慢慢張到可以接受的最大程度。',
      tip: '不要勉強疼痛，維持穩定即可。',
    },
  ],
};

const lipPuckerProfile: TrackingProfile = {
  mode: 'lip-pucker',
  quantifiable: true,
  title: '圓唇程度量化',
  targetLabel: '圓唇程度',
  targetPercent: 80,
  patientNotice: '本項目打開鏡頭後，可以利用臉部辨識量化嘴唇收圓程度。系統會比較自然嘴型與最大圓唇嘴型，換算成個人化百分比。',
  metricNote: '量化方式：嘴角寬度變窄的程度除以雙眼中心距離，再依你的自然嘴型與最大圓唇校正成 0–100%。',
  calibrationSteps: [
    closedStep,
    {
      key: 'pucker',
      title: '最大噘嘴／圓唇',
      instruction: '像發「ㄨ」的嘴型，嘴唇向前收圓。',
      tip: '保持頭部不動，讓嘴角盡量向中間收。',
    },
  ],
};

const smileProfile: TrackingProfile = {
  mode: 'smile',
  quantifiable: true,
  title: '微笑外展量化',
  targetLabel: '微笑程度',
  targetPercent: 80,
  patientNotice: '本項目打開鏡頭後，可以利用臉部辨識量化嘴角左右外展程度。系統會比較自然表情與最大微笑，換算成個人化百分比。',
  metricNote: '量化方式：嘴角寬度增加的程度除以雙眼中心距離，再依你的自然表情與最大微笑校正成 0–100%。',
  calibrationSteps: [
    closedStep,
    {
      key: 'smile',
      title: '最大微笑',
      instruction: '嘴角盡量往左右打開。',
      tip: '保持頭部不要晃動，注意兩側是否對稱。',
    },
  ],
};

const selfViewProfile: TrackingProfile = {
  mode: 'self-view',
  quantifiable: false,
  title: '鏡頭自我觀察',
  targetLabel: '自我觀察',
  targetPercent: 0,
  patientNotice: '本項目的動作目前不適合只用臉部五官點可靠量化。開啟鏡頭後，主要提供患者看著自己的臉部或姿勢練習，請依照步驟與治療師指示進行。',
  metricNote: '為避免錯誤數值誤導，本項目不顯示量化分數。',
  calibrationSteps: [],
};

export function getExerciseTrackingProfile(exercise: Exercise): TrackingProfile {
  if (['facial-2', 'lip-2', 'trismus-1', 'trismus-2'].includes(exercise.id)) return mouthOpenProfile;
  if (exercise.id === 'lip-1') return lipPuckerProfile;
  if (exercise.name.includes('微笑')) return smileProfile;
  return selfViewProfile;
}
