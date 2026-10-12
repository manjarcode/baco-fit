import CalorieEntry from '../../models/CalorieEntry'
import CalorieEntrySchema from './CalorieEntrySchema'

export default class CalorieEntryRepository {
  async save(entries: CalorieEntry[]): Promise<void> {
    await Promise.all(entries.map(entry => CalorieEntrySchema.put(this.toRecord(entry)).go()))
  }

  async listByDate(userId: string, date: string): Promise<CalorieEntry[]> {
    const { data } = await CalorieEntrySchema.query.primary({ userId }).begins({ date }).go()
    return data.map(this.toDomain)
  }

  async listByDateAndCategory(
    userId: string,
    date: string,
    category: string
  ): Promise<CalorieEntry[]> {
    const { data } = await CalorieEntrySchema.query.primary({ userId })
      .begins({ date, category })
      .go()
    return data.map(this.toDomain)
  }

  async listByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalorieEntry[]> {
    const { data } = await CalorieEntrySchema.query.primary({ userId })
      .between({ date: startDate, category: '' }, { date: endDate, category: '￿' })
      .go()
    return data.map(this.toDomain)
  }

  private toRecord(entry: CalorieEntry) {
    return {
      userId: entry.userId,
      date: entry.date,
      category: entry.category,
      id: entry.id,
      name: entry.name,
      quantity: entry.quantity,
      calories: entry.calories,
      protein: entry.macros.protein,
      fat: entry.macros.fat,
      carbs: entry.macros.carbs,
      confidence: entry.confidence,
      lowConfidenceReason: entry.lowConfidenceReason
    }
  }

  private toDomain(record: {
    userId: string
    date: string
    category: string
    id: string
    name: string
    quantity: string
    calories: number
    protein: number
    fat: number
    carbs: number
    confidence: number
    lowConfidenceReason?: string
  }): CalorieEntry {
    const entry = new CalorieEntry(
      record.userId,
      record.date,
      record.category,
      record.name,
      record.quantity,
      record.calories,
      { protein: record.protein, fat: record.fat, carbs: record.carbs },
      record.confidence,
      record.lowConfidenceReason
    )
    entry.id = record.id
    return entry
  }
}
