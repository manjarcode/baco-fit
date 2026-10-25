'use server'

import { revalidatePath } from 'next/cache'
import { buildDeleteEntryUseCase, buildSaveFoodReferenceUseCase } from '../domain/composition'

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const date = formData.get('date')
  const category = formData.get('category')
  const id = formData.get('id')

  if (typeof date !== 'string' || typeof category !== 'string' || typeof id !== 'string') {
    throw new Error('Invalid delete payload')
  }

  const userId = process.env.WEB_USER_ID as string
  const useCase = buildDeleteEntryUseCase()
  await useCase.execute(userId, date, category, id)

  revalidatePath('/')
}

export async function saveFoodReferenceAction(formData: FormData): Promise<void> {
  const foodName = formData.get('foodName')
  const detail = formData.get('detail')

  if (typeof foodName !== 'string' || typeof detail !== 'string') {
    throw new Error('Invalid food reference payload')
  }

  const userId = process.env.WEB_USER_ID as string
  const useCase = buildSaveFoodReferenceUseCase()
  await useCase.execute(userId, foodName, detail)

  revalidatePath('/')
}
