import { NextRequest, NextResponse } from 'next/server'
import AddEntriesUseCase, { FoodInput } from '../../../domain/application/AddEntriesUseCase'
import CalorieEntryRepository from '../../../domain/infrastructure/calorieEntries/CalorieEntryRepository'
import Macros from '../../../domain/models/Macros'

interface FoodPayload {
  name: string
  quantity: string
  calories: number
  macros: Macros
  confidence: number
  low_confidence_reason?: string
}

interface EntriesPayload {
  telegram_user_id: string
  date: string
  category: string
  foods: FoodPayload[]
}

function isValidPayload(body: unknown): body is EntriesPayload {
  if (typeof body !== 'object' || body === null) return false
  const payload = body as Record<string, unknown>

  return (
    typeof payload.telegram_user_id === 'string' &&
    typeof payload.date === 'string' &&
    typeof payload.category === 'string' &&
    Array.isArray(payload.foods) &&
    payload.foods.length > 0
  )
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (!isValidPayload(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const foods: FoodInput[] = body.foods.map(food => ({
      name: food.name,
      quantity: food.quantity,
      calories: food.calories,
      macros: food.macros,
      confidence: food.confidence,
      lowConfidenceReason: food.low_confidence_reason
    }))

    const useCase = new AddEntriesUseCase(new CalorieEntryRepository())
    await useCase.execute(body.telegram_user_id, body.date, body.category, foods)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
