import React, { useEffect, useState } from 'react'

interface PhotoThumbProps {
  photo: Photo
  selected: boolean
  batchMode: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggleFavorite: (photoId: string) => void
}

const PhotoThumb: React.FC<PhotoThumbProps> = ({
  photo,
  selected,
  batchMode,
  onClick,
  onDoubleClick,
  onContextMenu,
  onToggleFavorite
}) => {
  const [thumbPath, setThumbPath] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Always request thumbnail — backend will generate on-demand if needed
      try {
        const path = await window.picora.getThumbnailPath(photo.id)
        if (!cancelled) {
          setThumbPath(path)
        }
      } catch (err) {
        if (!cancelled) {
          setError(true)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [photo.id])

  const handleImageLoad = () => setLoaded(true)

  // Format date for hover tooltip
  const dateStr = React.useMemo(() => {
    try {
      const d = new Date(photo.dateTaken)
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    } catch {
      return ''
    }
  }, [photo.dateTaken])

  return (
    <div
      className={`photo-thumb ${selected ? 'selected' : ''} ${batchMode ? 'batch-mode' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDoubleClick()
      }}
    >
      {!photo.thumbGenerated || error ? (
        <div className="thumb-placeholder">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      ) : thumbPath ? (
        <>
          <img
            src={`picora-asset://localhost/${thumbPath.replace(/\\/g, '/').replace(/^\//, '')}`}
            alt=""
            className="thumb-image-blur"
            aria-hidden={true}
            draggable={false}
          />
          <img
            src={`picora-asset://localhost/${thumbPath.replace(/\\/g, '/').replace(/^\//, '')}`}
            alt=""
            className={`thumb-image ${loaded ? 'loaded' : ''}`}
            onLoad={handleImageLoad}
            onError={() => setError(true)}
            draggable={false}
          />
        </>
      ) : (
        <div className="thumb-loading">
          <div className="thumb-loading-spinner" />
        </div>
      )}
      {dateStr && <div className="thumb-info">{dateStr}</div>}
      <button
        className={`thumb-favorite ${photo.favorite ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(photo.id)
        }}
        title={photo.favorite ? '取消收藏' : '收藏'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={photo.favorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>
  )
}

export default React.memo(PhotoThumb)
