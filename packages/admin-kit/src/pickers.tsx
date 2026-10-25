/** The admin's date and time fields: the brand's pickers with the screen's words already in place (packages/i18n). */
import { DatePicker, DateTimePicker, type PickerLabels, TimePicker } from '@eec/ui/react'
import { useLocale } from './locale.tsx'

function usePicker() {
  const { t, locale } = useLocale()
  const labels: PickerLabels = {
    open: t('admin.picker.open'),
    prev: t('admin.picker.prev'),
    next: t('admin.picker.next'),
    today: t('admin.picker.today'),
    clear: t('admin.picker.clear'),
    chooseMonth: t('admin.picker.choose_month'),
    chooseYear: t('admin.picker.choose_year'),
    prevYears: t('admin.picker.prev_years'),
    nextYears: t('admin.picker.next_years'),
    hour: t('admin.picker.hour'),
    minute: t('admin.picker.minute'),
    done: t('admin.picker.done'),
  }
  return { t, locale, labels }
}

type Common = { label: string; hint?: string; disabled?: boolean; required?: boolean }

export function DateField(
  props: Common & { value: string; onChange: (v: string) => void; min?: string; max?: string },
) {
  const { t, locale, labels } = usePicker()
  return (
    <DatePicker
      {...props}
      locale={locale}
      labels={labels}
      placeholder={t('admin.picker.date_ph')}
    />
  )
}

export function TimeField(
  props: Common & { value: string; onChange: (v: string) => void; step?: number },
) {
  const { t, labels } = usePicker()
  return <TimePicker {...props} labels={labels} placeholder={t('admin.picker.time_ph')} />
}

export function DateTimeField(
  props: Omit<Common, 'required'> & {
    value: string
    onChange: (v: string) => void
    min?: string
    max?: string
    className?: string
  },
) {
  const { t, locale, labels } = usePicker()
  return (
    <DateTimePicker
      {...props}
      timeLabel={t('admin.picker.time')}
      locale={locale}
      labels={labels}
      datePlaceholder={t('admin.picker.date_ph')}
      timePlaceholder={t('admin.picker.time_ph')}
    />
  )
}
