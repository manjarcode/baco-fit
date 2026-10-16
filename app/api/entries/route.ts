import { NextRequest, NextResponse } from 'next/server'
import { FoodInput } from '../../../domain/application/AddEntriesUseCase'
import { buildAddEntriesUseCase } from '../../../domain/composition'

interface ItemPayload {
  food: string
  gr: number
  calories: number
  proteins: number
  carbs: number
  fats: number
  certainty: number
  certainty_reason?: string
}

interface EntriesPayload {
  userId: string | number
  date: string
  category: string
  items: ItemPayload[]
}

function isValidPayload(body: unknown): body is EntriesPayload {
  if (typeof body !== 'object' || body === null) return false
  const payload = body as Record<string, unknown>

  return (
    (typeof payload.userId === 'string' || typeof payload.userId === 'number') &&
    typeof payload.date === 'string' &&
    typeof payload.category === 'string' &&
    Array.isArray(payload.items) &&
    payload.items.length > 0
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

    const foods: FoodInput[] = body.items.map(item => ({
      name: item.food,
      quantity: `${item.gr}g`,
      calories: item.calories,
      macros: { protein: item.proteins, fat: item.fats, carbs: item.carbs },
      confidence: item.certainty,
      lowConfidenceReason: item.certainty_reason
    }))

    const useCase = buildAddEntriesUseCase()
    await useCase.execute(String(body.userId), body.date, body.category, foods)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
