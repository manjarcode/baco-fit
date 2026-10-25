export default class FoodReference {
  userId: string
  foodName: string
  detail: string

  constructor(userId: string, foodName: string, detail: string) {
    this.userId = userId
    this.foodName = foodName.trim().toLowerCase()
    this.detail = detail
  }
}
