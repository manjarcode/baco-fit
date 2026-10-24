import CalorieEntryRepository from '../infrastructure/calorieEntries/CalorieEntryRepository'

export default class DeleteEntryUseCase {
  private calorieEntryRepository: CalorieEntryRepository

  constructor(calorieEntryRepository: CalorieEntryRepository) {
    this.calorieEntryRepository = calorieEntryRepository
  }

  execute(userId: string, date: string, category: string, id: string): Promise<void> {
    return this.calorieEntryRepository.delete(userId, date, category, id)
  }
}
