import { Suspense } from 'react'
import { connection } from 'next/server'
import { buildGetDailySummaryUseCase } from '../../domain/composition'

async function todayIsoDate(): Promise<string> {
  await connection()
  return new Date().toISOString().slice(0, 10)
}

async function Summary({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams
  const date = dateParam ?? (await todayIsoDate())
  const userId = process.env.WEB_USER_ID as string

  const useCase = buildGetDailySummaryUseCase()
  const summary = await useCase.execute(userId, date)

  return (
    <>
      <h1>Resumen diario — {date}</h1>

      <section>
        <h2>Totales</h2>
        <p>Calorías: {summary.totalCalories} {summary.goal && `/ ${summary.goal.calorieGoal}`}</p>
        <p>
          Proteína: {summary.totalMacros.protein}g
          {summary.goal && ` / ${summary.goal.macroGoals.protein}g`}
        </p>
        <p>
          Grasa: {summary.totalMacros.fat}g
          {summary.goal && ` / ${summary.goal.macroGoals.fat}g`}
        </p>
        <p>
          Carbohidratos: {summary.totalMacros.carbs}g
          {summary.goal && ` / ${summary.goal.macroGoals.carbs}g`}
        </p>
      </section>

      <section>
        <h2>Entradas</h2>
        {summary.entries.length === 0 ? (
          <p>Sin entradas para esta fecha.</p>
        ) : (
          <ul>
            {summary.entries.map(entry => (
              <li key={entry.id}>
                [{entry.category}] {entry.name} ({entry.quantity}) — {entry.calories} kcal
                {entry.confidence < 70 && ' ⚠️ confianza baja'}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default function SummaryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return (
    <main>
      <Suspense fallback={<p>Cargando…</p>}>
        <Summary searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
