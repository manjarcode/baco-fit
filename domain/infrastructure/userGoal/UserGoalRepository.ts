import UserGoal from '../../models/UserGoal'
import UserGoalSchema from './UserGoalSchema'

export default class UserGoalRepository {
  async get(userId: string): Promise<UserGoal | null> {
    const { data } = await UserGoalSchema.get({ userId }).go()
    if (!data) return null
    return new UserGoal(data.userId, data.calorieGoal, {
      protein: data.protein,
      fat: data.fat,
      carbs: data.carbs
    })
  }

  async set(userGoal: UserGoal): Promise<void> {
    await UserGoalSchema.put({
      userId: userGoal.userId,
      calorieGoal: userGoal.calorieGoal,
      protein: userGoal.macroGoals.protein,
      fat: userGoal.macroGoals.fat,
      carbs: userGoal.macroGoals.carbs
    }).go()
  }
}
