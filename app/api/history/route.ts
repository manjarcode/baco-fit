import { NextRequest, NextResponse } from 'next/server'
import GetHistoryUseCase from '../../../domain/application/GetHistoryUseCase'
import CalorieEntryRepository from '../../../domain/infrastructure/calorieEntries/CalorieEntryRepository'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.ENTRIES_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = request.nextUrl.searchParams.get('userId')
  const startDate = request.nextUrl.searchParams.get('startDate')
  const endDate = request.nextUrl.searchParams.get('endDate')

  if (!userId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  try {
    const useCase = new GetHistoryUseCase(new CalorieEntryRepository())
    const entries = await useCase.execute(userId, startDate, endDate)

    return NextResponse.json({ entries })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
