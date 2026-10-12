import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export const TABLE_NAME = 'calorie_app'

export const dynamoDbClient = new DynamoDBClient({
  region: process.env.DB_REGION,
  credentials: {
    accessKeyId: process.env.DB_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.DB_SECRET_ACCESS_KEY as string
  }
})
