import React, { useEffect, useRef } from 'react'

interface DeleteDialogProps {
  visible: boolean
  photoName: string
  onConfirm: () => void
  onCancel: () => void
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  visible,
  photoName,
  onConfirm,
  onCancel
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus cancel button by default for safety
  useEffect(() => {
    if (visible && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [visible])

  // Close on Escape
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, onCancel])

  if (!visible) return null

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dc2626"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="dialog-title">确定删除这张照片吗？</h2>
        <p className="dialog-filename">{photoName}</p>
        <p className="dialog-subtext">照片将移至回收站，可以恢复</p>
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            className="btn-secondary dialog-btn"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="btn-danger dialog-btn"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteDialog
