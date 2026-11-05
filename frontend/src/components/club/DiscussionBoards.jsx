import { useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import { connectBoardSocket } from '../../services/realtime'
import { errorMessage } from '../../services/errors'
import { formatWhen } from '../../services/format'
import { Button, Badge, Card, Field, Notice, SectionTitle, inputClass } from '../ui'

const statusLabels = {
  connecting: 'Connecting…',
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  unauthorized: 'Session expired',
}

export default function DiscussionBoards({ clubId }) {
  const [boards, setBoards] = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [connection, setConnection] = useState('connecting')
  const [showCreate, setShowCreate] = useState(false)
  const [newBoard, setNewBoard] = useState({ title: '', prompt: '', kind: 'thread' })
  const socketRef = useRef(null)
  const activeBoardRef = useRef(null)
  const listEndRef = useRef(null)

  useEffect(() => {
    api.get(`/clubs/${clubId}/boards`)
      .then((response) => {
        setBoards(response.data)
        setActiveBoardId((current) => current ?? response.data[0]?.id ?? null)
      })
      .catch((err) => setError(errorMessage(err, 'Could not load discussion boards.')))
  }, [clubId])

  useEffect(() => {
    const socket = connectBoardSocket({
      onStatus: setConnection,
      onError: setError,
      onMessage: (message) => {
        if (message.boardId !== activeBoardRef.current) {
          return
        }
        setMessages((previous) => (previous.some((item) => item.id === message.id) ? previous : [...previous, message]))
      },
    })
    socketRef.current = socket
    return () => {
      socket.close()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    activeBoardRef.current = activeBoardId
    if (activeBoardId === null) {
      setMessages([])
      return
    }
    socketRef.current?.subscribe(activeBoardId)
    api.get(`/clubs/${clubId}/boards/${activeBoardId}/messages`)
      .then((response) => setMessages(response.data))
      .catch((err) => setError(errorMessage(err, 'Could not load messages.')))
  }, [clubId, activeBoardId])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const activeBoard = boards.find((board) => board.id === activeBoardId)

  const handleSend = async (event) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || activeBoardId === null) {
      return
    }
    setDraft('')
    setError('')

    if (socketRef.current?.send(activeBoardId, body)) {
      return
    }

    try {
      const response = await api.post(`/clubs/${clubId}/boards/${activeBoardId}/messages`, { body })
      setMessages((previous) => [...previous, response.data])
    } catch (err) {
      setDraft(body)
      setError(errorMessage(err, 'Message could not be sent.'))
    }
  }

  const handleCreateBoard = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const response = await api.post(`/clubs/${clubId}/boards`, newBoard)
      setBoards((previous) => [...previous, response.data])
      setActiveBoardId(response.data.id)
      setNewBoard({ title: '', prompt: '', kind: 'thread' })
      setShowCreate(false)
    } catch (err) {
      setError(errorMessage(err, 'Could not create the board.'))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <Card className="h-fit space-y-4">
        <SectionTitle aside={<Button variant="ghost" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Close' : 'New'}</Button>}>
          Boards
        </SectionTitle>

        {showCreate && (
          <form className="space-y-3 rounded-sm border border-gold/60 bg-parchment p-3" onSubmit={handleCreateBoard}>
            <Field id="boardTitle" label="Title">
              <input id="boardTitle" className={inputClass} required minLength={2} maxLength={120}
                value={newBoard.title} onChange={(e) => setNewBoard({ ...newBoard, title: e.target.value })} />
            </Field>
            <Field id="boardPrompt" label="Prompt">
              <input id="boardPrompt" className={inputClass} maxLength={255} placeholder="e.g. Chapters 1–5: what hooked you?"
                value={newBoard.prompt} onChange={(e) => setNewBoard({ ...newBoard, prompt: e.target.value })} />
            </Field>
            <Field id="boardKind" label="Type">
              <select id="boardKind" className={inputClass} value={newBoard.kind}
                onChange={(e) => setNewBoard({ ...newBoard, kind: e.target.value })}>
                <option value="thread">Discussion thread</option>
                <option value="chat">Live chat</option>
              </select>
            </Field>
            <Button type="submit" className="w-full">Create board</Button>
          </form>
        )}

        {boards.length === 0 ? (
          <p className="italic text-sepia/70">No boards yet. Start the first thread.</p>
        ) : (
          <ul className="space-y-2">
            {boards.map((board) => (
              <li key={board.id}>
                <button
                  type="button"
                  onClick={() => setActiveBoardId(board.id)}
                  aria-current={board.id === activeBoardId ? 'true' : undefined}
                  className={`w-full rounded-sm border px-3 py-2 text-left transition ${
                    board.id === activeBoardId ? 'border-burgundy bg-parchment' : 'border-gold/50 hover:border-burgundy'
                  }`}
                >
                  <span className="block font-display text-base">{board.title}</span>
                  <span className="text-xs text-sepia/70">
                    {board.kind === 'chat' ? 'Live chat' : 'Thread'} · {board.replyCount} {board.replyCount === 1 ? 'reply' : 'replies'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex min-h-[420px] flex-col gap-4">
        {activeBoard ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gold/50 pb-3">
              <div>
                <h3 className="font-display text-xl">{activeBoard.title}</h3>
                {activeBoard.prompt && <p className="italic text-sepia/70">{activeBoard.prompt}</p>}
              </div>
              <Badge tone={connection === 'connected' ? 'burgundy' : 'neutral'}>
                {statusLabels[connection] ?? connection}
              </Badge>
            </div>

            <ol className="flex max-h-[420px] flex-1 flex-col gap-3 overflow-y-auto pr-2">
              {messages.length === 0 && <li className="italic text-sepia/60">No messages yet. Share a first thought.</li>}
              {messages.map((message) => (
                <li key={message.id} className="rounded-sm border border-gold/40 bg-parchment px-4 py-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-sepia/70">
                    <span className="font-display text-sm text-burgundy">{message.authorUsername}</span>
                    <span>{formatWhen(message.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </li>
              ))}
              <div ref={listEndRef} />
            </ol>

            <form className="flex gap-3" onSubmit={handleSend}>
              <label htmlFor="messageDraft" className="sr-only">Share a thought</label>
              <input
                id="messageDraft"
                className={inputClass}
                maxLength={2000}
                placeholder="Share a thought or a favorite line…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" disabled={!draft.trim()}>Send</Button>
            </form>
          </>
        ) : (
          <p className="italic text-sepia/70">Choose or create a board to start talking.</p>
        )}

        {error && <Notice>{error}</Notice>}
      </Card>
    </div>
  )
}
