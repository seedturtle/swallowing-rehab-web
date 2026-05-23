import { PatientProgress, Exercise } from '../data/types';

interface ProgressTrackerProps {
  progress: PatientProgress[];
  exercises: Exercise[];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function ProgressTracker({ progress, exercises }: ProgressTrackerProps) {
  // Get last 7 days
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
      });
    }
    return days;
  };

  const last7Days = getLast7Days();

  const getCompletedForDate = (dateStr: string) => {
    return progress.filter(p => p.date && p.date.startsWith(dateStr) && p.completed).length;
  };

  const getTodayStats = () => {
    const today = todayStr();
    const todayProgress = progress.filter(p => p.date && p.date.startsWith(today) && p.completed);
    return {
      completed: todayProgress.length,
      total: exercises.length,
      percentage: Math.round((todayProgress.length / exercises.length) * 100),
    };
  };

  const getWeeklyStats = () => {
    const completedDays = last7Days.filter(day => getCompletedForDate(day.date) > 0).length;
    return {
      completedDays,
      totalDays: 7,
      percentage: Math.round((completedDays / 7) * 100),
    };
  };

  const todayStats = getTodayStats();
  const weeklyStats = getWeeklyStats();

  // 匯出功能
  const handleExport = () => {
    const completed = progress.filter(p => p.completed);
    if (completed.length === 0) {
      alert('尚無任何練習記錄可匯出');
      return;
    }

    const now = formatDateTime(new Date().toISOString());
    const lines: string[] = [];
    lines.push('========================================');
    lines.push('  吞嚥復健 — 練習記錄');
    lines.push(`  匯出時間：${now}`);
    lines.push('========================================');
    lines.push('');

    // 依日期分組
    const grouped: Record<string, typeof completed> = {};
    for (const item of completed) {
      const day = item.date.split('T')[0];
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
    }

    for (const [day, items] of Object.entries(grouped).sort()) {
      lines.push(`📅 ${day}`);
      lines.push('----------------------------------------');
      for (const item of items) {
        const exercise = exercises.find(e => e.id === item.exerciseId);
        const ts = formatDateTime(item.date);
        const reps = item.repetitions ? ` | ${item.repetitions} 次` : '';
        const dur = item.duration ? ` | ${item.duration}秒` : '';
        lines.push(`  ${ts}  ${exercise?.name || item.exerciseId}${reps}${dur}`);
      }
      lines.push('');
    }

    lines.push('========================================');
    lines.push(`總計完成 ${completed.length} 項練習`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `復健記錄_${todayStr()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">我的進度</h2>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          📥 匯出記錄
        </button>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-[#003366] to-[#006699] text-white">
          <h3 className="text-sm font-medium opacity-80 mb-2">今日進度</h3>
          <div className="text-4xl font-bold mb-2">
            {todayStats.completed} / {todayStats.total}
          </div>
          <div className="w-full bg-white/30 rounded-full h-3 mb-2">
            <div 
              className="bg-white rounded-full h-3 transition-all"
              style={{ width: `${todayStats.percentage}%` }}
            />
          </div>
          <p className="text-sm opacity-80">{todayStats.percentage}% 完成</p>
        </div>

        <div className="card">
          <h3 className="text-sm font-medium text-gray-500 mb-2">本週達成</h3>
          <div className="text-4xl font-bold text-[#003366] mb-2">
            {weeklyStats.completedDays} / {weeklyStats.totalDays}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-[#003366] rounded-full h-3 transition-all"
              style={{ width: `${weeklyStats.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{weeklyStats.percentage}% 完成</p>
        </div>
      </div>

      {/* Weekly Calendar */}
      <div className="card mb-6">
        <h3 className="font-bold text-gray-800 mb-4">本週練習記錄</h3>
        <div className="grid grid-cols-7 gap-2">
          {last7Days.map((day, index) => {
            const completed = getCompletedForDate(day.date);
            const isToday = day.date === new Date().toISOString().split('T')[0];
            
            return (
              <div key={index} className="text-center">
                <div className="text-xs text-gray-500 mb-1">週{day.dayName}</div>
                <div 
                  className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center font-medium ${
                    completed > 0 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  } ${isToday ? 'ring-2 ring-[#003366]' : ''}`}
                >
                  {completed > 0 ? '✓' : '-'}
                </div>
                <div className="text-xs text-gray-400 mt-1">{completed}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="font-bold text-gray-800 mb-4">最近活動</h3>
        {progress.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">📝</p>
            <p>尚未有任何練習記錄</p>
            <p className="text-sm">開始練習來記錄您的復健進度吧！</p>
          </div>
        ) : (
          <div className="space-y-3">
            {progress
              .filter(p => p.completed)
              .slice(-10)
              .reverse()
              .map((item, index) => {
                const exercise = exercises.find(e => e.id === item.exerciseId);
                const timeStr = formatDateTime(item.date);
                
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{exercise?.name}</p>
                      <p className="text-sm text-gray-500">{timeStr}</p>
                    </div>
                    {item.repetitions && (
                      <span className="text-sm text-gray-500">
                        {item.repetitions} 次
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}