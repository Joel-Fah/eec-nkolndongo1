/** Password policy: ≥ 10 chars, ≤ 72 (bcrypt limit), not a common password. No composition rules. */
const COMMON = new Set(
  `password,password1,password12,password123,passw0rd123,motdepasse,motdepasse1,motdepasse123,azertyuiop,azerty1234,azerty12345,qwertyuiop,qwerty1234,qwerty12345,1234567890,12345678910,123456789012,0123456789,0000000000,1111111111,aaaaaaaaaa,abcdefghij,abcd123456,iloveyou12,iloveyou123,welcome123,welcome1234,bienvenue1,bienvenue123,jesus12345,jesuschrist,jesus123456,godisgood1,godisgood12,godisgood123,eecnkolndongo,nkolndongo1,nkolndongo12,cameroun237,cameroun2024,cameroun123,yaounde237,yaounde123,admin12345,administrateur,letmein1234,changeme123,football123,monmotdepasse,trustno1234`
    .split(',')
    .map((s) => s.trim()),
)

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 72

export type PasswordProblem = 'too_short' | 'too_long' | 'too_common'

export function checkPassword(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'too_short'
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return 'too_long'
  if (COMMON.has(password.toLowerCase())) return 'too_common'
  return null
}
