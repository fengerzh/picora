import React from 'react'
import TimeTree from './TimeTree'
import PhotoGrid from './PhotoGrid'
import ScanProgress from './ScanProgress'
import PersonList from './PersonList'
import MapView from './MapView'
import type { MonthData } from '../hooks/usePhotos'
import appIcon from '../assets/icon.png'

interface MainLayoutProps {
  photos: Photo[]
  photosByMonth: MonthData[]
  loading: boolean
  isScanning: boolean
  scanProgress: { phase: string; done: number; total: number } | null
  onPhotoClick: (photo: Photo) => void
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
  const [searchQuery, setSearchQuery] = React.useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false)
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set())
  const [showPersons, setShowPersons] = React.useState(false)
  const [showMap, setShowMap] = React.useState(false)
  const [persons, setPersons] = React.useState<Person[]>([])
  const [personPhotos, setPersonPhotos] = React.useState<Photo[] | null>(null)
  const [faceScanStatus, setFaceScanStatus] = React.useState<{ scanned: number; total: number; running: boolean } | null>(null)

  // Load favorite IDs on mount and when photos change
  React.useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await window.picora.getFavorites()
        setFavoriteIds(new Set(favs.map((p) => p.id)))
      } catch (err) {
        console.error('加载收藏失败：', err)
      }
    }
    loadFavorites()
  }, [photos])

  const handleToggleFavorite = React.useCallback(async (photoId: string) => {
    try {
      const result = await window.picora.toggleFavorite(photoId)
      if (result !== null) {
        setFavoriteIds((prev) => {
          const next = new Set(prev)
          if (result) {
            next.add(photoId)
          } else {
            next.delete(photoId)
          }
          return next
        })
      }
    } catch (err) {
      console.error('收藏操作失败：', err)
    }
  }, [])

  // Merge favorite state into photos
  const photosWithFav = React.useMemo(() => {
    return photos.map((p) => ({ ...p, favorite: favoriteIds.has(p.id) }))
  }, [photos, favoriteIds])

  // Client-side filter: search by filename and/or favorites
  const filteredPhotos = React.useMemo(() => {
    let result = photosWithFav
    if (showFavoritesOnly) {
      result = result.filter((p) => p.favorite)
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((photo) => {
        const filename = photo.path.split('/').pop() || ''
        return filename.toLowerCase().includes(query)
      })
    }
    return result
  }, [photosWithFav, searchQuery, showFavoritesOnly])

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

  const handleShowAll = () => {
    setActiveMonth(null)
    setScrollTarget(null)
    setShowFavoritesOnly(false)
    setShowPersons(false)
    setShowMap(false)
    setPersonPhotos(null)
    // Scroll photo grid to top
    const grid = document.querySelector('.photo-grid-list')
    if (grid) {
      grid.scrollTop = 0
    }
  }

  // Load persons when entering person view
  const loadPersons = React.useCallback(async () => {
    try {
      const list = await window.picora.getPersons()
      setPersons(list || [])
    } catch (err) {
      console.error('加载人物列表失败：', err)
      setPersons([])
    }
  }, [])

  // Load persons on mount so sidebar count is correct from the start
  React.useEffect(() => {
    loadPersons()
  }, [loadPersons])

  const handleShowPersons = React.useCallback(async () => {
    setShowFavoritesOnly(false)
    setShowMap(false)
    setActiveMonth(null)
    setPersonPhotos(null)
    setShowPersons(true)
    await loadPersons()
  }, [loadPersons])

  const handleShowMap = React.useCallback(() => {
    setShowFavoritesOnly(false)
    setShowPersons(false)
    setPersonPhotos(null)
    setActiveMonth(null)
    setShowMap(true)
  }, [])

  const handlePersonClick = React.useCallback(async (personId: string) => {
    try {
      const photos = await window.picora.getPhotosByPerson(personId)
      setPersonPhotos(photos)
    } catch (err) {
      console.error('加载人物照片失败：', err)
    }
  }, [])

  const handleRenamePerson = React.useCallback(async (personId: string, name: string) => {
    try {
      await window.picora.renamePerson(personId, name)
      await loadPersons()
    } catch (err) {
      console.error('重命名人物失败：', err)
    }
  }, [loadPersons])

  // Face scan
  const handleStartFaceScan = React.useCallback(async () => {
    try {
      setFaceScanStatus({ scanned: 0, total: 0, running: true })
      const result = await window.picora.startFaceScan()
      if (result.error) {
        console.error('人脸扫描失败：', result.error)
      }
      // Refresh persons after scan
      await loadPersons()
      const status = await window.picora.getFaceScanStatus()
      setFaceScanStatus({ ...status, running: false })
    } catch (err) {
      console.error('人脸扫描失败：', err)
      setFaceScanStatus(null)
    }
  }, [loadPersons])

  const handleResetFaceScan = React.useCallback(async () => {
    try {
      await window.picora.resetFaceScan()
      setPersons([])
      setFaceScanStatus({ scanned: 0, total: 0, running: false })
    } catch (err) {
      console.error('重置扫描失败：', err)
    }
  }, [])

  // Listen for face scan progress
  React.useEffect(() => {
    const unsubscribe = window.picora.onScanProgress((progress) => {
      if (progress.phase === 'face-scan') {
        setFaceScanStatus({
          scanned: progress.done,
          total: progress.total,
          running: true
        })
      }
    })
    return unsubscribe
  }, [])

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
          <img className="app-logo" src={appIcon} alt="Picora" />
          <h1 className="app-title">Picora</h1>
          <span className="photo-count">{totalCount} 张照片</span>
        </div>
        <div className="top-bar-center">
          <div className="search-box">
            <svg
              className="search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="搜索照片"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery('')}
                title="清除"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="top-bar-right">
          <button
            className="icon-btn-labeled scan-btn"
            onClick={onRescan}
            title="扫描文件夹，发现新照片"
            disabled={isScanning}
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
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            <span>{isScanning ? '扫描中…' : '扫描'}</span>
          </button>
          <button
            className="icon-btn-labeled"
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
            <span>刷新</span>
          </button>
          <button
            className="icon-btn-labeled"
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
            <span>设置</span>
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="sidebar-favorites">
            <div
              className={`month-item favorites-item ${showFavoritesOnly ? 'active' : ''}`}
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly)
                setActiveMonth(null)
                setShowPersons(false)
                setShowMap(false)
                setPersonPhotos(null)
              }}
            >
              <span className="month-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                收藏
              </span>
              <span className="month-count">{favoriteIds.size}</span>
            </div>
            <div
              className={`month-item favorites-item ${showPersons ? 'active' : ''}`}
              onClick={handleShowPersons}
            >
              <span className="month-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={showPersons ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                人物
              </span>
              <span className="month-count">{persons?.length ?? 0}</span>
            </div>
            <div
              className={`month-item favorites-item ${showMap ? 'active' : ''}`}
              onClick={handleShowMap}
            >
              <span className="month-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill={showMap ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                地图
              </span>
            </div>
          </div>
          <TimeTree
            data={photosByMonth}
            activeMonth={activeMonth}
            onMonthClick={(year, month) => {
              setShowFavoritesOnly(false)
              setShowPersons(false)
              setShowMap(false)
              setPersonPhotos(null)
              handleMonthClick(year, month)
            }}
            totalCount={totalCount}
            onShowAll={() => {
              setShowFavoritesOnly(false)
              setShowMap(false)
              handleShowAll()
            }}
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
          ) : showMap ? (
            <MapView onPhotoClick={onPhotoClick} />
          ) : showPersons && personPhotos ? (
            <PhotoGrid
              photos={personPhotos}
              onPhotoClick={onPhotoClick}
              onActiveMonthChange={() => {}}
              scrollTarget={null}
              onScrollComplete={() => {}}
              onToggleFavorite={handleToggleFavorite}
              onPhotosDeleted={onRefresh}
            />
          ) : showPersons ? (
            <div className="person-view">
              <div className="person-view-header">
                <h2>人物</h2>
                {faceScanStatus?.running ? (
                  <div className="face-scan-progress">
                    <div className="loading-spinner" style={{ width: '16px', height: '16px' }} />
                    <span>正在扫描 {faceScanStatus.scanned}/{faceScanStatus.total}…</span>
                    <button className="btn-secondary" onClick={() => window.picora.cancelFaceScan()}>
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="face-scan-buttons">
                    <button className="btn-primary" onClick={handleStartFaceScan}>
                      {faceScanStatus && faceScanStatus.scanned > 0
                        ? `继续扫描 (${faceScanStatus.scanned}/${faceScanStatus.total})`
                        : '开始人脸扫描'}
                    </button>
                    {faceScanStatus && faceScanStatus.scanned > 0 && (
                      <button className="btn-secondary" onClick={handleResetFaceScan}>
                        重新扫描
                      </button>
                    )}
                  </div>
                )}
              </div>
              <PersonList
                persons={persons}
                onPersonClick={handlePersonClick}
                onRenamePerson={handleRenamePerson}
              />
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="empty-state">
              <p>{showFavoritesOnly ? '还没有收藏的照片' : '未找到匹配的照片'}</p>
              <p className="subtext">{showFavoritesOnly ? '点击照片右下角的心形图标收藏' : '试试其他关键词'}</p>
            </div>
          ) : (
            <PhotoGrid
              photos={filteredPhotos}
              onPhotoClick={onPhotoClick}
              onActiveMonthChange={handleActiveMonthChange}
              scrollTarget={scrollTarget}
              onScrollComplete={handleScrollComplete}
              onToggleFavorite={handleToggleFavorite}
              onPhotosDeleted={onRefresh}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
