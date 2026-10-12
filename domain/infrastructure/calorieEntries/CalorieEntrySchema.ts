import { Entity } from 'electrodb'
import { TABLE_NAME, dynamoDbClient } from '../dynamoDbClient'

const CalorieEntrySchema = new Entity(
  {
    model: {
      entity: 'calorieEntry',
      version: '1',
      service: 'calorieApp'
    },
    attributes: {
      userId: { type: 'string', required: true },
      date: { type: 'string', required: true },
      category: { type: 'string', required: true },
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      quantity: { type: 'string', required: true },
      calories: { type: 'number', required: true },
      protein: { type: 'number', required: true },
      fat: { type: 'number', required: true },
      carbs: { type: 'number', required: true },
      confidence: { type: 'number', required: true },
      lowConfidenceReason: { type: 'string' }
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['userId'], template: '${userId}', casing: 'none' },
        sk: {
          field: 'sk',
          composite: ['date', 'category', 'id'],
          template: '${date}#${category}#${id}',
          casing: 'none'
        }
      }
    }
  },
  { table: TABLE_NAME, client: dynamoDbClient }
)

export default CalorieEntrySchema
