import { Entity } from 'electrodb'
import { TABLE_NAME, dynamoDbClient } from '../dynamoDbClient'

const FoodReferenceSchema = new Entity(
  {
    model: {
      entity: 'foodReference',
      version: '1',
      service: 'calorieApp'
    },
    attributes: {
      userId: { type: 'string', required: true },
      foodName: { type: 'string', required: true },
      detail: { type: 'string', required: true }
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['userId'], template: '${userId}', casing: 'none' },
        sk: { field: 'sk', composite: ['foodName'], template: '${foodName}', casing: 'none' }
      }
    }
  },
  { table: TABLE_NAME, client: dynamoDbClient }
)

export default FoodReferenceSchema
