import { useLocale } from '@eec/admin-kit'
import { TextField } from '@eec/ui/react'

/** A password field with the eye button that shows or hides what is typed. */
export function PasswordField(
  props: { label: string; placeholder: string; hint?: string; error?: string } & Record<
    string,
    unknown
  >,
) {
  const { t } = useLocale()
  return (
    <TextField
      {...props}
      type="password"
      passwordToggle={{ show: t('common.password_show'), hide: t('common.password_hide') }}
    />
  )
}
