import { Entity } from 'electrodb'
import { TABLE_NAME, dynamoDbClient } from '../dynamoDbClient'

const UserGoalSchema = new Entity(
  {
    model: {
      entity: 'userGoal',
      version: '1',
      service: 'calorieApp'
    },
    attributes: {
      userId: { type: 'string', required: true },
      calorieGoal: { type: 'number', required: true },
      protein: { type: 'number', required: true },
      fat: { type: 'number', required: true },
      carbs: { type: 'number', required: true }
    },
    indexes: {
      primary: {
        pk: { field: 'pk', composite: ['userId'], template: '${userId}', casing: 'none' },
        sk: { field: 'sk', composite: [], template: 'CONFIG', casing: 'none' }
      }
    }
  },
  { table: TABLE_NAME, client: dynamoDbClient }
)

export default UserGoalSchema
