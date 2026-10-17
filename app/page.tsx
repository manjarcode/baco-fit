import { Fragment, Suspense } from 'react'
import { connection } from 'next/server'
import { buildGetDailySummaryUseCase } from '../domain/composition'
import CalorieEntry from '../domain/models/CalorieEntry'

async function todayIsoDate(): Promise<string> {
  await connection()
  return new Date().toISOString().slice(0, 10)
}

function round2(value: number): string {
  return value.toFixed(2)
}

function groupByCategory(entries: CalorieEntry[]): [string, CalorieEntry[]][] {
  const groups = new Map<string, CalorieEntry[]>()
  for (const entry of entries) {
    const group = groups.get(entry.category)
    if (group) {
      group.push(entry)
    } else {
      groups.set(entry.category, [entry])
    }
  }
  return Array.from(groups.entries())
}

async function Summary({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams
  const date = dateParam ?? (await todayIsoDate())
  const userId = process.env.WEB_USER_ID as string

  const useCase = buildGetDailySummaryUseCase()
  const summary = await useCase.execute(userId, date)
  const groupedEntries = groupByCategory(summary.entries)

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Resumen diario</h1>
        <span className="text-sm opacity-60">{date}</span>
      </div>

      <section className="flex flex-col gap-1 rounded-xl bg-black/5 p-4 dark:bg-white/5">
        <span className="text-base opacity-70">Calorías</span>
        <span className="text-4xl font-semibold">
          {summary.totalCalories}
          {summary.goal && (
            <span className="text-lg font-normal opacity-60"> / {summary.goal.calorieGoal}</span>
          )}
        </span>
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold opacity-80">Entradas</h2>
        {summary.entries.length === 0 ? (
          <p className="text-base opacity-60">Sin entradas para esta fecha.</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {groupedEntries.map(([category, entries]) => (
                <Fragment key={category}>
                  <tr>
                    <td colSpan={2} className="pt-3">
                      <span className="inline-block rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide dark:bg-white/10">
                        {category}
                      </span>
                    </td>
                  </tr>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td className="w-full py-1.5 pl-3 align-top text-base">
                        <span className="block">
                          {entry.name}
                          {entry.confidence < 70 && (
                            <span className="ml-1" title="Confianza baja">
                              ⚠️
                            </span>
                          )}
                        </span>
                        <span className="text-sm opacity-60">{entry.quantity}</span>
                      </td>
                      <td className="py-1.5 pl-3 align-top text-sm whitespace-nowrap text-right opacity-80">
                        {entry.calories} kcal
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold opacity-80">Macros</h2>
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className="pb-1.5 text-sm font-semibold opacity-70">Proteínas</th>
              <th className="pb-1.5 text-sm font-semibold opacity-70">Grasa</th>
              <th className="pb-1.5 text-sm font-semibold opacity-70">Carbohidratos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pt-0.5 text-lg font-semibold">{round2(summary.totalMacros.protein)}gr</td>
              <td className="pt-0.5 text-lg font-semibold">{round2(summary.totalMacros.fat)}gr</td>
              <td className="pt-0.5 text-lg font-semibold">{round2(summary.totalMacros.carbs)}gr</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  )
}

export default function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-6 p-4">
      <Suspense fallback={<p>Cargando…</p>}>
        <Summary searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
