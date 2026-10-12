import UserGoal from '../models/UserGoal'
import UserGoalRepository from '../infrastructure/userGoal/UserGoalRepository'

export default class GetUserGoalUseCase {
  private userGoalRepository: UserGoalRepository

  constructor(userGoalRepository: UserGoalRepository) {
    this.userGoalRepository = userGoalRepository
  }

  execute(userId: string): Promise<UserGoal | null> {
    return this.userGoalRepository.get(userId)
  }
}
