import React from 'react'
import TimeTree from './TimeTree'
import PhotoGrid from './PhotoGrid'
import ScanProgress from './ScanProgress'
import type { MonthData } from '../hooks/usePhotos'

interface MainLayoutProps {
  photos: Photo[]
  photosByMonth: MonthData[]
  loading: boolean
  isScanning: boolean
  scanProgress: { phase: string; done: number; total: number } | null
  onPhotoClick: (photo: Photo) => void
  onLoadPage: (page: number) => void
  onRefresh: () => void
  onOpenSettings: () => void
  onRescan: () => void
  totalCount: number
}

const MainLayout: React.FC<MainLayoutProps> = ({
  photos,
  photosByMonth,
  loading,
  isScanning,
  scanProgress,
  onPhotoClick,
  onLoadPage,
  onRefresh,
  onOpenSettings,
  onRescan,
  totalCount
}) => {
  const [activeMonth, setActiveMonth] = React.useState<{
    year: number
    month: number
  } | null>(null)
  const [scrollTarget, setScrollTarget] = React.useState<{
    year: number
    month: number
  } | null>(null)

  const handleMonthClick = (year: number, month: number) => {
    setActiveMonth({ year, month })
    setScrollTarget({ year, month })
  }

  const handleScrollComplete = () => {
    setScrollTarget(null)
  }

  const handleActiveMonthChange = (year: number, month: number) => {
    setActiveMonth({ year, month })
  }

  return (
    <div className="main-layout">
      {isScanning && scanProgress && (
        <ScanProgress
          phase={scanProgress.phase as 'scanning' | 'reading' | 'thumbnails'}
          done={scanProgress.done}
          total={scanProgress.total}
        />
      )}

      <header className="top-bar">
        <div className="top-bar-left">
          <h1 className="app-title">Picora</h1>
          <span className="photo-count">{totalCount} 张照片</span>
        </div>
        <div className="top-bar-right">
          <button
            className="icon-btn"
            onClick={onRefresh}
            title="刷新"
            disabled={loading}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
          <button
            className="icon-btn"
            onClick={onOpenSettings}
            title="设置"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <TimeTree
            data={photosByMonth}
            activeMonth={activeMonth}
            onMonthClick={handleMonthClick}
          />
        </aside>
        <main className="content-area">
          {loading && photos.length === 0 ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>正在加载照片…</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="empty-state">
              <p>暂无照片</p>
              <p className="subtext">请先添加照片文件夹并进行扫描</p>
              <button className="btn-primary" onClick={onOpenSettings}>
                打开设置
              </button>
            </div>
          ) : (
            <PhotoGrid
              photos={photos}
              onPhotoClick={onPhotoClick}
              onActiveMonthChange={handleActiveMonthChange}
              scrollTarget={scrollTarget}
              onScrollComplete={handleScrollComplete}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
