import { Exercise } from './types';

export const exercises: Exercise[] = [
  // 臉部運動
  {
    id: 'facial-1',
    name: '臉部表情運動',
    category: 'facial',
    difficulty: 'basic',
    duration: 60,
    description: '透過臉部肌肉運動促進吞嚥相關肌肉靈活度',
    instructions: [
      '對著鏡子坐直或站直',
      '盡量抬高眉毛，維持 5 秒',
      '慢慢皺眉，維持 5 秒',
      '鼓起臉頰，維持 5 秒',
      '收縮臉頰，維持 5 秒',
      '重複 10 次',
    ],
    tips: [
      '每天做 2-3 組',
      '可在刷牙時順便練習',
      '注意兩側臉頰是否對稱',
    ],
    videoUrl: "/videos/facial-demo.mp4",
  },
  {
    id: 'facial-2',
    videoUrl: 'https://drive.google.com/uc?export=download&id=11vLQE-mXc0aqZqgsqmowacsx4aal0qivreq',
    name: '下巴開合運動',
    category: 'facial',
    difficulty: 'basic',
    duration: 45,
    description: '訓練下顎肌肉，增加口腔開合幅度',
    instructions: [
      '坐直，保持頭部正中',
      '慢慢張開嘴巴至最大幅度',
      '維持 3-5 秒',
      '慢慢合上嘴巴',
      '重複 10-15 次',
    ],
    tips: ['如有疼痛請減輕幅度', '可放一面鏡子看著動作是否正確'],
  },

  // 舌頭運動
  {
    id: 'tongue-1',
    name: '舌頭伸出收回',
    category: 'tongue',
    difficulty: 'basic',
    duration: 60,
    description: '強化舌頭力量與靈活度',
    instructions: [
      '坐直或站直',
      '慢慢將舌頭伸出嘴巴',
      '盡量伸出到最长',
      '維持 3-5 秒',
      '慢慢收回舌頭',
      '重複 10 次',
    ],
    tips: [
      '舌尖可塗少許蜂蜜增加動機',
      '如無法自行伸出，可用紗布輔助',
    ],
  },
  {
    id: 'tongue-2',
    name: '舌頭左右移動',
    category: 'tongue',
    difficulty: 'basic',
    duration: 60,
    description: '訓練舌頭側向移動能力',
    instructions: [
      '嘴巴微張',
      '將舌頭伸出並移向左側嘴角',
      '維持 3 秒',
      '移回中央',
      '移向右側嘴角',
      '維持 3 秒',
      '重複 10 次',
    ],
  },
  {
    id: 'tongue-3',
    name: '舌頭上下運動',
    category: 'tongue',
    difficulty: 'intermediate',
    duration: 60,
    description: '訓練舌頭垂直方向活動度',
    instructions: [
      '嘴巴微張',
      '舌尖向上触碰上顎',
      '維持 2-3 秒',
      '舌尖向下触碰下唇內側',
      '維持 2-3 秒',
      '重複 10 次',
    ],
  },

  // 嘴唇運動
  {
    id: 'lip-1',
    name: '嘴唇圓圈運動',
    category: 'lip',
    difficulty: 'basic',
    duration: 45,
    description: '訓練嘴唇圓潤與收緊能力',
    instructions: [
      '坐直，保持放鬆',
      '將嘴唇嘟成圓形（像說「嗚」）',
      '維持 5 秒',
      '放鬆恢復正常',
      '重複 10 次',
    ],
  },
  {
    id: 'lip-2',
    name: '嘴唇張開闭合',
    category: 'lip',
    difficulty: 'basic',
    duration: 45,
    description: '訓練嘴唇張開與閉合能力',
    instructions: [
      '嘴唇自然閉合',
      '慢慢張開嘴巴說「啊」',
      '維持 3 秒',
      '慢慢閉合嘴唇',
      '重複 10 次',
    ],
  },

  // 咀嚼運動
  {
    id: 'chewing-1',
    name: '咀嚼模擬運動',
    category: 'chewing',
    difficulty: 'intermediate',
    duration: 60,
    description: '模擬咀嚼動作，訓練咀嚼肌',
    instructions: [
      '坐直，肩膀放鬆',
      '想像口中有一塊口香糖',
      '慢慢咀嚼 10 下（左側）',
      '更換右側咀嚼 10 下',
      '兩側交替進行',
    ],
    tips: ['不需要真的吃東西', '想像動作即可達到訓練效果'],
  },

  // 吞嚥練習
  {
    id: 'swallow-1',
    name: '用力吞嚥練習（Masako）',
    category: 'swallow',
    difficulty: 'advanced',
    duration: 90,
    description: '強化舌根力量，改善吞嚥功能',
    instructions: [
      '坐直，肩膀放鬆',
      '舌尖稍微伸出，用力抵住牙齒後方',
      '做吞嚥動作（保持舌尖推牙齒）',
      '感受到舌根用力收縮',
      '維持 2 秒後放鬆',
      '重複 5-10 次',
    ],
    tips: ['進食時不可使用此技巧', '飯後一小時內避免練習'],
  },
  {
    id: 'swallow-2',
    name: '門德爾森手法（Mendelsohn）',
    category: 'swallow',
    difficulty: 'advanced',
    duration: 90,
    description: '延長喉部上抬時間，促進吞嚥效率',
    instructions: [
      '坐直，目視前方',
      '慢慢做吞嚥動作',
      '在吞嚥最高點時，用力停留 3-5 秒',
      '（感覺喉嚨被「卡住」）',
      '慢慢放鬆',
      '重複 5-10 次',
    ],
    tips: ['一開始可能較困難，可先從 2 秒開始', '不要在吃飯時練習'],
  },
  {
    id: 'swallow-3',
    name: '努德森吞嚥法',
    category: 'swallow',
    difficulty: 'intermediate',
    duration: 60,
    description: '透過多次吞嚥減少殘留',
    instructions: [
      '含一小口水在口中',
      '做一次吞嚥',
      '不要鬆弛喉嚨，立刻做第二次',
      '持續 2-3 次連續吞嚥',
      '確認口中已無水分',
    ],
  },

  // 姿勢調整
  {
    id: 'posture-1',
    name: '正確坐姿練習',
    category: 'posture',
    difficulty: 'basic',
    duration: 30,
    description: '建立正確進食姿勢，減少嗆咳風險',
    instructions: [
      '坐在有靠背的椅子上',
      '臀部緊靠椅背',
      '雙腳平放地面',
      '肩膀與耳朵保持水平',
      '下巴微收（約 10-15 度）',
      '維持正確姿勢 30 秒',
    ],
    tips: ['進食前先練習此姿勢', '可在背部放一個枕頭協助'],
  },
  {
    id: 'posture-2',
    name: '頭部抬高姿勢',
    category: 'posture',
    difficulty: 'basic',
    duration: 30,
    description: '訓練進食時頭部抬高姿勢',
    instructions: [
      '坐於床邊或椅子上',
      '將頭部向前傾約 30-45 度',
      '下巴朝向胸口',
      '此姿勢可保護氣道',
      '維持 30 秒後放鬆',
    ],
    tips: ['此姿勢適用於管灌餵食後', '需有照顧者在旁協助'],
  },
];

export const categories = [
  // 臉部運動
  { id: 'facial', name: '臉部運動', icon: '😊', color: '#3B82F6', frames: [] },
  // 舌頭運動  
  { id: 'tongue', name: '舌頭運動', icon: '👅', color: '#10B981', frames: [] },
  // 嘴唇運動
  { id: 'lip', name: '嘴唇運動', icon: '👄', color: '#F59E0B', frames: [] },
  // 咀嚼運動
  { id: 'chewing', name: '咀嚼運動', icon: '🦷', color: '#8B5CF6', frames: [] },
  // 吞嚥練習
  { id: 'swallow', name: '吞嚥練習', icon: '⏱️', color: '#EF4444', frames: [] },
  // 姿勢調整
  { id: 'posture', name: '姿勢調整', icon: '🧍', color: '#06B6D4', frames: [] },
];