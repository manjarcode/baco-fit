import FoodReference from '../../models/FoodReference'
import FoodReferenceSchema from './FoodReferenceSchema'

export default class FoodReferenceRepository {
  async save(reference: FoodReference): Promise<void> {
    await FoodReferenceSchema.put(this.toRecord(reference)).go()
  }

  private toRecord(reference: FoodReference) {
    return {
      userId: reference.userId,
      foodName: reference.foodName,
      detail: reference.detail
    }
  }
}
