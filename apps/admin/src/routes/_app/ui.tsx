import {
  AccordionBox,
  Avatar,
  Badge,
  Button,
  Card,
  CheckboxField,
  ComboboxField,
  DialogBox,
  EmptyState,
  MenuButton,
  PopoverBox,
  SelectField,
  Skeleton,
  SwitchField,
  TabsBox,
  TextField,
  TooltipTip,
  toastManager,
} from '@eec/ui/react'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { Illustration } from '../../components/Illustration'
import { useT } from '../../lib/locale'

export const Route = createFileRoute('/_app/ui')({ component: UiGallery })

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4" aria-label={title}>
      <h2 className="text-2xl">{title}</h2>
      <div className="grid gap-4 rounded-xl bg-surface p-5 shadow-1 md:p-7">{children}</div>
    </section>
  )
}

function UiGallery() {
  const t = useT()
  const options = [1, 2, 3, 4].map((n) => ({ value: String(n), label: t(`ui.o${n}` as 'ui.o1') }))
  return (
    <div className="grid gap-10">
      <header className="grid gap-2">
        <h1 className="text-4xl">{t('ui.title')}</h1>
        <p className="max-w-[66ch] text-lg text-ink-muted">{t('ui.lead')}</p>
      </header>

      <Block title={t('ui.buttons')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button iconOnly aria-label={t('nav.search')}>
            <Icon name="search" />
          </Button>
        </div>
      </Block>

      <Block title={t('ui.fields')}>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField label={t('ui.field_name')} hint={t('ui.field_hint')} />
          <TextField label={t('ui.field_name')} error={t('ui.field_error')} />
          <TextField label={t('ui.field_notes')} textarea />
          <div className="grid content-start gap-5">
            <SelectField
              label={t('ui.select_label')}
              placeholder={t('ui.select_placeholder')}
              options={options}
            />
            <ComboboxField
              label={t('ui.combo_label')}
              options={options}
              emptyText={t('admin.palette.empty')}
            />
          </div>
        </div>
      </Block>

      <Block title={t('ui.choices')}>
        <div className="flex flex-wrap gap-6">
          <CheckboxField label={t('ui.check')} />
          <SwitchField label={t('ui.switch')} />
        </div>
      </Block>

      <Block title={t('ui.overlays')}>
        <div className="flex flex-wrap items-center gap-3">
          <DialogBox
            trigger={
              <button type="button" className="btn btn-primary">
                {t('ui.dialog_open')}
              </button>
            }
            title={t('ui.dialog_title')}
            closeLabel={t('ui.close')}
          >
            <p className="text-ink-muted">{t('ui.dialog_text')}</p>
          </DialogBox>
          <DialogBox
            side="end"
            trigger={
              <button type="button" className="btn btn-secondary">
                {t('ui.sheet_open')}
              </button>
            }
            title={t('ui.sheet_title')}
            closeLabel={t('ui.close')}
          />
          <MenuButton
            label={t('ui.menu')}
            items={[
              { id: 'e', label: t('ui.menu_edit') },
              { id: 'c', label: t('ui.menu_copy') },
              { id: 'd', label: t('ui.menu_delete') },
            ]}
          />
          <PopoverBox trigger={t('ui.popover')}>
            <p className="max-w-[28ch] text-sm">{t('ui.popover_text')}</p>
          </PopoverBox>
          <TooltipTip text={t('ui.tooltip_text')}>
            <button type="button" className="btn btn-ghost">
              {t('ui.tooltip')}
            </button>
          </TooltipTip>
        </div>
      </Block>

      <Block title={t('ui.disclosure')}>
        <div className="grid gap-6 md:grid-cols-2">
          <TabsBox
            tabs={[
              { id: 'a', label: t('ui.tab1'), content: <p>{t('ui.tab1_text')}</p> },
              { id: 'b', label: t('ui.tab2'), content: <p>{t('ui.tab2_text')}</p> },
            ]}
          />
          <AccordionBox
            items={[
              { id: '1', title: t('ui.acc1'), body: t('ui.acc1_text') },
              { id: '2', title: t('ui.acc2'), body: t('ui.acc2_text') },
            ]}
          />
        </div>
      </Block>

      <Block title={t('ui.feedback')}>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() =>
              toastManager.add({ title: t('ui.toast_text'), data: { tone: 'success' } })
            }
          >
            {t('ui.toast_btn')}
          </Button>
          <Badge tone="success">{t('ui.state_success')}</Badge>
          <Badge tone="warning">{t('ui.state_warning')}</Badge>
          <Badge tone="danger">{t('ui.state_danger')}</Badge>
          <Badge tone="info">{t('ui.state_info')}</Badge>
          <Avatar initials="EE" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-xl">{t('ui.card_title')}</h3>
            <p className="text-ink-muted">{t('ui.card_text')}</p>
          </Card>
          <EmptyState
            title={t('ui.empty_title')}
            text={t('ui.empty_text')}
            art={<Illustration />}
          />
        </div>
      </Block>
    </div>
  )
}
