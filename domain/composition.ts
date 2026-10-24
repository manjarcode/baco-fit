import AddEntriesUseCase from './application/AddEntriesUseCase'
import DeleteEntryUseCase from './application/DeleteEntryUseCase'
import GetDailySummaryUseCase from './application/GetDailySummaryUseCase'
import GetHistoryUseCase from './application/GetHistoryUseCase'
import GetUserGoalUseCase from './application/GetUserGoalUseCase'
import SetUserGoalUseCase from './application/SetUserGoalUseCase'
import CalorieEntryRepository from './infrastructure/calorieEntries/CalorieEntryRepository'
import UserGoalRepository from './infrastructure/userGoal/UserGoalRepository'

export function buildAddEntriesUseCase(): AddEntriesUseCase {
  return new AddEntriesUseCase(new CalorieEntryRepository())
}

export function buildDeleteEntryUseCase(): DeleteEntryUseCase {
  return new DeleteEntryUseCase(new CalorieEntryRepository())
}

export function buildGetDailySummaryUseCase(): GetDailySummaryUseCase {
  return new GetDailySummaryUseCase(new CalorieEntryRepository(), new UserGoalRepository())
}

export function buildGetHistoryUseCase(): GetHistoryUseCase {
  return new GetHistoryUseCase(new CalorieEntryRepository())
}

export function buildGetUserGoalUseCase(): GetUserGoalUseCase {
  return new GetUserGoalUseCase(new UserGoalRepository())
}

export function buildSetUserGoalUseCase(): SetUserGoalUseCase {
  return new SetUserGoalUseCase(new UserGoalRepository())
}
