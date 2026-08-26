// De Engelse kant van elke zin die in de app op het scherm komt.
//
// De sleutel is de Nederlandse zin, letterlijk — inclusief hoofdletters en leestekens.
// Staat een zin hier niet, dan blijft het Nederlands staan; dat is een zichtbaar gat en
// geen stille fout.
//
// Plaatshouders van de vorm `{naam}` horen aan beide kanten voor te komen. In het Engels
// mogen ze in een andere volgorde staan — daarvoor zijn het plaatshouders en geen stukken
// tekst die aan elkaar geplakt worden.
//
// Wat hier NIET in staat, met opzet: alles wat de club zelf schrijft. Het lessenboekje
// (lib/trainings-u9), de titels en beschrijvingen van lesmateriaal, notities, doelen, de
// namen van banen en spelers, en de tags die uit die teksten gehaald worden. Dat is inhoud
// van de trainer, geen tekst van de app; die vertaalt niemand mee.

export const EN: Record<string, string> = {
  // --- losse woorden en knoppen ------------------------------------------
  'Agenda': 'Schedule',
  'Spelers': 'Players',
  'Trainers': 'Coaches',
  'Trainer': 'Coach',
  'Beheer': 'Admin',
  'Home': 'Home',
  'Profiel': 'Profile',
  'Speler': 'Player',
  'Coach': 'Coach',
  'Ouder': 'Parent',
  'Rol': 'Role',
  'Naam': 'Name',
  'E-mailadres': 'Email address',
  'Wachtwoord': 'Password',
  'Gsm': 'Mobile',
  'Telefoonnummer': 'Phone number',
  'Contact': 'Contact',
  'Instellingen': 'Settings',
  'Taal': 'Language',
  'Licht': 'Light',
  'Donker': 'Dark',
  'Opslaan': 'Save',
  'Bewaren': 'Save',
  'Annuleren': 'Cancel',
  'Sluiten': 'Close',
  'Terug': 'Back',
  'Verwijderen': 'Delete',
  'Bewerken': 'Edit',
  'Aanpassen': 'Edit',
  'Toevoegen': 'Add',
  'Toewijzen': 'Assign',
  'Klaar': 'Done',
  'Nee': 'No',
  'Geen': 'None',
  'Vandaag': 'Today',
  'Van': 'From',
  'Tot': 'To',
  'tot': 'up to',
  'Vorige': 'Previous',
  'Volgende': 'Next',
  'Wissen': 'Clear',
  'Zoeken': 'Search',
  'Wis filters': 'Clear filters',
  'Filters wissen': 'Clear filters',
  'Zoekterm wissen': 'Clear search term',
  'Exporteren': 'Export',
  'Vernieuwen': 'Refresh',
  'Uitloggen': 'Log out',
  'Inloggen': 'Log in',
  'Reserveren': 'Book',
  'Overzicht': 'Overview',
  'Historiek': 'History',
  'Nog te komen': 'Upcoming',
  'Weekagenda': 'Week schedule',
  // Beheer → Clubkalender: de dagen waarop de club geen les geeft (app/admin/vakanties).
  'Clubkalender': 'Club calendar',
  'Nog geen vakanties ingevuld': 'No holidays entered yet',
  '1 periode zonder les': '1 period without lessons',
  '{n} periodes zonder les': '{n} periods without lessons',
  'Op deze dagen geeft de club geen les. Een herhalende reeks stapt eroverheen, Reserveren biedt er geen uren aan en de weekagenda toont ze als gesloten. Lessen die er al staan blijven staan.':
    'On these days the club gives no lessons. A repeating series steps over them, Book '
    + 'offers no hours on them and the week schedule shows them as closed. Lessons already '
    + 'there stay.',
  'bv. Herfstvakantie': 'e.g. Autumn break',
  'leeg = dezelfde dag': 'empty = the same day',
  'Nog geen vakanties. Zolang deze lijst leeg is, rekent de app met les het hele jaar door.':
    'No holidays yet. While this list is empty, the app assumes lessons all year round.',
  'Geef de vakantie een naam.': 'Give the holiday a name.',
  'Vul beide dagen in als dd/mm/jjjj.': 'Fill in both days as dd/mm/yyyy.',
  '1 dag': '1 day',
  '{n} dagen': '{n} days',
  'Weg': 'Remove',
  'Voorbeeld: {voorbeeld}': 'Example: {voorbeeld}',
  '{dag}, {vakantie} — geen les': '{dag}, {vakantie} — no lessons',
  '{vakantie}: de club geeft deze dag geen les.':
    '{vakantie}: the club gives no lessons on this day.',
  '{lessen} vallen in een vakantie en gaan niet door: {dagen}.':
    '{lessen} fall in a holiday and will not happen: {dagen}.',
  '{lessen} overgeslagen, de trainer was dan al bezet.':
    '{lessen} skipped, the coach was already busy then.',
  '{lessen} vielen in een vakantie.': '{lessen} fell in a holiday.',
  // Beheer → Leden en het bewerkblad erachter (app/admin/leden, components/LidBewerken).
  'Leden': 'Members',
  'Gegevens, type account en beheerders': 'Details, account type and administrators',
  'Dit scherm is voor een beheerder. Vraag er een om je het vinkje te geven.':
    'This screen is for an administrator. Ask one to give you the flag.',
  'Zoek op naam of e-mailadres': 'Search by name or email address',
  '1 lid': '1 member',
  '{n} leden': '{n} members',
  'Geen lid gevonden.': 'No member found.',
  'Beheerder': 'Administrator',
  'Een naam is verplicht.': 'A name is required.',
  'Hiermee logt hij in. Verander je het, dan hoort hij het te weten.':
    'This is how they log in. Change it and they need to know.',
  'Gsm-nummer': 'Mobile number',
  'Leeg is geen sponsorcontract. Wat er nog van over is, rekent de app uit de gesponsorde lessen.':
    'Empty means no sponsorship. What is left of it, the app works out from the sponsored '
    + 'lessons.',
  'Hiermee staat een nieuwe les van deze speler alvast klaar; je kunt het per les nog wijzigen.':
    'A new lesson for this player starts on this; you can still change it per lesson.',
  'Bewaard': 'Saved',
  'Type account': 'Account type',
  'Een trainer heeft een eigen agenda en spelers; een speler niet. Zijn lessen, dossier en betalingen blijven hoe dan ook staan.':
    'A coach has their own schedule and players; a player does not. Their lessons, file and '
    + 'payments stay either way.',
  '{naam} geeft nog {n} lessen. Verzet of schrap die eerst; daarna kan hij speler worden.':
    '{naam} still teaches {n} lessons. Move or drop those first; after that they can become '
    + 'a player.',
  'Is beheerder': 'Is administrator',
  'Beheerder maken': 'Make administrator',
  'Dit is de enige beheerder. Maak eerst iemand anders beheerder; anders komt niemand er nog bij.':
    'This is the only administrator. Make someone else one first, or nobody gets back in.',
  'Een beheerder mag in elke agenda werken, ziet de cijfers van de club en kan hier andere beheerders aanwijzen.':
    'An administrator works in every schedule, sees the club figures and can appoint other '
    + 'administrators here.',
  'Dit ben jij: neem je het weg, dan verlies je zelf dit scherm.':
    'This is you: take it away and you lose this screen yourself.',
  'Lid verwijderen': 'Delete member',
  'Je eigen account verwijder je hier niet.': 'You do not delete your own account here.',
  '{naam} verwijderen. Weg is weg.': 'Delete {naam}. Gone is gone.',
  'Dit gaat mee: {dingen}.': 'This goes with them: {dingen}.',
  'Er hangt verder niets aan hem.': 'Nothing else is attached to them.',
  '1 verslag': '1 report',
  '{n} verslagen': '{n} reports',
  '1 beurtenkaart': '1 punch card',
  '{n} beurtenkaarten': '{n} punch cards',
  '1 memo': '1 memo',
  '{n} memo’s': '{n} memos',
  '1 stuk lesmateriaal': '1 piece of lesson material',
  '{n} stukken lesmateriaal': '{n} pieces of lesson material',
  '1 koppeling met een ouder of kind': '1 link with a parent or child',
  '{n} koppelingen met ouders of kinderen': '{n} links with parents or children',
  'Agenda-bestand (.ics)': 'Calendar file (.ics)',
  // De zinnen die in het agendabestand zelf terechtkomen — zie lib/ics.
  'Tennislessen': 'Tennis lessons',
  'Tennis {locatie}': 'Tennis {locatie}',
  'Tennis': 'Tennis',
  'Het bestand bevat precies de lessen die je hier ziet, klaar om in Outlook, Google Agenda of Apple Agenda te openen. Exporteer je later opnieuw, dan werkt je agenda dezelfde afspraken bij in plaats van ze een tweede keer toe te voegen.':
    'The file holds exactly the lessons you see here, ready to open in Outlook, Google '
    + 'Calendar or Apple Calendar. Export again later and your calendar updates the same '
    + 'appointments instead of adding them a second time.',
  'Een les die na je export geannuleerd wordt, verdwijnt niet vanzelf uit je agenda — die haal je daar zelf weg.':
    'A lesson cancelled after your export does not disappear from your calendar on its '
    + 'own — remove that one yourself.',
  'Deze week': 'This week',
  'Geen lessen deze week.': 'No lessons this week.',
  'Les van {dag} {tijd} met {ander}, details openen':
    'Lesson on {dag} {tijd} with {ander}, open details',
  // De eenheid staat los van het getal, zodat de komma van 12,5 uit de taal komt en de
  // "u" er niet aan vastgeplakt zit — zie formatUren in lib/week.
  '{uren} u': '{uren} h',
  '{uren} geboekt': '{uren} booked',
  '{uren} geboekt deze week': '{uren} booked this week',
  'Geannuleerde lessen tellen niet mee en staan er niet tussen.':
    'Cancelled lessons are neither counted nor listed.',
  'Aankomend': 'Upcoming',
  'Geweest': 'Past',
  'Te doen': 'To do',
  'Gegeven': 'Given',
  'Losse notities': 'Loose notes',
  'Goedkeuren': 'Approve',
  'Weigeren': 'Decline',
  'Aanvragen': 'Request',
  'Bevestigen': 'Confirm',
  'Datum': 'Date',
  'Tijdstip': 'Time',
  'Tijdslot': 'Time slot',
  'Terrein': 'Court',
  'Baan': 'Court',
  'Banen': 'Courts',
  'Binnen': 'Indoor',
  'Buiten': 'Outdoor',
  'Titel': 'Title',
  'Beschrijving': 'Description',
  'Omschrijving': 'Description',
  'Notitie': 'Note',
  'Notities': 'Notes',
  'Opmerking': 'Remark',
  'Opmerkingen': 'Remarks',
  'Huiswerk': 'Homework',
  'Spraakmemo': 'Voice memo',
  'Beoordeling': 'Rating',
  'Samenvatting': 'Summary',
  'Aantal sessies': 'Number of sessions',
  'Gemiddelde beoordeling': 'Average rating',
  'Voortgang': 'Progress',
  'Doelen': 'Goals',
  'Lessen': 'Lessons',
  'Les': 'Lesson',
  'les': 'lesson',
  'lessen': 'lessons',
  'oefening': 'exercise',
  'oefeningen': 'exercises',
  'training': 'training',
  'trainingen': 'trainings',
  'Oefening': 'Exercise',
  'Oefeningen': 'Exercises',
  'Trainingen': 'Trainings',
  'Databank': 'Database',
  'Keymoments': 'Key moments',
  'Forehand': 'Forehand',
  'De ijkpunten van een slag in beeld': 'The reference points of a stroke, in pictures',
  '{n} keymoments': '{n} key moments',
  'Keymoment {n}': 'Key moment {n}',
  'Keymoment {n}, speler {i}': 'Key moment {n}, player {i}',
  'De vaste ijkpunten van een slag, telkens bij twee spelers — zo zie je wat er hetzelfde blijft.':
    'The fixed reference points of a stroke, shown for two players — so you see what stays the same.',
  'Voor deze slag staan er nog geen keymoments klaar.': 'There are no key moments for this stroke yet.',
  'Frame net voor het racket naar achter vertrekt': 'Frame just before the racket starts going back',
  'Laatste frame waar het racket zich op het hoogste punt bevindt': 'Last frame where the racket is at its highest point',
  'Frame waar het racket op maximale afstand van het net is': 'Frame where the racket is farthest from the net',
  'Laatste frame waar het racket zich op het laagste punt bevindt': 'Last frame where the racket is at its lowest point',
  'Frame waar het racket de bal raakt': 'Frame where the racket meets the ball',
  'Frame waar het racket op maximale afstand voorwaarts is': 'Frame where the racket is farthest forward',
  'Frame waar de onderarm evenwijdig is met het net': 'Frame where the forearm is parallel to the net',
  'Frame waar het racket op maximale afstand achter is': 'Frame where the racket is farthest back',
  'Lesmateriaal': 'Lesson material',
  'Tekenveld': 'Drawing board',
  'Gereedschap': 'Tools',
  'Betalingen': 'Payments',
  'Betaalwijze': 'Payment method',
  'Betaald': 'Paid',
  'Betaalt': 'Pays',
  'Openstaand': 'Outstanding',
  'Openstaand saldo': 'Outstanding balance',
  'Openstaande betalingen': 'Outstanding payments',
  'Omzet': 'Revenue',
  'Loon': 'Pay',
  'Trainersloon': 'Coach pay',
  'Rapport': 'Report',
  'Verloop': 'Trend',
  'Per speler': 'Per player',
  'Per trainer': 'Per coach',
  'Per betaalwijze': 'Per payment method',
  'Beurtenkaarten': 'Punch cards',
  'Nieuwe kaart': 'New card',
  'Beurt af': 'Use a punch',
  'Beurt terug': 'Return a punch',
  'Gebruikte beurten': 'Punches used',
  'handmatig': 'manual',
  'Sponsorbudget': 'Sponsor budget',
  'Standaard betaalwijze': 'Default payment method',
  'Administratie': 'Administration',
  'Geld': 'Money',
  'Club': 'Club',
  'Systeem': 'System',
  'Gevarenzone': 'Danger zone',
  'Noodopruiming': 'Emergency reset',
  'Uurtarief': 'Hourly rate',
  'Uurtarief (€)': 'Hourly rate (€)',
  'Uurtarief (optioneel)': 'Hourly rate (optional)',
  'Uurtarief privéles': 'Private lesson rate',
  'Groepstarief': 'Group rate',
  'Stap toevoegen': 'Add a step',
  'per uur': 'per hour',
  'spelers': 'players',
  'Lesdagen': 'Teaching days',
  'Lesuren': 'Teaching hours',
  'Geeft les': 'Teaches',
  'Hele dag': 'All day',
  'De hele dag': 'All day',
  'Elke dag': 'Every day',
  'Mijn gegevens': 'My details',
  'Mijn agenda': 'My schedule',
  'Mijn lessen': 'My lessons',
  'Mijn rapport': 'My report',
  'Factuur': 'Invoice',
  'Samen': 'Together',
  'Apart': 'Separately',
  'apart': 'separately',
  'Herhalen': 'Repeat',
  'Niet herhalen': 'Do not repeat',
  'Wekelijks': 'Weekly',
  'Tweewekelijks': 'Every two weeks',
  'Deze maand': 'This month',
  'Vorige maand': 'Last month',
  'Dit kwartaal': 'This quarter',
  'Dit jaar': 'This year',
  'Eigen periode': 'Custom period',
  'Toon deze periode': 'Show this period',
  'Medespelers': 'Fellow players',
  'Medespelers (optioneel)': 'Fellow players (optional)',
  'Medespeler toevoegen': 'Add a fellow player',
  'Medespelers wijzigen': 'Change fellow players',
  'Type training': 'Training type',
  'Type slag': 'Stroke type',
  'Type wijziging': 'Change type',
  'Wijziging': 'Change',
  'Situatie': 'Situation',
  'Bedoeling': 'Purpose',
  'Kwaliteit': 'Quality',
  'Organisatie / materiaal': 'Organisation / equipment',
  'Duur': 'Duration',
  'Duur (minuten)': 'Duration (minutes)',
  'Aandachtspunten training': 'Training focus points',
  'Materiaal per terrein': 'Equipment per court',
  'Veldsituatie': 'Court drawing',
  'veldsituatie': 'court drawing',
  'Tekenen': 'Draw',
  'Kegel': 'Cone',
  'Racket': 'Racket',
  'Horizontaal': 'Landscape',
  'Verticaal': 'Portrait',
  'Ongedaan': 'Undo',
  'PDF-bijlagen': 'PDF attachments',
  'PDF (optioneel)': 'PDF (optional)',
  'Voor wie': 'For whom',
  'Voor': 'For',
  'Iedereen': 'Everyone',
  'Gekozen': 'Selected',
  'Uit bibliotheek': 'From the library',
  'Nieuwe les': 'New lesson',
  'Opnemen': 'Record',
  'Opnieuw opnemen': 'Record again',
  'Stop': 'Stop',
  'Video openen': 'Open video',
  'Video-URL': 'Video URL',
  'Video-URL (optioneel)': 'Video URL (optional)',
  'Link (optioneel)': 'Link (optional)',
  'Tags (optioneel)': 'Tags (optional)',
  'Beschrijving (optioneel)': 'Description (optional)',
  'Notities (optioneel)': 'Notes (optional)',
  'Gsm-nummer (optioneel)': 'Mobile number (optional)',
  'Koppel aan les (optioneel)': 'Link to a lesson (optional)',
  'Meteen toewijzen (optioneel)': 'Assign right away (optional)',
  'Eén per regel.': 'One per line.',

  // --- titels van schermen en tegels -------------------------------------
  'Nieuwe afspraak': 'New booking',
  'Nieuw lesmateriaal': 'New lesson material',
  'Speler-dossier': 'Player file',
  'Trainer-dossier': 'Coach file',
  'Lesplan & voortgang': 'Lesson plan & progress',
  'Lesdetails': 'Lesson details',
  'Les bewerken': 'Edit lesson',
  'Les boeken': 'Book a lesson',
  'Les toewijzen': 'Assign a lesson',
  'Nieuwe voortgang': 'New progress note',
  'Voortgang bewerken': 'Edit progress note',
  'Voortgang toevoegen': 'Add progress note',
  'Speler toevoegen': 'Add a player',
  'Trainer toevoegen': 'Add a coach',
  'Doel toevoegen': 'Add a goal',
  'Oefening toevoegen': 'Add an exercise',
  'Uitleg toevoegen': 'Add an explanation',
  'Veldsituatie toevoegen': 'Add a court drawing',
  'Veldsituatie aanpassen': 'Edit the court drawing',
  'Veldsituatie verwijderen': 'Delete the court drawing',
  'Bewaren als lesmateriaal': 'Save as lesson material',
  'Aanmaken & toewijzen': 'Create & assign',
  'Hele training openen': 'Open the whole training',
  'Bekijk in de databank': 'View in the database',
  'Open dossier': 'Open file',
  'Rapport per speler': 'Report per player',
  'Waar je mee bezig bent': 'What you are working on',
  'Goed te keuren': 'Awaiting your approval',
  'Wacht op goedkeuring': 'Awaiting approval',
  'Eindtijd reserveringen': 'Booking end time',
  'Uitleg bij de veldsituatie': 'Notes on the court drawing',
  'Woordenlijst voor spelersdoelen': 'Vocabulary for player goals',

  // --- ondertitels van tegels --------------------------------------------
  'Boek je volgende les': 'Book your next lesson',
  'Lesmateriaal van je trainers': 'Lesson material from your coaches',
  'Jouw beoordelingen': 'Your ratings',
  'Historiek en wat er nog komt': 'History and what is still to come',
  'Les inplannen voor een speler': 'Schedule a lesson for a player',
  'Openstaande lessen afhandelen': 'Settle outstanding lessons',
  'Kaarten en resterende beurten': 'Cards and punches left',
  'Omzet en aantallen': 'Revenue and counts',
  'Namen en uurtarieven': 'Names and hourly rates',
  'Nieuw lid aanmaken': 'Create a new member',
  'Boekingstijden, thema en taal': 'Booking times, theme and language',
  'Banen, doelen, beurtenkaarten en leden': 'Courts, goals, punch cards and members',
  'Jouw boekingen per betaalwijze': 'Your bookings per payment method',
  'Jouw uurtarief': 'Your hourly rate',
  'Lessen vandaag': 'Lessons today',
  'Verdiend deze maand': 'Earned this month',
  'Titel, link, PDF of veldsituatie': 'Title, link, PDF or court drawing',
  'Notitie na de les, voor eender welke speler': 'A note after the lesson, for any player',

  // --- lege lijsten en meldingen -----------------------------------------
  'Nog geen spelers.': 'No players yet.',
  'Nog geen banen.': 'No courts yet.',
  'Nog geen gebruikers.': 'No users yet.',
  'Nog geen afspraken.': 'No bookings yet.',
  'Nog geen beurtenkaarten.': 'No punch cards yet.',
  'Nog geen lesmateriaal.': 'No lesson material yet.',
  'Nog geen lessen of notities.': 'No lessons or notes yet.',
  'Nog geen oefeningen.': 'No exercises yet.',
  'Nog geen recente activiteit.': 'No recent activity yet.',
  'Nog geen uitleg.': 'No explanation yet.',
  'Nog geen voortgang.': 'No progress notes yet.',
  'Nog geen voortgang voor deze speler.': 'No progress notes for this player yet.',
  'Nog geen doel afgesproken.': 'No goal agreed yet.',
  'Geen lessen vandaag.': 'No lessons today.',
  'Geen openstaande betalingen.': 'No outstanding payments.',
  'Geen gebruikers gevonden.': 'No users found.',
  'Geen beschrijving.': 'No description.',
  'Geen video-link.': 'No video link.',
  'Geen veldsituatie.': 'No court drawing.',
  'Geen PDF-bijlagen.': 'No PDF attachments.',
  'Geen les gepland': 'No lesson scheduled',
  'Geen speler gekozen (algemeen)': 'No player selected (general)',
  'Er staan geen lessen meer gepland.': 'There are no more lessons scheduled.',
  'Niets gevonden. Probeer een andere tag of zoekterm.': 'Nothing found. Try another tag or search term.',
  'Geen keuze gevonden. Voeg hem toe bij Beheer → Doelen.': 'No option found. Add one under Admin → Goals.',
  'Geen keuzes. Voeg er minstens één toe.': 'No options. Add at least one.',
  'Speler niet gevonden.': 'Player not found.',
  'Trainer niet gevonden.': 'Coach not found.',
  'Niet ingelogd': 'Not logged in',
  'Niet ingevuld': 'Not filled in',
  'Nog niet ingesteld': 'Not set yet',
  'Beheer is alleen voor trainers.': 'Admin is for coaches only.',
  'Alleen een trainer beheert de beurtenkaarten.': 'Only a coach manages the punch cards.',
  'Alleen een trainer kan lesmateriaal toevoegen.': 'Only a coach can add lesson material.',
  'Je trainer heeft nog geen lesmateriaal voor je klaargezet.':
    'Your coach has not put any lesson material together for you yet.',

  // --- login --------------------------------------------------------------
  'Log in om verder te gaan': 'Log in to continue',
  'Kies je profiel om te starten': 'Pick your profile to start',
  'Ik heb al een account': 'I already have an account',
  'Inloggen mislukt.': 'Log in failed.',
  'Voor- en achternaam': 'First and last name',
  'Minstens zes tekens': 'At least six characters',
  'jij@voorbeeld.be': 'you@example.com',
  'naam@club.be': 'name@club.com',
  '0470 12 34 56': '0470 12 34 56',
  'Naar het hoofdscherm': 'To the home screen',
  'Wat wil je doen?': 'What would you like to do?',

  // --- invulhulp ----------------------------------------------------------
  'Typ de naam van de speler…': 'Type the player’s name…',
  'Typ een naam…': 'Type a name…',
  'Naam van een medespeler…': 'Name of a fellow player…',
  'Kies een speler voor het rapport…': 'Pick a player for the report…',
  'Zoek een oefening…': 'Search for an exercise…',
  'Zoek lesmateriaal…': 'Search lesson material…',
  'Voeg een notitie toe…': 'Add a note…',
  'Nog een punt…': 'One more point…',
  'Notities over de training': 'Notes about the training',
  'Huiswerk voor de speler': 'Homework for the player',
  'Beschrijf waar jullie deze les aan gewerkt hebben…': 'Describe what you worked on this lesson…',
  'Wat spreek je af?': 'What do you agree on?',
  'Wat doen de spelers?': 'What do the players do?',
  'Waar let je op?': 'What do you look out for?',
  'Wat oefen je hiermee?': 'What does this practise?',
  'Neem een korte memo op': 'Record a short memo',
  'Bijvoorbeeld 500': 'For example 500',
  'Bijvoorbeeld: betaald op 3 september': 'For example: paid on 3 September',
  'bv. 45': 'e.g. 45',
  'bv. Lob': 'e.g. Lob',
  'bv. Beenwerk': 'e.g. Footwork',
  'bv. Kruisoefening met kegels': 'e.g. Cross drill with cones',
  'Forehand, Backhand…': 'Forehand, Backhand…',
  'Greepwissel, Regelmaat…': 'Grip change, Consistency…',
  'U9, wedstrijdvorm': 'U9, match play',
  'basislijnspel': 'baseline play',
  'AANVALLEN': 'ATTACKING',
  '4 markeerschijven voor de speelbasis': '4 markers in front of the ready position',
  'Drukvol uitwisselen met hoog tempo\nSterk starten vanuit opslag 1':
    'Rally under pressure at high tempo\nStrong start from serve 1',

  // --- toegankelijkheidslabels -------------------------------------------
  'Punt opslaan': 'Save point',
  'Wijziging annuleren': 'Cancel change',
  'PDF uploaden': 'Upload PDF',
  'Start opname': 'Start recording',
  'Stop opname': 'Stop recording',
  'Verwijder opname': 'Delete recording',
  'Begindatum van de periode': 'Start date of the period',
  'Einddatum van de periode': 'End date of the period',
  'Markeer als gegeven': 'Mark as given',
  'Terug naar gepland': 'Back to planned',
  'Alle coaches': 'All coaches',
  'Alle trainers': 'All coaches',
  'alle trainers': 'all coaches',
  'één trainer': 'one coach',
  'deze trainer': 'this coach',
  'de betaler': 'the payer',
  'je collega': 'your colleague',
  'onbekende speler': 'unknown player',
  'Onbekend': 'Unknown',
  'Onbekend terrein': 'Unknown court',
  'Onbekende baan': 'Unknown court',
  'Onbekende speler': 'Unknown player',

  // --- korte samenvattingen ----------------------------------------------
  'geen afspraken': 'no bookings',
  'niets aankomend': 'nothing upcoming',
  'nog geen': 'none yet',
  'nog geen doel': 'no goal yet',
  'niets te doen': 'nothing to do',
  'geen notities': 'no notes',
  'geen lessen': 'no lessons',
  'bezet': 'taken',
  'beschikbaar': 'available',
  'niet beschikbaar': 'unavailable',
  '1 les': '1 lesson',
  '{n} lessen': '{n} lessons',
  '1 speler': '1 player',
  '{n} spelers': '{n} players',
  '1 doel': '1 goal',
  '{n} doelen': '{n} goals',
  '1 notitie': '1 note',
  '{n} notities': '{n} notes',
  '1 geplande les': '1 scheduled lesson',
  '{n} geplande lessen': '{n} scheduled lessons',
  '1 openstaande betaling': '1 outstanding payment',
  '{n} openstaande betalingen': '{n} outstanding payments',
  '1 les nog niet afgerekend': '1 lesson not settled yet',
  '{n} lessen nog niet afgerekend': '{n} lessons not settled yet',
  '{n} aankomend': '{n} upcoming',
  '{n} te doen': '{n} to do',
  '{n} sterren': '{n} stars',
  '{n} oefeningen': '{n} exercises',
  '{n} oefeningen doorzoeken': 'search {n} exercises',
  '{n} stuks lesmateriaal': '{n} pieces of lesson material',
  '{n} geweest in {periode} · ook andere periodes': '{n} past in {periode} · other periods too',
  '{aantal} van {totaal} {soort}': '{aantal} of {totaal} {soort}',
  '{n}e kwartaal {jaar}': 'Q{n} {jaar}',
  'van {naam}': 'by {naam}',
  ' van {datum}': ' of {datum}',
  'Doel {nr}': 'Goal {nr}',
  'doel {nr} — {horizon}': 'goal {nr} — {horizon}',
  'Duur: {duur}': 'Duration: {duur}',
  'Training {nr} · {titel}': 'Training {nr} · {titel}',
  'nog {n}': '{n} left',
  'Volgende les {moment}': 'Next lesson {moment}',
  'Genoteerd door {naam}': 'Noted by {naam}',
  'Voor {naam}': 'For {naam}',
  'Hoi {naam} 👋': 'Hi {naam} 👋',
  'Log in als {naam}': 'Log in as {naam}',
  'Kleur {kleur}': 'Colour {kleur}',
  'rood': 'red',
  'blauw': 'blue',
  'wit': 'white',
  'zwart': 'black',

  // --- doelen en horizonnen ----------------------------------------------
  'Binnen 10 lessen': 'Within 10 lessons',
  'Binnen 20 lessen': 'Within 20 lessons',
  'Einde seizoen': 'End of season',
  '{horizon}: {aantal}, {samenvatting}, doelen openen': '{horizon}: {aantal}, {samenvatting}, open goals',
  '{horizon}: nog geen doel, doelen openen': '{horizon}: no goal yet, open goals',
  'Doel toevoegen — {horizon}': 'Add a goal — {horizon}',
  'Type slag — {wat}': 'Stroke type — {wat}',
  'Type wijziging — {wat}': 'Change type — {wat}',
  'Opmerkingen — {wat}': 'Remarks — {wat}',
  'Verwijder {wat}': 'Delete {wat}',

  // --- weekdagen, status, betaalwijzen -----------------------------------
  'Zo': 'Sun',
  'Ma': 'Mon',
  'Di': 'Tue',
  'Wo': 'Wed',
  'Do': 'Thu',
  'Vr': 'Fri',
  'Za': 'Sat',
  'Bevestigd': 'Confirmed',
  'Geannuleerd': 'Cancelled',
  'Voltooid': 'Completed',
  'Gesynchroniseerd': 'Synchronised',
  'Open': 'Open',
  'Cash': 'Cash',
  'QR-code': 'QR code',
  '10-beurtenkaart': '10-punch card',
  'Sponsor': 'Sponsor',
  'Techniek': 'Technique',
  'Tactiek': 'Tactics',
  'Fysiek': 'Physical',
  'Mentaal': 'Mental',
  'Match': 'Match',
  'datum onbekend': 'date unknown',
  'tijd onbekend': 'time unknown',

  // --- geld ---------------------------------------------------------------
  '€ {bedrag} voor deze les.': '€ {bedrag} for this lesson.',
  '€ {bedrag} voor deze les met {groep}': '€ {bedrag} for this lesson with {groep}',
  '{samen}, op één factuur.': '{samen}, on a single invoice.',
  '{samen}, apart gefactureerd: {ieder}.': '{samen}, invoiced separately: {ieder}.',
  '€ {bedrag} per speler': '€ {bedrag} per player',
  '€ {laag} à € {hoog} per speler': '€ {laag} to € {hoog} per player',
  '€{bedrag} per uur': '€{bedrag} per hour',
  '€ {bedrag} geboekt': '€ {bedrag} booked',
  '€ {bedrag} afgehandeld': '€ {bedrag} settled',
  'Openstaand saldo € {bedrag}': 'Outstanding balance € {bedrag}',
  'Sponsorbudget: nog € {rest} van € {totaal} over.':
    'Sponsor budget: € {rest} of € {totaal} left.',
  'Deze speler heeft geen sponsorbudget.': 'This player has no sponsor budget.',
  'Sponsorbudget van {naam} in euro': 'Sponsor budget of {naam} in euros',

  // --- beurtenkaart -------------------------------------------------------
  'Nog 1 beurt over.': '1 punch left.',
  'Nog {n} beurten over.': '{n} punches left.',
  'Deze speler heeft nog geen beurtenkaart.': 'This player does not have a punch card yet.',
  'Geen beurtenkaart met beurten over voor deze speler.':
    'No punch card with punches left for this player.',
  'Kaart van {n} beurten aanmaken': 'Create a card of {n} punches',
  'Opmerking bij de kaart van {naam}': 'Remark on the card of {naam}',
  '{gebruikt} van {totaal} beurten gebruikt, nog {rest} over':
    '{gebruikt} of {totaal} punches used, {rest} left',
  '{gebruikt} van {totaal} gebruikt · nog {rest} over · aangemaakt {moment}':
    '{gebruikt} of {totaal} used · {rest} left · created {moment}',
  'Kaart verwijderen? {n} les(sen) verliezen hun beurt en komen terug op Open.':
    'Delete the card? {n} lesson(s) lose their punch and go back to Open.',
  'Ja, verwijderen': 'Yes, delete',
  'Handmatig bijstellen raakt alleen beurten zonder les; een beurt van een les komt terug door die les op een andere betaalwijze te zetten.':
    'Adjusting by hand only touches punches without a lesson; a punch from a lesson comes back by '
    + 'switching that lesson to another payment method.',
  'De beurt is teruggegeven op de kaart.': 'The punch has been returned to the card.',
  'Het sponsorbudget komt weer vrij.': 'The sponsor budget is released again.',
  'De betaalwijze staat nu op “Factuur”.': 'The payment method is now “Invoice”.',
  'Een groepsles gaat altijd op factuur.': 'A group lesson always goes on invoice.',
  'Een geannuleerde les krijgt geen betaalwijze.': 'A cancelled lesson gets no payment method.',
  'Dit is weer een privéles. De betaalwijze staat op “Open”, zodat er opnieuw gekozen kan worden — beurtenkaart en sponsor kunnen nu weer.':
    'This is a private lesson again. The payment method is set to “Open” so it can be chosen anew — '
    + 'punch card and sponsor are possible again.',
  '{regel} Een beurtenkaart en het sponsorbudget gelden alleen voor een privéles.':
    '{regel} A punch card and the sponsor budget only apply to a private lesson.',
  '{factuur}. {regel} Een beurtenkaart en het sponsorbudget gelden alleen voor een privéles.':
    '{factuur}. {regel} A punch card and the sponsor budget only apply to a private lesson.',
  'Er gaat een beurt af.': 'One punch will be used.',
  'De les gaat van het sponsorcontract af.': 'The lesson is charged to the sponsor contract.',

  // --- boeken -------------------------------------------------------------
  'Kies eerst een datum.': 'Pick a date first.',
  'Kies eerst een speler om te boeken.': 'Pick a player first to book.',
  'Kies eerst een coach om te boeken.': 'Pick a coach first to book.',
  'De les komt op jouw agenda.': 'The lesson goes on your own schedule.',
  'De les komt op de agenda van {trainer}.': 'The lesson goes on the schedule of {trainer}.',
  '{trainer} geeft geen les op deze dag.': '{trainer} does not teach on this day.',
  '{trainer} geeft les op {dagen}{uren}.': '{trainer} teaches on {dagen}{uren}.',
  '{dag}, {trainer} geeft dan geen les': '{dag}, {trainer} does not teach then',
  'Tijdslot {tijd}, {stand}': 'Time slot {tijd}, {stand}',
  'Het hele bedrag gaat naar {naam}.': 'The full amount goes to {naam}.',
  'Elke speler krijgt zijn eigen deel gefactureerd.': 'Every player is invoiced their own share.',
  'Betaalwijze opnieuw proberen': 'Try the payment method again',
  'De les is geboekt, maar “{gekozen}” ging er niet op: de betaalwijze staat nog op “{open}”. Bevestigen probeert het alsnog — er komt geen tweede les bij. Sluiten mag ook; je kunt de betaalwijze later bij de les zelf zetten.':
    'The lesson is booked, but “{gekozen}” would not apply: the payment method is still “{open}”. '
    + 'Confirming tries again — no second lesson is created. Closing is fine too; you can set the '
    + 'payment method later on the lesson itself.',
  'Je trainer moet deze les nog goedkeuren. Het uur blijft zolang voor je vrijgehouden.':
    'Your coach still has to approve this lesson. The hour is held for you in the meantime.',
  '{naam} vraagt een les': '{naam} is requesting a lesson',
  '{baan} — je trainer moet deze les nog bevestigen.':
    '{baan} — your coach still has to confirm this lesson.',
  'Nieuwe afspraak met {naam}': 'New booking with {naam}',
  'Vul beide datums in als dd/mm/jjjj.': 'Enter both dates as dd/mm/yyyy.',
  'Een reeks gaat tot {n} lessen; wat daarna komt valt erbuiten.':
    'A series runs up to {n} lessons; anything beyond that falls outside it.',
  'Geen enkel moment van deze reeks is nog vrij; er valt niets te boeken.':
    'Not a single slot of this series is free; there is nothing to book.',
  '{lessen} overgeslagen omdat de trainer dan al bezet is: {dagen}.':
    '{lessen} skipped because the coach is already busy then: {dagen}.',
  '{frequentie} tot en met {dag} · {lessen}': '{frequentie} up to and including {dag} · {lessen}',
  'een wekelijkse reeks': 'a weekly series',
  'een tweewekelijkse reeks': 'a fortnightly series',
  'een reeks': 'a series',
  'Onderdeel van {reeks} · {lessen} vanaf deze.': 'Part of {reeks} · {lessen} from this one on.',
  'alleen deze les, of deze en alle volgende ({lessen})?':
    'only this lesson, or this one and all later ones ({lessen})?',
  'dit is de laatste les van de reeks.': 'this is the last lesson of the series.',
  'Verwijderen: deze les gaat uit de agenda. Weg is weg.':
    'Delete: this lesson leaves the schedule. Gone is gone.',
  'Weg is weg.': 'Gone is gone.',
  'Ja, deze les': 'Yes, this lesson',
  'Alleen deze les': 'Only this lesson',
  'Deze en alle volgende ({n})': 'This one and all later ones ({n})',
  'Betaalwijze wijzigen, nu {wijze}': 'Change payment method, currently {wijze}',

  // --- dossiers -----------------------------------------------------------
  'Open dossier van {naam}': 'Open the file of {naam}',
  'Open dossier van trainer {naam}': 'Open the file of coach {naam}',
  '{groep}, {betaler} betaalt': '{groep}, {betaler} pays',
  'Een nieuwe les van {naam} krijgt deze betaalwijze meteen.':
    'A new lesson for {naam} gets this payment method straight away.',
  'Het bedrag uit het sponsorcontract van {naam}. Elke gesponsorde les gaat hier vanaf; is het budget op, dan kan een les niet meer op “Sponsor”. Laat het veld leeg als er geen sponsorcontract is.':
    'The amount from the sponsor contract of {naam}. Every sponsored lesson is deducted from it; '
    + 'once the budget runs out a lesson can no longer be set to “Sponsor”. Leave the field empty '
    + 'if there is no sponsor contract.',
  'Voortgang toevoegen voor {naam}': 'Add a progress note for {naam}',
  'Deze voortgangsnotitie verwijderen? Dat kan niet ongedaan gemaakt worden.':
    'Delete this progress note? That cannot be undone.',
  'Oefening {nr} verwijderen': 'Delete exercise {nr}',
  '{soort}{datum}, openen': '{soort}{datum}, open',
  '“{titel}” is toegevoegd.': '“{titel}” has been added.',
  '"{titel}" verwijderen?': 'Delete "{titel}"?',
  'Bewaren bij "{titel}"': 'Save with "{titel}"',
  'Veldsituatie verwijderen?': 'Delete the court drawing?',
  'Teken met je vinger. Kies een object om het op het veld te zetten.':
    'Draw with your finger. Pick an object to place it on the court.',

  // --- rapport en export ---------------------------------------------------
  'Log in om je rapport te bekijken.': 'Log in to view your report.',
  'Geen lessen in {periode}.': 'No lessons in {periode}.',
  'Lessen in {periode}.': 'Lessons in {periode}.',
  'Geen lessen die geweest zijn in {periode}.': 'No past lessons in {periode}.',
  'Uurtarief nog niet ingesteld': 'Hourly rate not set yet',
  'Uurtarief van {baan}': 'Hourly rate of {baan}',
  'Tot hoeveel spelers, stap {nr} van {baan}': 'Up to how many players, step {nr} of {baan}',
  'Bedrag van stap {nr} van {baan}': 'Amount of step {nr} of {baan}',
  'Stap {nr} van {baan} verwijderen': 'Delete step {nr} of {baan}',
  'Geen staffel: ook een groepsles rekent dan het uurtarief hierboven.':
    'No tiers: a group lesson is then charged the hourly rate above as well.',
  'Omzet per maand.': 'Revenue per month.',
  '{maand} {jaar}: {bedrag} euro uit {lessen}': '{maand} {jaar}: {bedrag} euros from {lessen}',
  ', {van} {vanJaar} tot en met {tot} {totJaar}': ', {van} {vanJaar} up to and including {tot} {totJaar}',
  'Omzet per maand{bereik}. Het verloop kijkt altijd {n} maanden terug, ook als je een kortere periode koos — één maand zegt niets zonder de maanden ervoor.':
    'Revenue per month{bereik}. The trend always looks {n} months back, even if you picked a '
    + 'shorter period — one month says nothing without the months before it.',
  'Op totaal aflopend. Betaald is het geld dat afgesproken is, openstaand zijn de lessen waarvoor nog niets gekozen is. Geannuleerde lessen tellen nergens mee, en een gesponsorde les staat bij betaald: het sponsorcontract is betaald geld.':
    'Sorted by total, descending. Paid is the money that has been agreed; outstanding are the '
    + 'lessons for which nothing has been chosen yet. Cancelled lessons never count, and a '
    + 'sponsored lesson counts as paid: the sponsor contract is money paid.',
  'Op bedrag aflopend. Dit is wat de trainer krijgt: zijn eigen uurtarief naar rato van de duur, ongeacht de betaalwijze — het uur is gegeven. De omzet hierboven loopt op het uurtarief van de baan; het verschil houdt de club over. Geannuleerde lessen tellen nergens mee.':
    'Sorted by amount, descending. This is what the coach receives: their own hourly rate pro rata '
    + 'to the duration, regardless of the payment method — the hour was taught. The revenue above '
    + 'runs on the court’s hourly rate; the club keeps the difference. Cancelled lessons never count.',
  'Geannuleerde lessen tellen in geen van beide bedragen mee. “Afgehandeld” is hetzelfde bedrag als de omzet in Beheer → Rapport.':
    'Cancelled lessons count towards neither amount. “Settled” is the same amount as the revenue '
    + 'under Admin → Report.',
  'Dit zijn de bedragen van de hele club.': 'These are the amounts for the whole club.',
  'Dit zijn de bedragen van {trainer}.': 'These are the amounts for {trainer}.',
  'Het bestand bevat precies de lessen die je hier ziet: {periode}, {trainer}.':
    'The file contains exactly the lessons you see here: {periode}, {trainer}.',
  'Exporteren is niet gelukt. Probeer het opnieuw.': 'Export failed. Please try again.',
  'Elk bedrag is het totaal voor de hele les, niet per speler: "tot 4 spelers € 45" betekent dat een les met vier spelers samen € 45 per uur kost. Een groepsles gaat altijd op factuur — een beurtenkaart en het sponsorbudget gelden alleen voor een privéles. Deze tarieven bepalen de omzetberekening.':
    'Every amount is the total for the whole lesson, not per player: "up to 4 players € 45" means '
    + 'a lesson with four players costs € 45 per hour together. A group lesson always goes on '
    + 'invoice — a punch card and the sponsor budget only apply to a private lesson. These rates '
    + 'drive the revenue calculation.',

  // --- CSV-kolommen --------------------------------------------------------
  'Uur': 'Time',
  'Facturatie': 'Invoicing',
  'Duur (min)': 'Duration (min)',
  'Prijs les (EUR)': 'Lesson price (EUR)',
  'Loon trainer (EUR)': 'Coach pay (EUR)',
  'Status': 'Status',

  // --- instellingen en beheer ---------------------------------------------
  'Tot welk uur kunnen reserveringen worden gemaakt.': 'Up to what time bookings can be made.',
  'Zet alle gegevens terug naar de begininstellingen en logt je uit. Gebruik dit alleen als de app niet meer normaal werkt.':
    'Resets all data to the initial settings and logs you out. Only use this if the app no longer '
    + 'works normally.',
  'Weet je het zeker? Dit zet alle gegevens terug naar de begininstellingen en je wordt uitgelogd.':
    'Are you sure? This resets all data to the initial settings and logs you out.',
  'Dit lijkt geen geldig e-mailadres.': 'This does not look like a valid email address.',
  'Wordt afgeleid van de naam. Zelf iets invullen mag: dan blijft dat staan.':
    'Derived from the name. You may type your own: that will then be kept.',
  'Alleen ter informatie — de omzet loopt op het baantarief.':
    'For information only — revenue runs on the court rate.',
  'Vul een getal in, of laat leeg.': 'Enter a number, or leave it empty.',
  'Nieuwe keuze voor {lijst}': 'New option for {lijst}',
  'Toevoegen aan {lijst}': 'Add to {lijst}',
  '{keuze} verwijderen uit {lijst}': 'Delete {keuze} from {lijst}',
  'Je uurtarief is nog niet ingesteld, dus je verdiensten blijven op €0,00 staan.':
    'Your hourly rate is not set yet, so your earnings stay at €0.00.',
  'Zolang het uurtarief leeg is, blijft dit op €0,00 staan.':
    'As long as the hourly rate is empty, this stays at €0.00.',
  'Alleen PDF-bestanden kunnen worden geüpload.': 'Only PDF files can be uploaded.',
  'Microfoon niet beschikbaar of geweigerd.': 'Microphone unavailable or denied.',
  'Spraakopname — binnenkort (mobiele app)': 'Voice recording — coming soon (mobile app)',
  'Materiaal maken of terugvinden — de databank doorzoekt elke oefening op tags.':
    'Create or find material — the database searches every exercise by tag.',

  // --- de tellingen onder de tegels op het hoofdscherm ---------------------
  // Deze woorden komen niet als `t('…')` in de code voor maar worden aan de hulpfunctie
  // `plural` doorgegeven, die ze vertaalt. Ze staan hier dus los bij.
  'vandaag': 'today',
  'actief': 'active',
  'trainer': 'coach',
  'trainers': 'coaches',
  'openstaand': 'outstanding',
  'les goed te keuren': 'lesson to approve',
  'lessen goed te keuren': 'lessons to approve',
  'wacht op goedkeuring': 'awaiting approval',
  'wachten op goedkeuring': 'awaiting approval',
  'Max {maat} per bestand.': 'Max {maat} per file.',
  'PDF uploaden — binnenkort (mobiele app)': 'Upload PDF — coming soon (mobile app)',
  'Deze keuzes staan in de comboboxen bij het doel van een speler.':
    'These options appear in the dropdowns on a player’s goal.',
  // De spelerslijst: drie stapels en een zoekregel.
  'Alle spelers': 'All players',
  'Mijn spelers': 'My players',
  'Spelers vandaag': 'Players today',
  'geen spelers': 'no players',
  'Je gaf nog aan niemand les.': 'You have not taught anyone yet.',
  'Je hebt vandaag geen spelers op de baan.': 'You have no players on court today.',
  'Zoek een speler': 'Search for a player',
  'Zoek een speler op naam of e-mail': 'Search a player by name or email',
  'Zoekregel wissen': 'Clear search',
  'Geen speler gevonden voor "{q}".': 'No player found for “{q}”.',

  // --- leden importeren ---------------------------------------------------
  'Leden importeren': 'Import members',
  'Uit een Excel-lijst': 'From an Excel list',
  'Sla je Excel-lijst op als CSV en kies hem hier. Kolommen: naam, email, rol, telefoon, uurtarief. Alleen naam en email zijn verplicht.':
    'Save your Excel list as CSV and pick it here. Columns: naam, email, rol, telefoon, uurtarief. Only naam and email are required.',
  'Voorbeeldbestand downloaden': 'Download a sample file',
  'Bestand kiezen': 'Choose a file',
  'Plak hier de kolommen uit Excel': 'Paste the columns from Excel here',
  'Nakijken': 'Check',
  'Bezig met importeren…': 'Importing…',
  'Lid {klaar} van {totaal}.': 'Member {klaar} of {totaal}.',
  'Dit kan even duren. Blijf op dit scherm tot het klaar is.':
    'This can take a while. Stay on this screen until it is done.',
  'Dit bestand kan niet gebruikt worden': 'This file cannot be used',
  'Dit gaat er gebeuren': 'This is what will happen',
  'Resultaat': 'Result',
  '{nieuw} nieuw, {bijgewerkt} bijgewerkt': '{nieuw} new, {bijgewerkt} updated',
  '1 fout': '1 error',
  '{n} fouten': '{n} errors',
  'Nieuw lid: {naam} — {email}': 'New member: {naam} — {email}',
  // 'Bijgewerkt: {naam} — {velden}' vult `{velden}` met vertaalde veldnamen als 'Naam',
  // 'Telefoonnummer' en 'Uurtarief' (zie `VELD_NAMEN` in lib/import-leden.ts) — die drie
  // staan al hierboven bij de losse woorden, dus hoeven hier niet nog eens.
  'Bijgewerkt: {naam} — {velden}': 'Updated: {naam} — {velden}',
  'Deze regels worden overgeslagen': 'These rows are skipped',
  'Deze regels zijn overgeslagen': 'These rows were skipped',
  'Kijk deze regels even na': 'Have a look at these rows',
  '{aantal} om na te kijken': '{aantal} to check',
  'Er staat al een lid met deze naam; kijk even of dit niet dezelfde persoon is.':
    'There is already a member with this name; check whether this is the same person.',
  'Een uurtarief hoort bij een trainer; voor een speler laat ik het weg.':
    'An hourly rate belongs to a coach; for a player it is left out.',
  'Er staan twee leden met dit adres in de club; los dat eerst op in Beheer.':
    'Two members in the club share this address; sort that out in Admin first.',
  'Deze kolommen herken ik niet en komen niet mee: {koppen}':
    "I don't recognise these columns, so they are left out: {koppen}",
  'Deze kolommen staan er twee keer; ik lees alleen de eerste: {koppen}':
    'These columns appear twice; only the first one is read: {koppen}',
  'Regel {regel}': 'Row {regel}',
  'Importeren': 'Import',
  'Ander bestand': 'Another file',
  'Nieuwe import': 'New import',
  'Opnieuw proberen': 'Try again',
  '{toegevoegd} toegevoegd en {bijgewerkt} bijgewerkt.':
    '{toegevoegd} added and {bijgewerkt} updated.',
  '{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt.':
    '{toegevoegd} added, {bijgewerkt} updated, {mislukt} failed.',
  '{toegevoegd} toegevoegd, {bijgewerkt} bijgewerkt, {mislukt} mislukt. Wie er al staat, komt er niet dubbel bij als je het opnieuw probeert.':
    '{toegevoegd} added, {bijgewerkt} updated, {mislukt} failed. Nobody already there gets added '
    + 'twice if you try again.',

  // --- redenen waarom een regel wordt overgeslagen -------------------------
  'Dit bestand is leeg.': 'This file is empty.',
  'De kopregel mist de kolom "naam" of "email".':
    'The header row is missing the "naam" or "email" column.',
  'Geen naam ingevuld.': 'No name filled in.',
  'Geen e-mailadres ingevuld.': 'No email address filled in.',
  'Dit is geen geldig e-mailadres.': 'This is not a valid email address.',
  'Staat al in de club met een andere rol; dat wijzig je in Beheer.':
    'Already in the club with a different role; change that in Admin.',
  'Dit adres staat eerder in het bestand, op regel {vorigeRegel}.':
    'This address appears earlier in the file, on row {vorigeRegel}.',
  'Onbekende rol "{rol}". Kies speler of trainer.':
    'Unknown role "{rol}". Choose player, coach or parent.',
  'Het uurtarief "{tarief}" is geen geldig bedrag.':
    'The hourly rate "{tarief}" is not a valid amount.',

  // --- eerste keer inloggen -----------------------------------------------
  'Wachtwoord instellen': 'Set password',
  'Wachtwoord nog eens': 'Password again',
  'Dezelfde als hierboven': 'The same as above',
  'Bijna klaar. Bevestig eerst de mail die we net gestuurd hebben.':
    'Almost there. Confirm the email we just sent you first.',
  'Er bestaat al een wachtwoord voor dit adres. Log gewoon in.':
    'This address already has a password. Just log in.',
  'Kies een wachtwoord van minstens zes tekens.': 'Choose a password of at least six characters.',
  'De twee wachtwoorden zijn niet gelijk.': 'The two passwords are not the same.',

  // --- wachtwoord vergeten -------------------------------------------------
  'Wachtwoord vergeten?': 'Forgot your password?',
  'Herstelmail sturen': 'Send recovery email',
  'Als dit adres bij de club bekend is, staat er zo een mail in je mailbox.':
    'If this address is known at the club, an email will be in your inbox shortly.',
  'Versturen is mislukt.': 'Sending failed.',
  'Nieuw wachtwoord': 'New password',
  'Kies een nieuw wachtwoord': 'Choose a new password',
  'Je bent binnen via de link uit je mail. Kies hier je nieuwe wachtwoord.':
    'You are in via the link from your email. Choose your new password here.',
  'Wachtwoord opslaan': 'Save password',
  'Bezig…': 'Working…',
  'Het wachtwoord instellen is mislukt.': 'Setting the password failed.',
  'Terug naar inloggen': 'Back to log in',

  // --- meldingen van Supabase, vertaald in `loginMessage` (providers/supabaseStore.ts) ------
  'E-mailadres of wachtwoord klopt niet.': 'Email address or password is incorrect.',
  'Je account is nog niet bevestigd. Kijk in je mailbox.':
    'Your account has not been confirmed yet. Check your mailbox.',

  // --- de foutmelding van de lokale opslag; onbereikbaar zolang er geen wachtwoordknop
  // bestaat zonder Supabase erachter, maar een zin die bestaat om gelezen te worden hoort
  // ook vertaald te zijn (providers/backend.ts) --------------------------------------------
  'Wachtwoorden bestaan alleen met een databank.': 'Passwords only exist with a database.',
  // De lesdag en de spraakmemo.
  'Opnemen kan hier niet.': 'Recording is not possible here.',
  'Opnemen kan hier niet': 'Recording not possible here',
  'Memo opnemen voor {naam}': 'Record a memo for {naam}',
  'nog {n}s': '{n}s left',
  'te kort': 'too short',
  'niet bewaard — opnieuw': 'not saved — retry',
  'Nog niet bewaard — opnieuw proberen': 'Not saved yet — try again',
  'Vandaag geen lessen.': 'No lessons today.',
  '1 memo uit te werken': '1 memo to write up',
  '{n} memos uit te werken': '{n} memos to write up',
  'Nog uit te werken': 'To write up',
  'Niets meer uit te werken. Netjes.': 'Nothing left to write up. Well done.',
  'Uitwerken': 'Write up',
  'Memo weggooien': 'Discard memo',
  'Weggooien? De opname is niet terug te halen.': 'Discard? The recording cannot be recovered.',
  'Weggooien': 'Discard',
  // Rechten.
  'beheerder': 'admin',
  // Het inlogscherm: één weg voor een nieuwe login.
  'Nieuwe login': 'New login',
  'Naam (mag leeg)': 'Name (optional)',
  'Staat je naam al in de ledenlijst, dan blijft die gewoon staan.':
    'If your name is already on the member list, it stays as it is.',
  // Bladeren door de openstaande betalingen.
  '{n} van {totaal}': '{n} of {totaal}',
  'Vorige betaling': 'Previous payment',
  'Volgende betaling': 'Next payment',
  // Wat er met een lesaanvraag gebeurde.
  'Je aanvraag is geweigerd': 'Your request was declined',
  'Vraag gerust een ander uur aan.': 'Feel free to request another time.',
  'In de agenda van {trainer}': 'In {trainer}\u2019s calendar',
  'Bericht wegklikken': 'Dismiss message',
  'Geweigerde aanvragen wissen': 'Clear declined requests',
  // De lengte van een reeks: een aantal in plaats van een einddatum.
  'Hoeveel lessen?': 'How many lessons?',
  '{n}×': '{n}×',
  'aantal': 'number',
  'Aantal lessen in de reeks': 'Number of lessons in the series',
  'Vul een aantal in van 2 tot {max}.': 'Enter a number from 2 to {max}.',
  'Laatste les op {dag}.': 'Last lesson on {dag}.',
  'Tot en met': 'Up to and including',
  'dd/mm/jjjj': 'dd/mm/yyyy',

  // Ouder en kind. Een ouder heeft zelf geen lessen; de app gaat over het kind dat hij koos.
  'Kind': 'Child',
  'Mijn kinderen': 'My children',
  'Ouders en kinderen': 'Parents and children',
  'Kind toevoegen': 'Add child',
  'Nog geen kind gekoppeld': 'No child linked yet',
  'Vraag je kind aan je profiel toe te voegen. Zodra een trainer het goedkeurt, zie je hier zijn lessen, zijn saldo en zijn voortgang.':
    'Ask for your child to be added to your profile. Once a coach approves it, you will see their lessons, their balance and their progress here.',
  'Zoek je kind op naam. Een trainer keurt de koppeling goed; daarna kun je bovenaan wisselen tussen jezelf en je kind.':
    'Find your child by name. A coach approves the link; after that you can switch between yourself and your child at the top.',
  'Typ de naam van je kind\u2026': "Type your child's name\u2026",
  'Gekoppeld': 'Linked',
  'Aangevraagd': 'Requested',
  'Goedgekeurd': 'Approved',
  'Niet goedgekeurd': 'Not approved',
  'Intrekken': 'Withdraw',
  'Weghalen': 'Remove',
  'Losmaken': 'Unlink',
  'Vraag het na bij de trainer als dit niet klopt.': 'Ask your coach if this is not right.',
  'Je hebt nog geen kind gekoppeld.': 'You have not linked a child yet.',
  'Er wacht geen aanvraag.': 'No request is waiting.',
  'Nog geen ouder aan een kind gekoppeld.': 'No parent linked to a child yet.',
  'Koppelingen nakijken': 'Review links',
  '{n} wacht op goedkeuring': '{n} awaiting approval',
  '{ouder} vraagt {kind} te mogen volgen.': '{ouder} is asking to follow {kind}.',
  'Gevraagd op {dag}': 'Requested on {dag}',
  'Na goedkeuring ziet deze persoon de lessen, het saldo en de voortgang van dit kind.':
    'Once approved, this person sees this child\u2019s lessons, balance and progress.',
  'Ouder: {naam}': 'Parent: {naam}',
  'kind': 'child',
  'kinderen': 'children',
  // Geld dat van jou is en niet van de club.
  'Mijn loon': 'My pay',
  'Alleen een beheerder kan een uurtarief zetten; ik laat het weg.':
    'Only an administrator can set an hourly rate; I am leaving it out.',
  // De kiezer bovenaan bij een ouder: hijzelf of een van zijn kinderen. 'Voor wie' staat al
  // hierboven, bij het boeken — dezelfde vraag, dus dezelfde vertaling.
  'Ikzelf': 'Myself',
  // Ouder is geen rol meer; deze twee zinnen gaan over de aanvraag zelf.
  'Ouder is geen rol meer; ik zet deze persoon als speler. Zijn kinderen koppelt hij daarna zelf.':
    'Parent is no longer a role; I am adding this person as a player. '
    + 'They can link their children themselves afterwards.',
  // De handleiding. Alleen de knoppen eromheen: de gids zelf staat in lib/handleiding en
  // gaat door t() heen, dus wie de app in het Engels zet en de gids wil vertalen, vult die
  // zinnen hier aan.
  'Handleiding': 'Manual',
  'Voor trainers en voor spelers': 'For coaches and for players',
  'Voor trainers': 'For coaches',
  'Voor spelers': 'For players',
  'Kopieer als tekst': 'Copy as text',
  'De hele gids staat op je klembord. Plak hem in een mail.':
    'The whole guide is on your clipboard. Paste it into an email.',
  'De gids is klaargezet om te delen.': 'The guide is ready to share.',
  'Kopiëren lukte niet. Selecteer de tekst hieronder en kopieer hem zelf.':
    'Copying failed. Select the text below and copy it yourself.',
};
