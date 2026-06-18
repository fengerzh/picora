import React from 'react'

interface MonthDividerProps {
  year: number
  month: number
  photoCount?: number
}

const MonthDivider: React.FC<MonthDividerProps> = ({ year, month, photoCount }) => {
  return (
    <div className="month-divider">
      <span className="month-divider-dot" />
      <span className="month-divider-label">
        {year}年{month}月
      </span>
      {photoCount !== undefined && (
        <span className="month-divider-count">{photoCount} 张照片</span>
      )}
    </div>
  )
}

export default MonthDivider
