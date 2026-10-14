import { NextRequest, NextResponse } from 'next/server'
import { buildGetUserGoalUseCase, buildSetUserGoalUseCase } from '../../../domain/composition'
import Macros from '../../../domain/models/Macros'

interface SetGoalPayload {
  userId: string
  calorieGoal: number
  macroGoals: Macros
}

function isValidSetGoalPayload(body: unknown): body is SetGoalPayload {
  if (typeof body !== 'object' || body === null) return false
  const payload = body as Record<string, unknown>
  const macroGoals = payload.macroGoals as Record<string, unknown> | undefined

  return (
    typeof payload.userId === 'string' &&
    typeof payload.calorieGoal === 'number' &&
    typeof macroGoals === 'object' &&
    macroGoals !== null &&
    typeof macroGoals.protein === 'number' &&
    typeof macroGoals.fat === 'number' &&
    typeof macroGoals.carbs === 'number'
  )
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = request.nextUrl.searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const useCase = buildGetUserGoalUseCase()
    const goal = await useCase.execute(userId)

    return NextResponse.json({ goal })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    if (!isValidSetGoalPayload(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const useCase = buildSetUserGoalUseCase()
    await useCase.execute(body.userId, body.calorieGoal, body.macroGoals)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
