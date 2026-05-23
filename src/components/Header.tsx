interface HeaderProps {
  onNavigate: (view: 'home' | 'exercise' | 'progress') => void;
  currentView: string;
}

export default function Header({ onNavigate, currentView }: HeaderProps) {
  return (
    <header className="bg-[#003366] text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">吞嚥復健 - 居家復健指南</h1>
            
          </div>
          
          <nav className="flex gap-4">
            <button
              onClick={() => onNavigate('home')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentView === 'home'
                  ? 'bg-white text-[#003366]'
                  : 'hover:bg-[#006699]'
              }`}
            >
              首頁
            </button>
            <button
              onClick={() => onNavigate('progress')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentView === 'progress'
                  ? 'bg-white text-[#003366]'
                  : 'hover:bg-[#006699]'
              }`}
            >
              我的進度
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}