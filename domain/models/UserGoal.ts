import Macros from './Macros'

export default class UserGoal {
  userId: string
  calorieGoal: number
  macroGoals: Macros

  constructor(userId: string, calorieGoal: number, macroGoals: Macros) {
    this.userId = userId
    this.calorieGoal = calorieGoal
    this.macroGoals = macroGoals
  }
}
