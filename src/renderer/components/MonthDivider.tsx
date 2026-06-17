import React from 'react'

interface MonthDividerProps {
  year: number
  month: number
}

const MonthDivider: React.FC<MonthDividerProps> = ({ year, month }) => {
  return (
    <div className="month-divider">
      <span className="month-divider-line" />
      <span className="month-divider-label">
        {year}年{month}月
      </span>
      <span className="month-divider-line" />
    </div>
  )
}

export default MonthDivider
