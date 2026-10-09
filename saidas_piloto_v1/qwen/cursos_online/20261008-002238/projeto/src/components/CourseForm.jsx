import React, { useState } from 'react'

export default function CourseForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [category, setCategory] = useState(initial?.category || '')
  const [duration, setDuration] = useState(initial?.duration || '')
  const [error, setError] = useState('')

  const handle = (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('O título é obrigatório.')
      return
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      duration: duration.trim(),
    })
  }

  return (
    <form onSubmit={handle}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label>Título do curso *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Introdução a Programação"
        />
      </div>
      <div className="field">
        <label>Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Breve descrição do curso"
        />
      </div>
      <div className="form-row">
        <div className="field">
          <label>Categoria</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex.: Tecnologia"
          />
        </div>
        <div className="field">
          <label>Duração</label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Ex.: 20 horas"
          />
        </div>
      </div>
      <div className="course-actions">
        <button type="submit" className="btn btn-primary">
          {initial ? 'Salvar alterações' : 'Cadastrar'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
