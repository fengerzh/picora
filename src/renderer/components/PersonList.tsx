import React from 'react'

interface PersonListProps {
  persons: Person[]
  onPersonClick: (personId: string) => void
  onRenamePerson: (personId: string, name: string) => void
}

/** Circular avatar showing the person's representative photo, or a text fallback */
const PersonAvatar: React.FC<{ person: Person; fallbackText: string }> = ({
  person,
  fallbackText
}) => {
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    if (person.representativePhotoId) {
      window.picora
        .getThumbnailPath(person.representativePhotoId)
        .then((path) => {
          if (!cancelled && path) {
            setThumbUrl(`picora-asset://localhost${path}`)
          }
        })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [person.representativePhotoId])

  if (thumbUrl) {
    return (
      <div className="person-avatar person-avatar-photo">
        <img src={thumbUrl} alt="" draggable={false} />
      </div>
    )
  }

  return (
    <div className="person-avatar">
      <span>{fallbackText}</span>
    </div>
  )
}

const PersonList: React.FC<PersonListProps> = ({
  persons,
  onPersonClick,
  onRenamePerson
}) => {
  const safePersons = persons || []
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')

  const handleStartEdit = (person: Person) => {
    setEditingId(person.id)
    setEditName(person.name || '')
  }

  const handleConfirmEdit = () => {
    if (editingId && editName.trim()) {
      onRenamePerson(editingId, editName.trim())
    }
    setEditingId(null)
    setEditName('')
  }

  if (safePersons.length === 0) {
    return (
      <div className="person-list-empty">
        <p>还没有识别到人物</p>
        <p className="subtext">请先在设置中启动人脸扫描</p>
      </div>
    )
  }

  return (
    <div className="person-grid">
      {safePersons.map((person, idx) => (
        <div
          key={`${person.id}-${idx}`}
          className="person-card"
          onClick={() => editingId !== person.id && onPersonClick(person.id)}
        >
          <PersonAvatar
            person={person}
            fallbackText={person.name ? person.name[0] : `人${idx + 1}`}
          />
          {editingId === person.id ? (
            <div className="person-name-edit">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmEdit()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={handleConfirmEdit}
                autoFocus
              />
            </div>
          ) : (
            <div className="person-name-row">
              <div
                className="person-name"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleStartEdit(person)
                }}
              >
                {person.name || `人物 ${idx + 1}`}
              </div>
              <button
                className="person-rename-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStartEdit(person)
                }}
                title="重命名"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          )}
          <div className="person-count">{person.faceCount} 张照片</div>
        </div>
      ))}
    </div>
  )
}

export default PersonList
