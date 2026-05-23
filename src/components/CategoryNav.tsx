interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface CategoryNavProps {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

export default function CategoryNav({ categories, selected, onSelect }: CategoryNavProps) {
  return (
    <div className="mb-6 overflow-x-auto">
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