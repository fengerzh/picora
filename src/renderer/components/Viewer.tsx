import React, { useCallback, useEffect, useState } from 'react'
import DeleteDialog from './DeleteDialog'

interface ViewerProps {
  photos: Photo[]
  currentIndex: number
  onClose: () => void
  onDelete: (photoId: string) => void
  onNavigate: (index: number) => void
}

const Viewer: React.FC<ViewerProps> = ({
  photos,
  currentIndex,
  onClose,
  onDelete,
  onNavigate
}) => {
  const [fullImagePath, setFullImagePath] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)

  const currentPhoto = photos[currentIndex]

  // Load full image path when current photo changes
  useEffect(() => {
    let cancelled = false
    setImageLoaded(false)
    setFullImagePath(null)

    if (currentPhoto) {
      window.picora
        .getFullImagePath(currentPhoto.id)
        .then((path) => {
          if (!cancelled) setFullImagePath(path)
        })
        .catch((err) => {
          console.error('加载图片失败：', err)
        })
    }

    return () => {
      cancelled = true
    }
  }, [currentPhoto?.id, currentIndex])

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(currentIndex + 1)
    }
  }, [currentIndex, photos.length, onNavigate])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1)
    }
  }, [currentIndex, onNavigate])

  const handleDelete = useCallback(() => {
    if (currentPhoto) {
      setDeleteTarget(currentPhoto)
    }
  }, [currentPhoto])

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      onDelete(deleteTarget.id)
      setDeleteTarget(null)
    }
  }, [deleteTarget, onDelete])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
        case 'Escape':
          onClose()
          break
        case 'Delete':
        case 'Backspace':
          handleDelete()
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, onClose, handleDelete])

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr)
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    } catch {
      return dateStr
    }
  }

  if (!currentPhoto) return null

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="viewer-close" onClick={onClose} title="关闭 (Esc)">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Previous button */}
        {currentIndex > 0 && (
          <button
            className="viewer-nav viewer-nav-prev"
            onClick={goPrev}
            title="上一张 (←)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Next button */}
        {currentIndex < photos.length - 1 && (
          <button
            className="viewer-nav viewer-nav-next"
            onClick={goNext}
            title="下一张 (→)"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Main image */}
        <div className="viewer-image-container">
          {fullImagePath ? (
            <img
              src={`picora-asset://localhost${fullImagePath}`}
              alt=""
              className={`viewer-image ${imageLoaded ? 'loaded' : ''}`}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
            />
          ) : (
            <div className="viewer-loading">
              <div className="loading-spinner" />
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="viewer-bottom">
          <div className="viewer-info">
            <span className="viewer-date">
              {formatDate(currentPhoto.dateTaken)}
            </span>
            <span className="viewer-counter">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
          <div className="viewer-actions">
            <button
              className="btn-danger viewer-delete-btn"
              onClick={handleDelete}
              title="删除 (Delete)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              删除
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteDialog
          visible={true}
          photoName={deleteTarget.path.split('/').pop() || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default Viewer
