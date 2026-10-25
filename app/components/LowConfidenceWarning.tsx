'use client'

import { useState } from 'react'
import { saveFoodReferenceAction } from '../actions'

export default function LowConfidenceWarning({
  foodName,
  reason
}: {
  foodName: string
  reason?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Confianza baja para ${foodName}, añadir detalle`}
        className="ml-1 cursor-pointer"
      >
        ⚠️
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 dark:bg-neutral-900"
            onClick={event => event.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold">Añadir detalle</h3>
            <form
              action={async formData => {
                await saveFoodReferenceAction(formData)
                setOpen(false)
              }}
              className="flex flex-col gap-3"
            >
              {reason && <p className="text-sm opacity-70">{reason}</p>}
              <input
                type="text"
                name="foodName"
                defaultValue={foodName}
                required
                className="rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
              <textarea
                name="detail"
                placeholder="Ej: 150gr por ración"
                rows={3}
                required
                className="rounded-lg border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
