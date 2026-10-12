import CalorieEntry from '../models/CalorieEntry'
import CalorieEntryRepository from '../infrastructure/calorieEntries/CalorieEntryRepository'

export default class GetHistoryUseCase {
  private calorieEntryRepository: CalorieEntryRepository

  constructor(calorieEntryRepository: CalorieEntryRepository) {
    this.calorieEntryRepository = calorieEntryRepository
  }

  execute(userId: string, startDate: string, endDate: string): Promise<CalorieEntry[]> {
    return this.calorieEntryRepository.listByDateRange(userId, startDate, endDate)
  }
}
