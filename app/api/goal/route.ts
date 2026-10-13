import { NextRequest, NextResponse } from 'next/server'
import GetUserGoalUseCase from '../../../domain/application/GetUserGoalUseCase'
import UserGoalRepository from '../../../domain/infrastructure/userGoal/UserGoalRepository'

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
