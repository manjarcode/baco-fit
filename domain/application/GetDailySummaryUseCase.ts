import CalorieEntry from '../models/CalorieEntry'
import UserGoal from '../models/UserGoal'
import CalorieEntryRepository from '../infrastructure/calorieEntries/CalorieEntryRepository'
import UserGoalRepository from '../infrastructure/userGoal/UserGoalRepository'

export interface DailySummary {
  entries: CalorieEntry[]
  totalCalories: number
  totalMacros: { protein: number; fat: number; carbs: number }
  goal: UserGoal | null
}

export default class GetDailySummaryUseCase {
  private calorieEntryRepository: CalorieEntryRepository
  private userGoalRepository: UserGoalRepository

  constructor(calorieEntryRepository: CalorieEntryRepository, userGoalRepository: UserGoalRepository) {
    this.calorieEntryRepository = calorieEntryRepository
    this.userGoalRepository = userGoalRepository
  }

  async execute(userId: string, date: string): Promise<DailySummary> {
    const [entries, goal] = await Promise.all([
      this.calorieEntryRepository.listByDate(userId, date),
      this.userGoalRepository.get(userId)
    ])

    return {
      entries,
      totalCalories: this.sumCalories(entries),
      totalMacros: this.sumMacros(entries),
      goal
    }
  }

  private sumCalories(entries: CalorieEntry[]): number {
    return entries.reduce((total, entry) => total + entry.calories, 0)
  }

  private sumMacros(entries: CalorieEntry[]) {
    return entries.reduce(
      (total, entry) => ({
        protein: total.protein + entry.macros.protein,
        fat: total.fat + entry.macros.fat,
        carbs: total.carbs + entry.macros.carbs
      }),
      { protein: 0, fat: 0, carbs: 0 }
    )
  }
}
