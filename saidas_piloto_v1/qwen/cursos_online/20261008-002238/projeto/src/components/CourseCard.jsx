import React from 'react'

export default function CourseCard({ course, footer }) {
  return (
    <div className="course-item">
      <div className="course-title">{course.title}</div>
      {course.description && <p className="course-desc">{course.description}</p>}
      <div className="meta">
        {course.category && <span className="tag">{course.category}</span>}
        {course.duration && <span className="tag">{course.duration}</span>}
      </div>
      {footer}
    </div>
  )
}
