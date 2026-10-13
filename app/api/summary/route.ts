import { NextRequest, NextResponse } from 'next/server'
import GetDailySummaryUseCase from '../../../domain/application/GetDailySummaryUseCase'
import CalorieEntryRepository from '../../../domain/infrastructure/calorieEntries/CalorieEntryRepository'
import UserGoalRepository from '../../../domain/infrastructure/userGoal/UserGoalRepository'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = request.nextUrl.searchParams.get('userId')
  const date = request.nextUrl.searchParams.get('date')

  if (!userId || !date) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const useCase = new GetDailySummaryUseCase(new CalorieEntryRepository(), new UserGoalRepository())
    const summary = await useCase.execute(userId, date)

    return NextResponse.json(summary)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
