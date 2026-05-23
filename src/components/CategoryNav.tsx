import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  frames?: string[];
}

interface CategoryNavProps {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

export default function CategoryNav({ categories, selected, onSelect }: CategoryNavProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const selectedCat = categories.find(c => c.id === selected);
  
  // 自動輪播動畫
  useEffect(() => {
    if (selectedCat?.frames?.length) {
      const interval = setInterval(() => {
        setCurrentFrame(prev => (prev + 1) % selectedCat.frames!.length);
      }, 1500); // 每1.5秒換一幀
      return () => clearInterval(interval);
    }
  }, [selected, selectedCat?.frames?.length]);

  return (
    <div className="mb-6 overflow-x-auto">
      {/* 類別展示圖片 */}
      {selectedCat?.frames?.length ? (
        <div className="mb-4 relative h-48 rounded-xl overflow-hidden bg-gray-100">
          <img 
            src={selectedCat.frames[currentFrame]} 
            alt={selectedCat.name}
            className="w-full h-full object-contain"
          />
        </div>
      ) : null}
      
      <div className="flex gap-3 min-w-max pb-2">
        <button
          onClick={() => onSelect('all')}
          className={`px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
            selected === 'all'
              ? 'bg-[#003366] text-white shadow-lg'
              : 'bg-white text-gray-700 hover:shadow-md'
          }`}
        >
          全部項目
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`px-4 py-3 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
              selected === cat.id
                ? 'text-white shadow-lg'
                : 'bg-white text-gray-700 hover:shadow-md'
            }`}
            style={{
              backgroundColor: selected === cat.id ? cat.color : undefined,
            }}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}