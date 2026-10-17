import { Fragment, Suspense } from 'react'
import { connection } from 'next/server'
import { buildGetDailySummaryUseCase } from '../domain/composition'
import CalorieEntry from '../domain/models/CalorieEntry'
import styles from './page.module.css'

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
      <div className={styles.header}>
        <h1 className={styles.title}>Resumen diario</h1>
        <span className={styles.date}>{date}</span>
      </div>

      <section className={styles.caloriesCard}>
        <span className={styles.caloriesLabel}>Calorías</span>
        <span className={styles.caloriesValue}>
          {summary.totalCalories}
          {summary.goal && <span className={styles.caloriesGoal}> / {summary.goal.calorieGoal}</span>}
        </span>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Entradas</h2>
        {summary.entries.length === 0 ? (
          <p className={styles.emptyState}>Sin entradas para esta fecha.</p>
        ) : (
          <table className={styles.entriesTable}>
            <tbody>
              {groupedEntries.map(([category, entries]) => (
                <Fragment key={category}>
                  <tr className={styles.categoryRow}>
                    <td colSpan={2}>
                      <span className={styles.categoryTag}>{category}</span>
                    </td>
                  </tr>
                  {entries.map(entry => (
                    <tr key={entry.id} className={styles.entryRow}>
                      <td>
                        <span className={styles.entryName}>
                          {entry.name}
                          {entry.confidence < 70 && (
                            <span className={styles.lowConfidence} title="Confianza baja">
                              ⚠️
                            </span>
                          )}
                        </span>
                        <span className={styles.entryMeta}>{entry.quantity}</span>
                      </td>
                      <td className={styles.entryCalories}>{entry.calories} kcal</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Macros</h2>
        <table className={styles.macrosTable}>
          <thead>
            <tr>
              <th>Proteínas</th>
              <th>Grasa</th>
              <th>Carbohidratos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{round2(summary.totalMacros.protein)}gr</td>
              <td>{round2(summary.totalMacros.fat)}gr</td>
              <td>{round2(summary.totalMacros.carbs)}gr</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  )
}

export default function Home({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return (
    <main className={styles.main}>
      <Suspense fallback={<p>Cargando…</p>}>
        <Summary searchParams={searchParams} />
      </Suspense>
    </main>
  )
}
