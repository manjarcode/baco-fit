import FoodReference from '../models/FoodReference'
import FoodReferenceRepository from '../infrastructure/foodReferences/FoodReferenceRepository'

export default class SaveFoodReferenceUseCase {
  private foodReferenceRepository: FoodReferenceRepository

  constructor(foodReferenceRepository: FoodReferenceRepository) {
    this.foodReferenceRepository = foodReferenceRepository
  }

  async execute(userId: string, foodName: string, detail: string): Promise<void> {
    const reference = new FoodReference(userId, foodName, detail)
    await this.foodReferenceRepository.save(reference)
  }
}
