import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Props {
  selectedDays: string[];    // ['monday','wednesday','friday']
  startDate?: string;        // ISO date string
  endDate?: string;          // ISO date string
  isPaused?: boolean;
  preferredTime?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export default function SubscriptionCalendar({ selectedDays, startDate, endDate, isPaused, preferredTime }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const scheduledDayNums = useMemo(
    () => new Set(selectedDays.map(d => DAY_MAP[d.toLowerCase()]).filter(n => n !== undefined)),
    [selectedDays]
  );

  const subStart = startDate ? new Date(startDate) : null;
  const subEnd   = endDate   ? new Date(endDate)   : null;
  if (subStart) subStart.setHours(0, 0, 0, 0);
  if (subEnd)   subEnd.setHours(0, 0, 0, 0);

  // Build days for grid
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const classifyDay = (day: number): 'scheduled-past' | 'scheduled-future' | 'today-scheduled' | 'paused' | 'out-of-range' | null => {
    const date = new Date(year, month, day);
    const dow  = date.getDay();
    if (!scheduledDayNums.has(dow)) return null;
    if (subStart && date < subStart) return 'out-of-range';
    if (subEnd   && date > subEnd)   return 'out-of-range';
    if (isPaused) return 'paused';
    if (date.getTime() === today.getTime()) return 'today-scheduled';
    if (date < today) return 'scheduled-past';
    return 'scheduled-future';
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const totalScheduled = useMemo(() => {
    if (!subStart) return 0;
    const end = subEnd ?? new Date(year, month + 1, 0); // end of current month if no end
    let count = 0;
    const cursor = new Date(subStart);
    while (cursor <= end) {
      if (scheduledDayNums.has(cursor.getDay())) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }, [subStart, subEnd, scheduledDayNums, year, month]);

  return (
    <div className="bg-white border border-border rounded-xl p-4 space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h4 className="font-semibold text-sm text-foreground">{monthLabel}</h4>
        <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}

        {/* Day cells */}
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const kind = classifyDay(day);
          const isToday = new Date(year, month, day).getTime() === today.getTime();

          let cellClass = 'w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-all ';
          if (kind === 'today-scheduled')  cellClass += 'bg-primary text-primary-foreground ring-2 ring-primary/30 font-bold';
          else if (kind === 'scheduled-future') cellClass += 'bg-primary/15 text-primary font-semibold';
          else if (kind === 'scheduled-past')   cellClass += 'bg-green-100 text-green-700';
          else if (kind === 'paused')            cellClass += 'bg-yellow-100 text-yellow-700';
          else if (kind === 'out-of-range')      cellClass += 'text-muted-foreground/40';
          else if (isToday)                      cellClass += 'ring-1 ring-primary/40 text-primary';
          else                                   cellClass += 'text-foreground';

          return (
            <div key={idx} className="flex items-center justify-center py-0.5">
              <div className={cellClass}>{day}</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-green-100 border border-green-300 inline-block" /> Completed
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-primary/15 border border-primary/30 inline-block" /> Upcoming
        </span>
        {isPaused && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300 inline-block" /> Paused
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground text-center">
        {preferredTime && <span>Service time: <strong className="text-foreground">{preferredTime}</strong> · </span>}
        {totalScheduled > 0 && <span><strong className="text-foreground">{totalScheduled}</strong> total sessions</span>}
      </div>
    </div>
  );
}
