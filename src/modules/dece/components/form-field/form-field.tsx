import type { FormFieldProps } from '../../types/forms'

export function FormField({
  label,
  type = 'text',
  required = false,
  placeholder = '',
  options,
}: FormFieldProps) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <i> *</i>}
      </span>
      {options ? (
        <select className="form-select" defaultValue="">
          <option value="" disabled>Seleccionar</option>
          {options.map(option => <option key={option}>{option}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea className="form-control" placeholder={placeholder} />
      ) : (
        <input
          className="form-control"
          type={type}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  )
}

type CheckGroupProps = {
  title: string
  items: string[]
}

export function CheckGroup({ title, items }: CheckGroupProps) {
  return (
    <fieldset className="check-group">
      <legend>{title}</legend>
      <div>
        {items.map(item => (
          <label key={item}>
            <input className="form-check-input" type="checkbox" /> {item}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
