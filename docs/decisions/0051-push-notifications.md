# 0051 — Les notifications push : pas maintenant
**Status:** Accepted (« pas maintenant ») · 2026-10-26 (Joël)
**Context:** Phase 05 proposait des notifications push (Web Push + VAPID) pour que les rappels soient vus : le dimanche, l'inscription de demain, une annonce de groupe, la semaine de préparation de la Sainte-Cène.
**Pour :** des rappels réellement vus ; gratuit (pas de service tiers) ; marche sur Android et sur iOS pour une PWA installée.
**Contre :** une surface de consentement et de réglages de plus ; des clés (VAPID) à garder ; chaque envoi coûte du temps de calcul (chiffrement de la charge par abonné) sur le plan gratuit des Workers, **non mesuré** ; la fatigue des notifications ; et impossible à valider sans un vrai téléphone Android et une PWA installée sur iPhone.
**Decision:** **Pas maintenant.** Les notifications dans le site (0044, 0046), le compteur rouge sur l'avatar et le rappel de la semaine de préparation couvrent le besoin. On n'ajoute ni abonnement ni clé.
**Ce qu'il faudrait avant de reprendre :** un téléphone Android et un iPhone pour tester ; une mesure du temps de calcul d'un envoi à 100 puis 500 abonnés ; des clés VAPID dans les secrets ; un envoi piloté par une tâche planifiée (les rappels sont calculés à la lecture aujourd'hui) avec un budget par jour et des heures calmes (21 h–7 h, heure de Douala) ; consentement séparé, par type, depuis Mon espace, jamais une demande à l'ouverture de la page ; charge sans donnée personnelle au-delà d'un titre court.
**Consequences:** rien à construire ; ajouté aux suggestions de la phase 06.
