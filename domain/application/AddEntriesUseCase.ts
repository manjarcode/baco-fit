import CalorieEntry from '../models/CalorieEntry'
import Macros from '../models/Macros'
import CalorieEntryRepository from '../infrastructure/calorieEntries/CalorieEntryRepository'

export interface FoodInput {
  name: string
  quantity: string
  calories: number
  macros: Macros
  confidence: number
  lowConfidenceReason?: string
}

export default class AddEntriesUseCase {
  private calorieEntryRepository: CalorieEntryRepository

  constructor(calorieEntryRepository: CalorieEntryRepository) {
    this.calorieEntryRepository = calorieEntryRepository
  }

  async execute(
    userId: string,
    date: string,
    category: string,
    foods: FoodInput[]
  ): Promise<void> {
    const entries = foods.map(
      food =>
        new CalorieEntry(
          userId,
          date,
          category,
          food.name,
          food.quantity,
          food.calories,
          food.macros,
          food.confidence,
          food.lowConfidenceReason
        )
    )

    await this.calorieEntryRepository.save(entries)
  }
}
