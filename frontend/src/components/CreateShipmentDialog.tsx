import { useState, type FormEvent } from 'react'
import { Dialog } from './Dialog'
import { Spinner } from './ui'
import { ApiError, createShipment } from '../lib/api'
import { navigate } from '../lib/router'

const LIMITS = { recipient: 120, destination: 160, origin: 160, notes: 500 } as const

type Field = keyof typeof LIMITS
type Values = Record<Field, string>
type Errors = Partial<Record<Field, string>>

const EMPTY: Values = { recipient: '', destination: '', origin: '', notes: '' }

function validate(values: Values): Errors {
  const errors: Errors = {}

  for (const field of ['recipient', 'destination'] as const) {
    if (!values[field].trim()) errors[field] = 'Ce champ est obligatoire.'
  }

  for (const field of Object.keys(LIMITS) as Field[]) {
    if (!errors[field] && values[field].trim().length > LIMITS[field]) {
      errors[field] = `Ce champ est limité à ${LIMITS[field]} caractères.`
    }
  }

  return errors
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-danger">
      {message}
    </p>
  )
}

function Form({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void
  onCreated: (reference: string, id: number) => void
  onError: (message: string) => void
}) {
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (field: Field, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const props = (field: Field) => ({
    id: `field-${field}`,
    value: values[field],
    'aria-invalid': errors[field] ? (true as const) : undefined,
    'aria-describedby': errors[field] ? `error-${field}` : undefined,
    onChange: (event: { target: { value: string } }) => set(field, event.target.value),
  })

  async function submit(event: FormEvent) {
    event.preventDefault()

    const found = validate(values)
    setErrors(found)

    if (Object.keys(found).length > 0) {
      const first = Object.keys(found)[0]
      document.getElementById(`field-${first}`)?.focus()
      return
    }

    setSubmitting(true)

    try {
      const created = await createShipment({
        recipient: values.recipient.trim(),
        destination: values.destination.trim(),
        origin: values.origin.trim() || undefined,
        notes: values.notes.trim() || undefined,
      })
      onCreated(created.tracking_ref, created.id)
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        const serverErrors: Errors = {}
        for (const [field, message] of Object.entries(error.fields)) {
          if (field in LIMITS) serverErrors[field as Field] = message
        }
        setErrors(serverErrors)
      } else {
        onError(error instanceof ApiError ? error.message : 'La création a échoué.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="field-recipient" className="label">
          Destinataire
        </label>
        <input
          {...props('recipient')}
          className="input"
          autoComplete="off"
          placeholder="Nom du destinataire"
          autoFocus
        />
        <FieldError id="error-recipient" message={errors.recipient} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="field-destination" className="label">
            Destination
          </label>
          <input {...props('destination')} className="input" autoComplete="off" placeholder="Ville de livraison" />
          <FieldError id="error-destination" message={errors.destination} />
        </div>
        <div>
          <label htmlFor="field-origin" className="label">
            Origine <span className="font-normal text-muted">(facultatif)</span>
          </label>
          <input {...props('origin')} className="input" autoComplete="off" placeholder="Ville d’expédition" />
          <FieldError id="error-origin" message={errors.origin} />
        </div>
      </div>

      <div>
        <label htmlFor="field-notes" className="label">
          Notes <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <textarea
          {...props('notes')}
          rows={3}
          className="input h-auto resize-none py-2.5"
          placeholder="Instructions de livraison, contenu fragile…"
        />
        <div className="mt-1.5 flex justify-between gap-3">
          <FieldError id="error-notes" message={errors.notes} />
          <span className="ml-auto text-xs tabular-nums text-muted">
            {values.notes.length}/{LIMITS.notes}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="btn-primary min-w-[9.5rem]" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner /> Création…
            </>
          ) : (
            'Créer l’expédition'
          )}
        </button>
      </div>
    </form>
  )
}

export function CreateShipmentDialog({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean
  onClose: () => void
  onCreated: (reference: string) => void
  onError: (message: string) => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouvelle expédition"
      description="Un numéro de suivi est généré automatiquement."
    >
      <Form
        onClose={onClose}
        onCreated={(reference, id) => {
          onCreated(reference)
          navigate(`/shipments/${id}`)
        }}
        onError={onError}
      />
    </Dialog>
  )
}
