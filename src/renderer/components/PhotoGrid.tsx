import React, { useCallback, useEffect, useRef, useState } from 'react'
import { VariableSizeList as List } from 'react-window'
import PhotoThumb from './PhotoThumb'
import MonthDivider from './MonthDivider'
import DeleteDialog from './DeleteDialog'

interface PhotoGridProps {
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
  onActiveMonthChange: (year: number, month: number) => void
  scrollTarget: { year: number; month: number } | null
  onScrollComplete: () => void
  onToggleFavorite: (photoId: string) => void
  onPhotosDeleted: () => void
}

interface RowItem {
  type: 'divider' | 'row'
  year?: number
  month?: number
  photoCount?: number
  photos?: Photo[]
  rowStartIndex: number
}

const THUMB_SIZE = 200
const ROW_HEIGHT = 220
const DIVIDER_HEIGHT = 48
const GAP = 8

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  onPhotoClick,
  onActiveMonthChange,
  scrollTarget,
  onScrollComplete,
  onToggleFavorite,
  onPhotosDeleted
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<List>(null)
  const [containerWidth, setContainerWidth] = useState(800)
  const [containerHeight, setContainerHeight] = useState(600)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    photo: Photo
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Photo | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchDeleteMode, setBatchDeleteMode] = useState(false)
  // Suppress onActiveMonthChange during programmatic scroll
  const scrollLockRef = useRef(false)

  // Measure container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cols = Math.max(2, Math.floor((containerWidth - GAP) / (THUMB_SIZE + GAP)))

  // Build row items: group photos by month with dividers
  const rowItems: RowItem[] = React.useMemo(() => {
    const items: RowItem[] = []
    let currentYear = -1
    let currentMonth = -1
    let currentBatch: Photo[] = []
    let batchStartIndex = 0

    const flushBatch = () => {
      if (currentBatch.length > 0) {
        // Add divider for this month with photo count
        items.push({
          type: 'divider',
          year: currentYear,
          month: currentMonth,
          photoCount: currentBatch.length,
          rowStartIndex: batchStartIndex
        })
        // Split batch into rows of `cols`
        for (let i = 0; i < currentBatch.length; i += cols) {
          const rowPhotos = currentBatch.slice(i, i + cols)
          items.push({
            type: 'row',
            photos: rowPhotos,
            rowStartIndex: batchStartIndex + i
          })
        }
        currentBatch = []
      }
    }

    photos.forEach((photo, idx) => {
      const d = new Date(photo.dateTaken)
      const y = d.getFullYear()
      const m = d.getMonth() + 1

      if (y !== currentYear || m !== currentMonth) {
        flushBatch()
        currentYear = y
        currentMonth = m
        batchStartIndex = idx
      }
      currentBatch.push(photo)
    })
    flushBatch()
    return items
  }, [photos, cols])

  // Row heights
  const getItemSize = useCallback(
    (index: number) => {
      const item = rowItems[index]
      if (!item) return ROW_HEIGHT
      return item.type === 'divider' ? DIVIDER_HEIGHT : ROW_HEIGHT
    },
    [rowItems]
  )

  // Scroll to target month when triggered from the time tree
  useEffect(() => {
    if (!scrollTarget || !listRef.current) return
    const targetIndex = rowItems.findIndex(
      (item) =>
        item.type === 'divider' &&
        item.year === scrollTarget.year &&
        item.month === scrollTarget.month
    )
    if (targetIndex >= 0) {
      scrollLockRef.current = true
      listRef.current.scrollToItem(targetIndex, 'start')
      // Unlock after scroll animation settles
      setTimeout(() => {
        scrollLockRef.current = false
      }, 400)
    }
    onScrollComplete()
  }, [scrollTarget, rowItems, onScrollComplete])

  // Reset item sizes when rowItems change (needed for VariableSizeList)
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0)
    }
  }, [rowItems])

  // Detect active month based on scroll position
  const handleItemsRendered = useCallback(
    ({ visibleStartIndex }: { visibleStartIndex: number }) => {
      if (scrollLockRef.current) return
      if (rowItems.length === 0) return
      // Clamp index to valid range
      const startIndex = Math.min(visibleStartIndex, rowItems.length - 1)
      // Scan backward from startIndex to find the nearest preceding divider
      for (let i = startIndex; i >= 0; i--) {
        const item = rowItems[i]
        if (!item) continue
        if (item.type === 'divider' && item.year && item.month) {
          onActiveMonthChange(item.year, item.month)
          return
        }
      }
      // If no divider found above, scan forward
      for (let i = startIndex; i < rowItems.length; i++) {
        const item = rowItems[i]
        if (!item) continue
        if (item.type === 'divider' && item.year && item.month) {
          onActiveMonthChange(item.year, item.month)
          return
        }
        if (item.type === 'row' && item.photos && item.photos.length > 0) {
          const d = new Date(item.photos[0].dateTaken)
          onActiveMonthChange(d.getFullYear(), d.getMonth() + 1)
          return
        }
      }
    },
    [rowItems, onActiveMonthChange]
  )

  // Context menu handling
  const handleContextMenu = (e: React.MouseEvent, photo: Photo) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, photo })
  }

  const closeContextMenu = () => setContextMenu(null)

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu()
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [contextMenu])

  const handleDeleteClick = () => {
    if (contextMenu) {
      setDeleteTarget(contextMenu.photo)
      closeContextMenu()
    }
  }

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await window.picora.deletePhoto(deleteTarget.id)
      setDeleteTarget(null)
      onPhotosDeleted()
    }
  }

  // Multi-select handling
  const handlePhotoSelect = (photo: Photo, e: React.MouseEvent) => {
    if (!batchDeleteMode && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      onPhotoClick(photo)
      return
    }
    // Enter batch mode
    if (!batchDeleteMode) {
      setBatchDeleteMode(true)
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photo.id)) {
        next.delete(photo.id)
      } else {
        next.add(photo.id)
      }
      return next
    })
  }

  const handleExitBatchMode = () => {
    setBatchDeleteMode(false)
    setSelectedIds(new Set())
  }

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await window.picora.deletePhoto(id)
    }
    handleExitBatchMode()
    onPhotosDeleted()
  }

  const RowRenderer = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const item = rowItems[index]
      if (!item) return null

      if (item.type === 'divider') {
        return (
          <div style={style}>
            <MonthDivider year={item.year!} month={item.month!} photoCount={item.photoCount} />
          </div>
        )
      }

      return (
        <div style={style} className="photo-row">
          {item.photos?.map((photo) => (
            <PhotoThumb
              key={photo.id}
              photo={photo}
              selected={selectedIds.has(photo.id)}
              batchMode={batchDeleteMode}
              onClick={(e) => handlePhotoSelect(photo, e)}
              onDoubleClick={() => {
                if (!batchDeleteMode) onPhotoClick(photo)
              }}
              onContextMenu={(e) => handleContextMenu(e, photo)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )
    },
    [rowItems, onPhotoClick, onToggleFavorite, selectedIds, batchDeleteMode]
  )

  return (
    <div className="photo-grid" ref={containerRef}>
      {rowItems.length === 0 ? (
        <div className="empty-grid">暂无照片</div>
      ) : (
        <List
          ref={listRef}
          className="photo-grid-list"
          width={containerWidth}
          height={containerHeight}
          itemCount={rowItems.length}
          itemSize={getItemSize}
          onItemsRendered={handleItemsRendered}
          overscanCount={5}
        >
          {RowRenderer}
        </List>
      )}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button className="context-menu-item danger" onClick={handleDeleteClick}>
            删除
          </button>
        </div>
      )}

      {deleteTarget && (
        <DeleteDialog
          visible={true}
          photoName={deleteTarget.path.split('/').pop() || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {batchDeleteMode && (
        <div className="batch-action-bar">
          <span className="batch-count">
            已选择 {selectedIds.size} 张照片
          </span>
          <div className="batch-actions">
            <button
              className="btn-secondary"
              onClick={handleExitBatchMode}
            >
              取消
            </button>
            <button
              className="btn-danger"
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
            >
              删除所选
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PhotoGrid
