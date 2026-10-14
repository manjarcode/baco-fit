import { NextRequest, NextResponse } from 'next/server'
import GetUserGoalUseCase from '../../../domain/application/GetUserGoalUseCase'
import SetUserGoalUseCase from '../../../domain/application/SetUserGoalUseCase'
import UserGoalRepository from '../../../domain/infrastructure/userGoal/UserGoalRepository'
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
    const useCase = new GetUserGoalUseCase(new UserGoalRepository())
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

    const useCase = new SetUserGoalUseCase(new UserGoalRepository())
    await useCase.execute(body.userId, body.calorieGoal, body.macroGoals)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
