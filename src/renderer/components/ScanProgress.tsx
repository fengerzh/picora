import React from 'react'

interface ScanProgressProps {
  phase: 'scanning' | 'reading' | 'thumbnails'
  done: number
  total: number
}

const PHASE_LABELS: Record<string, string> = {
  scanning: '正在扫描文件夹…',
  reading: '正在读取照片信息…',
  thumbnails: '正在生成缩略图…',
  done: '扫描完成'
}

const ScanProgress: React.FC<ScanProgressProps> = ({ phase, done, total }) => {
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0
  const label = PHASE_LABELS[phase] || '处理中…'

  return (
    <div className="scan-progress">
      <div className="scan-progress-bar-bg">
        <div
          className="scan-progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="scan-progress-info">
        <span className="scan-progress-label">{label}</span>
        {total > 0 && (
          <span className="scan-progress-count">
            {done} / {total} ({percentage}%)
          </span>
        )}
      </div>
    </div>
  )
}

export default ScanProgress
