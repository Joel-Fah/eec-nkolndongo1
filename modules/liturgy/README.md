# Module `liturgy` — Liturgie

**Purpose.** « Ce dimanche » (name suggested from the season, theme, readings, hymns, notes), the liturgical year's
season texts, and the verse of the day (translations we may quote: LSG 1910, WEB — decision 0032).

**Data kept.** `liturgy_sundays` (including preacher and liturgist **display names**, public only when the consent box is
ticked; who confirmed and when are recorded), `liturgy_seasons` (approved before public), `liturgy_verses`.
Names are never copied to another week.

**Public exposure.** `/api/liturgy/public/{sunday,sundays,seasons,verse}` (cached); pages `/fr/agenda/ce-dimanche`,
the dial on `/fr/agenda/annee-liturgique`, the home card and verse.

**Rights.** `liturgy:read`, `liturgy:edit`, `liturgy:publish`, `liturgy:validate`.

**Retention.** Kept until deleted by an authorised person.
