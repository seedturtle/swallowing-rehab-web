import type { Exercise } from '../data/types';

export type TrackingModule = 'face' | 'pose' | 'self-view';
export type TrackingMode =
  | 'mouth-open'
  | 'lip-pucker'
  | 'smile'
  | 'facial-expression'
  | 'pose-neck'
  | 'pose-arm'
  | 'pose-posture'
  | 'self-view';
export type CalibrationKey = 'closed' | 'open' | 'smile' | 'pucker' | 'browRaise' | 'frown' | 'cheekPuff';

export type TrackingCalibrationStep = {
  key: CalibrationKey;
  title: string;
  instruction: string;
  tip: string;
};

export type TrackingProfile = {
  module: TrackingModule;
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
  module: 'face',
  mode: 'mouth-open',
  quantifiable: true,
  title: '張口幅度量化',
  targetLabel: '動作到位',
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
  module: 'face',
  mode: 'lip-pucker',
  quantifiable: true,
  title: '圓唇程度量化',
  targetLabel: '動作到位',
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
  module: 'face',
  mode: 'smile',
  quantifiable: true,
  title: '微笑外展量化',
  targetLabel: '動作到位',
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

const facialExpressionProfile: TrackingProfile = {
  module: 'face',
  mode: 'facial-expression',
  quantifiable: true,
  title: '臉部表情輔助量化',
  targetLabel: '表情到位',
  targetPercent: 75,
  patientNotice: '本項目打開鏡頭後，可以利用臉部辨識輔助量化抬眉、皺眉與鼓臉頰等表情動作。這類表情的數值較容易受光線、角度與臉型影響，主要作為即時回饋，幫助你看見自己是否有做出動作。',
  metricNote: '量化方式：系統會先記錄自然表情，再記錄最大抬眉、最大皺眉與最大鼓臉頰。練習時會取目前最接近的表情動作，換算成 0–100% 的輔助到位程度。',
  calibrationSteps: [
    closedStep,
    {
      key: 'browRaise',
      title: '最大抬眉',
      instruction: '盡量把眉毛往上抬，眼睛可以自然張開。',
      tip: '保持頭不要往後仰，維持表情穩定。',
    },
    {
      key: 'frown',
      title: '最大皺眉',
      instruction: '慢慢皺眉，讓左右眉頭往中間靠近。',
      tip: '不要低頭，正面看鏡頭，維持表情穩定。',
    },
    {
      key: 'cheekPuff',
      title: '最大鼓臉頰',
      instruction: '嘴巴閉起來，將兩側臉頰鼓起來。',
      tip: '盡量讓兩邊臉頰都鼓起，維持穩定。',
    },
  ],
};

function poseProfile(mode: 'pose-neck' | 'pose-arm' | 'pose-posture', title: string, notice: string, metricNote: string): TrackingProfile {
  return {
    module: 'pose',
    mode,
    quantifiable: true,
    title,
    targetLabel: '動作到位',
    targetPercent: 80,
    patientNotice: notice,
    metricNote,
    calibrationSteps: [],
  };
}

const poseNeckProfile = poseProfile(
  'pose-neck',
  '頭頸姿勢到位程度',
  '本項目打開鏡頭後，會利用身體骨架辨識輔助觀察頭頸姿勢，並以 0–100% 顯示動作到位程度。',
  '量化方式：追蹤鼻子、肩膀等骨架點，估計頭部位置與肩膀中線的相對變化。此為輔助回饋，仍需依治療師指示練習。',
);

const poseArmProfile = poseProfile(
  'pose-arm',
  '手臂動作到位程度',
  '本項目打開鏡頭後，會利用身體骨架辨識追蹤肩膀、手肘、手腕位置，並以 0–100% 顯示手臂是否舉到目標位置。',
  '量化方式：以肩膀為基準，追蹤手腕上舉或外展位置。鏡頭需能看到肩膀與手臂。',
);

const posePostureProfile = poseProfile(
  'pose-posture',
  '坐姿到位程度',
  '本項目打開鏡頭後，會利用身體骨架辨識輔助觀察坐姿與肩膀是否平穩，並以 0–100% 顯示姿勢到位程度。',
  '量化方式：追蹤雙肩、鼻子與身體中線，估計是否坐直、肩膀是否平衡。此分數為輔助提醒。',
);

const selfViewProfile: TrackingProfile = {
  module: 'self-view',
  mode: 'self-view',
  quantifiable: false,
  title: '鏡頭自我觀察',
  targetLabel: '自我觀察',
  targetPercent: 0,
  patientNotice: '本項目的動作目前不適合只用鏡頭可靠量化。開啟鏡頭後，主要提供患者看著自己的臉部或姿勢練習，請依照步驟與治療師指示進行。',
  metricNote: '為避免錯誤數值誤導，本項目不顯示量化分數。',
  calibrationSteps: [],
};

export function getExerciseTrackingProfile(exercise: Exercise): TrackingProfile {
  if (exercise.id === 'facial-1') return facialExpressionProfile;
  if (['facial-2', 'lip-2', 'trismus-1', 'trismus-2'].includes(exercise.id)) return mouthOpenProfile;
  if (exercise.id === 'lip-1') return lipPuckerProfile;
  if (exercise.name.includes('微笑')) return smileProfile;
  if (exercise.category === 'neck') return poseNeckProfile;
  if (exercise.category === 'shoulder') return poseArmProfile;
  if (exercise.category === 'posture') return posePostureProfile;
  return selfViewProfile;
}
