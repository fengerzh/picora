import React, { useState } from 'react'

interface SettingsProps {
  initialFolders: string[]
  onSave: (config: {
    folders: string[]
    thumbnailSize: number
    scanOnStartup: boolean
  }) => void
  onCancel?: () => void
  onRescan: () => void
  isScanning: boolean
}

const Settings: React.FC<SettingsProps> = ({
  initialFolders,
  onSave,
  onCancel,
  onRescan,
  isScanning
}) => {
  const [folders, setFolders] = useState<string[]>(initialFolders)
  const [scanOnStartup, setScanOnStartup] = useState(false)
  const [thumbnailSize, setThumbnailSize] = useState(300)
  const [saving, setSaving] = useState(false)

  // Load current config to preserve thumbnailSize
  React.useEffect(() => {
    window.picora.getConfig().then((config) => {
      setScanOnStartup(config.scanOnStartup)
      setThumbnailSize(config.thumbnailSize)
    }).catch(() => {})
  }, [])

  const handleAddFolder = async () => {
    try {
      const folder = await window.picora.selectFolder()
      if (folder && !folders.includes(folder)) {
        setFolders((prev) => [...prev, folder])
      }
    } catch (err) {
      console.error('选择文件夹失败：', err)
    }
  }

  const handleRemoveFolder = (folder: string) => {
    setFolders((prev) => prev.filter((f) => f !== folder))
  }

  const handleSave = async () => {
    if (folders.length === 0) {
      alert('请至少添加一个照片文件夹')
      return
    }
    setSaving(true)
    try {
      await onSave({
        folders,
        thumbnailSize,
        scanOnStartup
      })
    } finally {
      setSaving(false)
    }
  }

  const folderName = (path: string): string => {
    return path.split('/').pop() || path
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1 className="settings-title">Picora 设置</h1>

        <section className="settings-section">
          <h2 className="section-title">照片文件夹</h2>
          <p className="section-desc">选择包含照片的文件夹，Picora 将扫描其中的照片。</p>

          {folders.length > 0 && (
            <ul className="folder-list">
              {folders.map((folder) => (
                <li key={folder} className="folder-item">
                  <div className="folder-info">
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
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <div>
                      <div className="folder-name">{folderName(folder)}</div>
                      <div className="folder-path">{folder}</div>
                    </div>
                  </div>
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleRemoveFolder(folder)}
                    title="移除"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="btn-secondary" onClick={handleAddFolder}>
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            添加文件夹
          </button>
        </section>

        <section className="settings-section">
          <h2 className="section-title">启动选项</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={scanOnStartup}
              onChange={(e) => setScanOnStartup(e.target.checked)}
            />
            <span>启动时自动扫描新照片</span>
          </label>
        </section>

        {onCancel && (
          <section className="settings-section">
            <h2 className="section-title">重新扫描</h2>
            <p className="section-desc">重新扫描所有文件夹，更新照片库。</p>
            <button
              className="btn-secondary"
              onClick={onRescan}
              disabled={isScanning}
            >
              {isScanning ? '扫描中…' : '重新扫描'}
            </button>
          </section>
        )}

        <div className="settings-actions">
          {onCancel && (
            <button className="btn-secondary" onClick={onCancel}>
              取消
            </button>
          )}
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings
