import { expect, test } from 'vitest'
import { callName } from './call-name.ts'

test('a chosen display name wins, the sign-up default gives way to the first name', () => {
  expect(callName({ name: 'Joël Fah', firstName: 'Joël', lastName: 'Fah' })).toBe('Joël')
  expect(callName({ name: 'Pasteur Joël', firstName: 'Joël', lastName: 'Fah' })).toBe(
    'Pasteur Joël',
  )
  expect(callName({ name: 'Joël', firstName: '', lastName: '' })).toBe('Joël')
  expect(callName({ name: '', firstName: ' Ana ' })).toBe('Ana')
})
