import React, { useEffect, useState } from 'react'

interface PhotoThumbProps {
  photo: Photo
  onClick: () => void
  onDoubleClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

const PhotoThumb: React.FC<PhotoThumbProps> = ({
  photo,
  onClick,
  onDoubleClick,
  onContextMenu
}) => {
  const [thumbPath, setThumbPath] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!photo.thumbGenerated) {
        return
      }
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
  }, [photo.id, photo.thumbGenerated])

  const handleImageLoad = () => setLoaded(true)

  return (
    <div
      className="photo-thumb"
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
        <img
          src={`picora-asset://localhost${thumbPath}`}
          alt=""
          className={`thumb-image ${loaded ? 'loaded' : ''}`}
          onLoad={handleImageLoad}
          onError={() => setError(true)}
          draggable={false}
        />
      ) : (
        <div className="thumb-loading">
          <div className="thumb-loading-spinner" />
        </div>
      )}
    </div>
  )
}

export default React.memo(PhotoThumb)
