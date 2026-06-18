import React, { useEffect, useRef, useState } from 'react'
import type { MonthData } from '../hooks/usePhotos'

interface TimeTreeProps {
  data: MonthData[]
  activeMonth: { year: number; month: number } | null
  onMonthClick: (year: number, month: number) => void
  totalCount: number
  onShowAll: () => void
}

const MONTH_NAMES = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
]

const TimeTree: React.FC<TimeTreeProps> = ({ data, activeMonth, onMonthClick, totalCount, onShowAll }) => {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const activeRef = useRef<HTMLDivElement>(null)

  // Default expand all years
  useEffect(() => {
    setExpandedYears(new Set(data.map((d) => d.year)))
  }, [data])

  // Auto-scroll active month into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [activeMonth])

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) {
        next.delete(year)
      } else {
        next.add(year)
      }
      return next
    })
  }

  if (data.length === 0) {
    return (
      <div className="time-tree-empty">
        <p>暂无时间数据</p>
        <p className="subtext">扫描后将显示时间线</p>
      </div>
    )
  }

  // Sort years descending
  const sortedData = [...data].sort((a, b) => b.year - a.year)

  return (
    <div className="time-tree">
      <div className="time-tree-header">时间线</div>
      <div className="time-tree-list">
        <div
          className={`month-item all-photos-item ${!activeMonth ? 'active' : ''}`}
          onClick={onShowAll}
        >
          <span className="month-label">全部照片</span>
          <span className="month-count">{totalCount}</span>
        </div>
        {sortedData.map((yearData) => {
          const isExpanded = expandedYears.has(yearData.year)
          const totalForYear = yearData.months.reduce(
            (sum, m) => sum + m.count,
            0
          )
          // Sort months descending
          const sortedMonths = [...yearData.months].sort(
            (a, b) => b.month - a.month
          )

          return (
            <div key={yearData.year} className="time-tree-year">
              <button
                className="year-header"
                onClick={() => toggleYear(yearData.year)}
                aria-expanded={isExpanded}
              >
                <span className={`year-arrow ${isExpanded ? 'expanded' : ''}`}>
                  ▸
                </span>
                <span className="year-label">{yearData.year} 年</span>
                <span className="year-count">{totalForYear}</span>
              </button>

              {isExpanded && (
                <div className="year-months">
                  {sortedMonths.map((m) => {
                    const isActive =
                      activeMonth?.year === yearData.year &&
                      activeMonth?.month === m.month
                    return (
                      <div
                        key={m.month}
                        ref={isActive ? activeRef : undefined}
                        className={`month-item ${isActive ? 'active' : ''}`}
                        onClick={() =>
                          onMonthClick(yearData.year, m.month)
                        }
                      >
                        <span className="month-label">
                          {MONTH_NAMES[m.month - 1]}
                        </span>
                        <span className="month-count">{m.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TimeTree
