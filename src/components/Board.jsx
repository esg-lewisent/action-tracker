function Card({ action, onClick }) {
  const status = getDateStatus(action.due_date)

  return (
    <div
      className={`card ${status}`}
      draggable
      onDragStart={e => {
        // Set a custom drag image so the card doesn't go transparent
        const clone = e.target.cloneNode(true)
        clone.style.position = 'absolute'
        clone.style.top = '-1000px'
        clone.style.width = e.target.offsetWidth + 'px'
        clone.style.transform = 'rotate(1deg)'
        clone.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'
        document.body.appendChild(clone)
        e.dataTransfer.setDragImage(clone, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        setTimeout(() => document.body.removeChild(clone), 0)

        e.dataTransfer.setData('actionId', action.id)
        e.dataTransfer.setData('currentStatus', action.status)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={e => {}}
      onClick={onClick}
    >
      <div className="card-title">{action.title}</div>
      <div className="card-tags">
        {action.board_name && <span className="card-tag tag-board">{action.board_name}</span>}
        {action.client && <span className="card-tag tag-client">{action.client}</span>}
      </div>
      <div className="card-meta">
        <div className="card-owner">
          <div className="owner-dot" style={{ background: ownerColor(action.owner) }}>
            {getInitials(action.owner)}
          </div>
          <span>{action.owner || 'Unassigned'}</span>
        </div>
        {action.due_date && (
          <span className={`card-date ${status}`}>{formatDate(action.due_date)}</span>
        )}
      </div>
      {action.comments && <div className="card-comment">{action.comments}</div>}
    </div>
  )
}
