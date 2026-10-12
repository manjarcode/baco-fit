import { randomUUID } from 'node:crypto'
import Macros from './Macros'

export default class CalorieEntry {
  id: string
  userId: string
  date: string
  category: string
  name: string
  quantity: string
  calories: number
  macros: Macros
  confidence: number
  lowConfidenceReason?: string

  constructor(
    userId: string,
    date: string,
    category: string,
    name: string,
    quantity: string,
    calories: number,
    macros: Macros,
    confidence: number,
    lowConfidenceReason?: string
  ) {
    this.id = randomUUID()
    this.userId = userId
    this.date = date
    this.category = category
    this.name = name
    this.quantity = quantity
    this.calories = calories
    this.macros = macros
    this.confidence = confidence
    this.lowConfidenceReason = lowConfidenceReason
  }
}
