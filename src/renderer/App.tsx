import React, { useEffect, useState } from 'react'
import MainLayout from './components/MainLayout'
import Settings from './components/Settings'
import Viewer from './components/Viewer'
import { usePhotos } from './hooks/usePhotos'

type AppState = 'loading' | 'setup' | 'main'

interface ViewerState {
  photos: Photo[]
  currentIndex: number
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{
    phase: string
    done: number
    total: number
  } | null>(null)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [initialFolders, setInitialFolders] = useState<string[]>([])

  const {
    photos,
    totalCount,
    photosByMonth,
    loading,
    loadPage,
    refresh,
    deletePhoto
  } = usePhotos()

  // Initialize: check config existence
  useEffect(() => {
    const init = async () => {
      try {
        const exists = await window.picora.configExists()
        if (!exists) {
          setAppState('setup')
        } else {
          setAppState('main')
          await refresh()
        }
      } catch (err) {
        console.error('初始化失败：', err)
        setAppState('setup')
      }
    }
    init()
  }, [])

  // Listen for scan progress
  useEffect(() => {
    const unsubProgress = window.picora.onScanProgress((progress) => {
      setScanProgress(progress)
      if (progress.phase === 'done') {
        setIsScanning(false)
        setScanProgress(null)
        refresh()
      }
    })
    const unsubUpdated = window.picora.onPhotosUpdated(() => {
      refresh()
    })
    const unsubStartup = window.picora.onStartupScan(() => {
      setIsScanning(true)
      setScanProgress({ phase: 'scanning', done: 0, total: 0 })
      window.picora.startScan().catch((err: any) => {
        console.error('自动扫描失败：', err)
      }).finally(() => {
        setIsScanning(false)
        setScanProgress(null)
        refresh()
      })
    })
    return () => {
      unsubProgress()
      unsubUpdated()
      unsubStartup()
    }
  }, [refresh])

  const handleStartScan = async () => {
    setIsScanning(true)
    setScanProgress({ phase: 'scanning', done: 0, total: 0 })
    try {
      await window.picora.startScan()
    } catch (err) {
      console.error('扫描失败：', err)
    } finally {
      setIsScanning(false)
      setScanProgress(null)
      await refresh()
    }
  }

  const handleSaveConfig = async (config: {
    folders: string[]
    thumbnailSize: number
    scanOnStartup: boolean
  }) => {
    try {
      await window.picora.saveConfig(config)
      setAppState('main')
      await refresh()
      await handleStartScan()
    } catch (err) {
      console.error('保存配置失败：', err)
    }
  }

  const handleOpenSettings = async () => {
    try {
      const config = await window.picora.getConfig()
      setInitialFolders(config.folders)
      setAppState('setup')
    } catch (err) {
      console.error('读取配置失败：', err)
    }
  }

  const handleCancelSettings = () => {
    setAppState('main')
  }

  const handleDeletePhoto = async (photoId: string) => {
    const ok = await deletePhoto(photoId)
    if (ok && viewer) {
      const newPhotos = viewer.photos.filter((p) => p.id !== photoId)
      if (newPhotos.length === 0) {
        setViewer(null)
      } else {
        const newIndex = Math.min(viewer.currentIndex, newPhotos.length - 1)
        setViewer({ photos: newPhotos, currentIndex: newIndex })
      }
    }
  }

  const handlePhotoClick = (photo: Photo) => {
    const index = photos.findIndex((p) => p.id === photo.id)
    setViewer({ photos, currentIndex: index >= 0 ? index : 0 })
  }

  const handleViewerNavigate = (index: number) => {
    if (viewer) {
      setViewer({ ...viewer, currentIndex: index })
    }
  }

  const handleViewerClose = () => {
    setViewer(null)
  }

  if (appState === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>正在加载 Picora…</p>
      </div>
    )
  }

  return (
    <div className="app-root">
      {appState === 'setup' && (
        <Settings
          initialFolders={initialFolders}
          onSave={handleSaveConfig}
          onCancel={appState === 'setup' && totalCount > 0 ? handleCancelSettings : undefined}
          onRescan={handleStartScan}
          isScanning={isScanning}
        />
      )}

      {appState === 'main' && (
        <MainLayout
          photos={photos}
          photosByMonth={photosByMonth}
          loading={loading}
          isScanning={isScanning}
          scanProgress={scanProgress}
          onPhotoClick={handlePhotoClick}
          onLoadPage={loadPage}
          onRefresh={refresh}
          onOpenSettings={handleOpenSettings}
          onRescan={handleStartScan}
          totalCount={totalCount}
        />
      )}

      {viewer && (
        <Viewer
          photos={viewer.photos}
          currentIndex={viewer.currentIndex}
          onClose={handleViewerClose}
          onDelete={handleDeletePhoto}
          onNavigate={handleViewerNavigate}
        />
      )}
    </div>
  )
}

export default App
