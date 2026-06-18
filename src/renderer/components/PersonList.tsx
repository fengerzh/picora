import React from 'react'

interface PersonListProps {
  persons: Person[]
  onPersonClick: (personId: string) => void
  onRenamePerson: (personId: string, name: string) => void
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
          <div className="person-avatar">
            <span>{person.name ? person.name[0] : `人${idx + 1}`}</span>
          </div>
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
            <div
              className="person-name"
              onDoubleClick={(e) => {
                e.stopPropagation()
                handleStartEdit(person)
              }}
            >
              {person.name || `人物 ${idx + 1}`}
            </div>
          )}
          <div className="person-count">{person.faceCount} 张照片</div>
        </div>
      ))}
    </div>
  )
}

export default PersonList
