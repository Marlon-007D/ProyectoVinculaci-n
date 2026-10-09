import type { Student } from '../../types/student'

type Props = {
  student: Student
}

export default function StudentName({ student }: Props) {
  return (
    <div className="student-name">
      <div className={`avatar ${student.color}`}>{student.initials}</div>
      <b>{student.name}</b>
    </div>
  )
}
