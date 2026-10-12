import UserGoal from '../models/UserGoal'
import Macros from '../models/Macros'
import UserGoalRepository from '../infrastructure/userGoal/UserGoalRepository'

export default class SetUserGoalUseCase {
  private userGoalRepository: UserGoalRepository

  constructor(userGoalRepository: UserGoalRepository) {
    this.userGoalRepository = userGoalRepository
  }

  execute(userId: string, calorieGoal: number, macroGoals: Macros): Promise<void> {
    return this.userGoalRepository.set(new UserGoal(userId, calorieGoal, macroGoals))
  }
}
