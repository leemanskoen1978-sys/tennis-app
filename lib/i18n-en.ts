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
  // --- wie de les werkelijk gaf ------------------------------------------
  'Vervanger': 'Stand-in',
  'Wie gaf deze les?': 'Who gave this lesson?',
  'Gaf hem zelf': 'Gave it himself',
  'vervangen': 'stand-in',
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
  // Beheer → Kalender: de gesloten dagen van de club én de uren per trainer, op één scherm
  // (app/admin/kalender). 'Clubkalender' en 'Boekingstijden' zijn er de twee koppen van.
  'Kalender': 'Calendar',
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
  'Kies wie er ziek is.': 'Choose who is ill.',
  '1 dag': '1 day',
  '{n} dagen': '{n} days',
  'Weg': 'Remove',
  'Voorbeeld: {voorbeeld}': 'Example: {voorbeeld}',
  '{dag}, {vakantie} — geen les': '{dag}, {vakantie} — no lessons',
  '{vakantie}: de club geeft deze dag geen les.':
    '{vakantie}: the club gives no lessons on this day.',
  '{lessen} vallen in een vakantie en gaan niet door: {dagen}.':
    '{lessen} fall in a holiday and will not happen: {dagen}.',
  '{lessen} vielen in een vakantie.': '{lessen} fell in a holiday.',
  // --- een overlap in woorden (lib/botsingen) ----------------------------
  // Een overlap blokkeert nooit en waarschuwt altijd; deze zinnen zeggen wáármee het botst.
  'een andere trainer': 'another coach',
  'een ander terrein': 'another court',
  '{baan}: daar staat al een les op {wanneer}.':
    '{baan}: a lesson is already scheduled there on {wanneer}.',
  '{trainer} geeft dan al een andere les op {wanneer}.':
    '{trainer} is already teaching another lesson then, on {wanneer}.',
  '{trainer} staat dan al op {baan}, op {wanneer}.':
    '{trainer} is already on {baan} then, on {wanneer}.',
  'Let op: {lessen} staan tegelijk met een andere les.':
    'Note: {lessen} run at the same time as another lesson.',
  // Beheer → Leden en het bewerkblad erachter (app/admin/leden, components/LidBewerken).
  'Leden': 'Members',
  'Gegevens, type account en beheerders': 'Details, account type and administrators',
  'Toevoegen, importeren en gegevens bijwerken': 'Add, import and update details',
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
  'Lesduur, thema en taal': 'Lesson length, theme and language',
  'Tennisschool': 'Tennis school',
  'Lessen beheren': 'Manage lessons',
  'Lesgroepen, ziekmelding, import en export':
    'Lesson groups, sick leave, import and export',
  'Lessen beheren is alleen voor de beheerder.': 'Managing lessons is for the admin only.',
  'Alles wat de lessen van de tennisschool draaiende houdt: wie in welke groep zit, wie een les overneemt als een trainer uitvalt, en het seizoen dat in en uit Excel gaat.':
    'Everything that keeps the lessons of the tennis school running: who is in which group, who takes over a lesson when a coach drops out, and the season that goes in and out of Excel.',
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
  'De spelerslijst is alleen voor trainers.': 'The player list is for coaches only.',
  'Kies hierboven welke spelers je wil zien, of zoek er een op naam.':
    'Pick which players you want to see above, or search for one by name.',
  'Dit dossier is niet van jou.': 'This file is not yours.',
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
  'Elk moment van deze reeks valt in een periode dat de club dicht is.':
    'Every slot of this series falls in a period when the club is closed.',
  '{lessen} komen tegelijk met een andere les te staan: {dagen}.':
    '{lessen} will run at the same time as another lesson: {dagen}.',
  'Deze les komt tegelijk met een andere te staan. {wat}':
    'This lesson will run at the same time as another one. {wat}',
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

  // --- aanwezigheid --------------------------------------------------------
  'Aanwezigheid': 'Attendance',
  'Aanwezig': 'Present',
  'Afgemeld': 'Cancelled',
  'Afwezig': 'Absent',
  'Nog niets afgevinkt.': 'Nothing ticked off yet.',
  '{n} van {totaal} aanwezig': '{n} of {totaal} present',
  '1 nog niet afgevinkt': '1 not ticked off yet',
  '{n} nog niet afgevinkt': '{n} not ticked off yet',
  '—  niet afgevinkt': '—  not ticked off',
  '{a} van {n} aanwezig · {b} keer afwezig · {o} niet afgevinkt':
    '{a} of {n} present · {b} times absent · {o} not ticked off',
  'Nog eens op dezelfde knop tikken maakt de aantekening weer leeg.':
    'Tapping the same button again clears the note.',
  'Afvinken': 'Roll call',
  'Deze les afvinken': 'Check off this lesson',
  'Wie is er? Bij het begin van de les': 'Who is here? At the start of the lesson',
  'Nu: {tijd} · geef je gsm door': 'Now: {tijd} · pass your phone around',
  'Afvinken doet de trainer van de les.': 'The coach of the lesson does the roll call.',
  '{naam} afmelden of terugzetten': 'Mark {naam} absent or put them back',
  'Geen les op dit moment': 'No lesson right now',
  'Dit scherm toont de les die nu bezig is. Open het bij het begin van de les en geef je gsm door.':
    'This screen shows the lesson that is running now. Open it at the start of the lesson and '
    + 'pass your phone around.',
  'Deze les is nog niet begonnen. Afvinken kan zodra hij loopt.':
    'This lesson has not started yet. You can check it off once it is running.',
  'Iedereen staat op aanwezig. Tik alleen wie er niet is; nog een tik zet hem terug.':
    'Everyone is marked present. Only tap whoever is missing; another tap puts them back.',
  'Iedereen die je niet aantikte, staat dan op aanwezig.':
    'Everyone you did not tap will be marked present.',
  'Hierna': 'Up next',
  'Tik een les aan om er nu al iemand van af te vinken.':
    'Tap a lesson to tick someone off for it ahead of time.',
  'Dit is niet de les die nu bezig is.': 'This is not the lesson running right now.',
  'Terug naar de les van nu': 'Back to the lesson happening now',
  'Terug naar het begin': 'Back to the start',

  // --- boekingstijden per trainer -----------------------------------------
  'Boekingstijden': 'Booking hours',
  'Per trainer, met afwijkende periodes': 'Per coach, with exception periods',
  'Jouw uren, en afwijkende periodes': 'Your hours, and exception periods',
  'Boekingstijden zijn er voor trainers.': 'Booking hours are for coaches.',
  'Hier staat tussen welke uren er bij een trainer geboekt kan worden. Vult hij niets in, dan geldt de tijd van de club. Een periode gaat vóór de standaard.':
    'This is between which hours people can book with a coach. Set nothing and the club hours '
    + 'apply. A period overrides the standard.',
  'Elke dag waarop {naam} lesgeeft, tenzij een periode hieronder iets anders zegt.':
    'Every day {naam} teaches, unless a period below says otherwise.',
  'Nu geldt de tijd van de club: {van} – {tot}. Kies hieronder eigen uren.':
    'The club hours apply for now: {van} – {tot}. Pick your own hours below.',
  'Terug naar de tijd van de club': 'Back to the club hours',
  'Afwijkende periode': 'Exception period',
  'Van datum tot datum andere uren — of helemaal geen les, bijvoorbeeld een week waarin deze trainer er niet is.':
    'Other hours from date to date — or no lessons at all, for instance a week this coach is away.',
  'bv. Zomerrooster': 'e.g. Summer hours',
  'In die periode': 'During that period',
  'Andere uren': 'Other hours',
  'Geen les': 'No lessons',
  'Periode toevoegen': 'Add period',
  'Nog geen afwijkende periodes.': 'No exception periods yet.',
  'Kies een van-uur en een tot-uur, met het van-uur eerst.':
    'Pick a from-hour and a to-hour, the from-hour first.',
  'De tijd van de club': 'The club hours',
  '1 afwijkende periode': '1 exception period',
  '{n} afwijkende periodes': '{n} exception periods',
  'Tussen welke uren er bij jou geboekt kan worden — en de periodes waarin dat anders is — staat op een eigen scherm.':
    'Between which hours people can book with you — and the periods where that differs — lives '
    + 'on its own screen.',
  'Naar boekingstijden': 'To booking hours',
  'Jouw uurtarief · tik om te wijzigen': 'Your hourly rate · tap to change',
  'Jouw uurtarief · je beheerder stelt dit in': 'Your hourly rate · your admin sets this',
  'Wat de club jou per uur uitbetaalt. Alleen ter informatie — de omzet loopt op het tarief van de baan. Leeg laten mag: dan staat er "nog niet ingesteld".':
    'What the club pays you per hour. For information only — revenue runs on the court rate. '
    + 'Leaving it blank is fine: it then reads "not set yet".',
  'bv. 35': 'e.g. 35',
  'Naam, e-mailadres en gsm-nummer': 'Name, email address and mobile number',
  'Gegevens bewerken': 'Edit details',
  'Deze gegevens beheert de beheerder van de club.': 'The club admin manages these details.',
  'Niets aangevinkt betekent: elke dag beschikbaar.': 'Nothing ticked means: available every day.',
  'Tussen welke uren er geboekt kan worden, en de periodes waarin dat anders is.':
    'Between which hours people can book, and the periods where that differs.',
  'Dit stelt de beheerder in: het is wat de club uitbetaalt.':
    'Your admin sets this: it is what the club pays out.',
  'Mail naar {adres}': 'Email {adres}',
  'WhatsApp naar {nummer}': 'WhatsApp {nummer}',
  'Opmerking voor de trainer': 'Note for the coach',
  'bv. speelt met een gekneusde pols, of: weg in de paasvakantie':
    'e.g. playing with a bruised wrist, or: away over the Easter holidays',
  'De trainer leest dit op het dossier. Leeg maken mag: dan staat er niets.':
    'The coach reads this on the file. Clearing it is fine: then nothing is shown.',
  'Niets ingevuld': 'Nothing filled in',
  'De gegevens hieronder beheert de club. Je opmerking voor de trainer schrijf je zelf.':
    'The club manages the details below. The note for the coach is yours to write.',

  // --- dossiers -----------------------------------------------------------
  'Open dossier van {naam}': 'Open the file of {naam}',
  'Open dossier van trainer {naam}': 'Open the file of coach {naam}',
  'Open dossier van vervanger {naam}': 'Open the file of stand-in {naam}',
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

  // Beheer → Trainingen exporteren: één periode, één bestand met vier bladen
  // (app/admin/export). De bladnamen zelf staan hier niet: die blijven in het bestand vast
  // Nederlands, omdat de import ze op hun naam terugzoekt.
  'Trainingen exporteren': 'Export trainings',
  'Eén Excel-bestand per periode': 'One Excel file per period',
  'Exporteren is alleen voor de beheerder.': 'Exporting is for the administrator only.',
  // Staat hier al is hij aan beide kanten gelijk: zonder regel zou de knop als enige zin op
  // dit scherm ontbreken, en dan lijkt hij vergeten in plaats van bewust hetzelfde.
  'Excel (.xlsx)': 'Excel (.xlsx)',
  'De lessen zijn die van {periode}; de lesgroepen staan er allemaal in, met hun lessen binnen die periode.':
    'The lessons are those of {periode}; every lesson group is included, with its lessons within that period.',
  'Een Excel-bestand maken kan alleen op de website.': 'Making an Excel file only works on the website.',
  'Het bestand krijgt vier bladen: Lessen, Uren per trainer, Aanwezigheid en Groepen, over {periode}. Blad “Aanwezigheid” is ook leeg uit te printen als invullijst voor een vervanger die de app niet heeft.':
    'The file gets four sheets: Lessen, Uren per trainer, Aanwezigheid and Groepen, covering {periode}. '
    + 'The “Aanwezigheid” sheet can also be printed empty as a tick list for a stand-in who does not have the app.',
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

  // --- trainingen importeren ----------------------------------------------
  'Trainingen importeren': 'Import training sessions',
  'Een seizoen uit Excel': 'A season from Excel',
  'Trainingen importeren is alleen voor de beheerder.':
    'Importing training sessions is for the administrator only.',
  'Kies het Excel-bestand met een heel seizoen erin: één regel per les en per leerling. Verplicht zijn Datum, Uur, Groep, Coach en Leerling; Type les, Groep-ID, E-mail leerling en Baan mogen erbij.':
    'Pick the Excel file with a whole season in it: one row per lesson and per student. '
    + 'Datum, Uur, Groep, Coach and Leerling are required; Type les, Groep-ID, E-mail leerling '
    + 'and Baan may be added.',
  'Op een telefoon of tablet kan hier geen bestand gekozen worden, en een Excel-bestand valt niet te plakken. Doe deze import op een computer, in de browser.':
    'On a phone or tablet no file can be picked here, and an Excel file cannot be pasted. '
    + 'Do this import on a computer, in the browser.',
  'Dit bestand heeft geen enkel blad met lessen erin.': 'This file has no sheet with lessons in it.',
  'Dit is geen Excel-bestand dat ik kan lezen. Bewaar het in Excel als .xlsx en kies het opnieuw.':
    'This is not an Excel file I can read. Save it in Excel as .xlsx and pick it again.',
  '{nieuw} nieuwe lesgroepen, {bijgewerkt} bijgewerkt, {ongewijzigd} ongewijzigd.':
    '{nieuw} new lesson groups, {bijgewerkt} updated, {ongewijzigd} unchanged.',
  '{spelers} nieuwe spelers, {lessen} lessen ingepland.':
    '{spelers} new players, {lessen} lessons scheduled.',
  '{groepen} lesgroepen aangemaakt, {bijgewerkt} bijgewerkt, {spelers} spelers erbij, {lessen} lessen ingepland, {gewisseld} lessen kregen een andere trainer.':
    '{groepen} lesson groups created, {bijgewerkt} updated, {spelers} players added, '
    + '{lessen} lessons scheduled, {gewisseld} lessons got a different coach.',
  '{n} lessen staan al goed en blijven zoals ze zijn.':
    '{n} lessons are already correct and stay as they are.',
  '{vakantie} vallen in een clubvakantie, {verleden} zijn al geweest.':
    '{vakantie} fall in a club holiday, {verleden} have already taken place.',
  '{n} lessen komen tegelijk met een andere les te staan. Ze worden ingepland; kijk ze na.':
    '{n} lessons will run at the same time as another lesson. They will be scheduled; '
    + 'please check them.',
  '{groep} op {dag}: {wat}': '{groep} on {dag}: {wat}',
  'Deze lesgroepen worden niet aangemaakt': 'These lesson groups will not be created',
  '{n} van de nieuwe lesgroepen hierboven komen er nu niet, en hun lessen dus ook niet.':
    '{n} of the new lesson groups above will not be created now, and neither will their lessons.',
  'Ontbreekt de trainer? Geef hem eerst een traineraccount in Beheer en kies daarna hetzelfde bestand opnieuw; dan komen deze groepen er alsnog bij.':
    'Is the coach missing? Give them a coach account in Admin first, then pick the same file '
    + 'again; these groups will be added after all.',
  'Nieuwe lesgroepen': 'New lesson groups',
  'Lesgroepen die bijgewerkt worden': 'Lesson groups that will be updated',
  'Lesgroepen die niet veranderen': 'Lesson groups that do not change',
  '1 nieuwe speler': '1 new player',
  '{n} nieuwe spelers': '{n} new players',
  '1 nieuwe trainer': '1 new coach',
  '{n} nieuwe trainers': '{n} new coaches',
  'Zij krijgen een account met een verzonnen e-mailadres. Een wachtwoord hoort daar niet bij; dat zet je apart.':
    'They get an account with a made-up email address. A password is not part of that; you set those separately.',
  'Weekschema van de club — seizoen {van} t/m {tot}.':
    "The club's weekly schedule — season {van} through {tot}.",
  'De koprij mist een verplichte kolom: Doelgroep, Groep, Weekdag, Uur, Terrein(en), Trainer(s) of Speler(s).':
    'The header row is missing a required column: Doelgroep, Groep, Weekdag, Uur, Terrein(en), Trainer(s) or Speler(s).',
  'Deze weekdag kon niet gelezen worden: {waarde}': 'This weekday could not be read: {waarde}',
  'Geen trainer ingevuld.': 'No coach filled in.',
  'Dit bestand is een weekschema zonder datums, en het seizoen van de club staat nog niet ingesteld.':
    "This file is a weekly schedule without dates, and the club's season has not been set yet.",
  'Deze groep staat op meerdere terreinen; ik zet haar op {baan}. De andere: {rest}.':
    'This group is on several courts; I am putting it on {baan}. The others: {rest}.',
  'Deze groep heeft meerdere trainers; ik zet {trainer} erop. De andere: {rest}.':
    'This group has several coaches; I am assigning {trainer}. The others: {rest}.',
  'Dit terrein kent de club niet: {baan}. De groep komt er wel, maar zonder lessen tot ze een baan heeft.':
    'The club does not know this court: {baan}. The group is created, but without lessons until it has a court.',
  'Er staan al meerdere trainers die {naam} kunnen zijn; koppel deze groep zelf.':
    'There are already several coaches who could be {naam}; link this group yourself.',
  'Met de hand verzet of afgezegd; dit blijft zoals het staat':
    'Moved or cancelled by hand; this stays as it is',
  '{groep} op {dag}: staat op {bestaandeTijd}, het bestand zegt {tijdInBestand}.':
    '{groep} on {dag}: currently at {bestaandeTijd}, the file says {tijdInBestand}.',
  'Deze lesgroepen krijgen een andere trainer': 'These lesson groups get a different coach',
  '{groep}: {aantal} komende lessen gaan van {van} naar {naar}.':
    '{groep}: {aantal} upcoming lessons move from {van} to {naar}.',
  '{groep}: {aantal} komende lessen krijgen {naar}.':
    '{groep}: {aantal} upcoming lessons get {naar}.',
  'Lessen die al geweest zijn veranderen niet, en wie een les werkelijk gaf blijft staan zoals het staat.':
    'Lessons that have already taken place do not change, and who actually gave a lesson stays '
    + 'as it is.',
  // --- de waarschuwing bovenaan en de aparte bevestiging (IMP-16, IMP-17) ---
  'Dit bestand gaat over {van} tot {tot}, en {percentage}% daarvan is al geweest.':
    'This file covers {van} to {tot}, and {percentage}% of that has already passed.',
  'Je las al eerder een seizoen in op {datum}. Dit bestand draait terug wat je daarna in de app wijzigde — kijk hieronder na wat dat precies is.':
    'You already imported a season on {datum}. This file reverts what you changed in the app '
    + 'afterwards — check below what exactly that is.',
  'Dit neemt iets weg — bevestig apart': 'This takes something away — confirm separately',
  '{groep}: {aantal} komende lessen gaan naar {naar}.':
    '{groep}: {aantal} upcoming lessons go to {naar}.',
  '{groep}: {namen} gaan uit het roster.': '{groep}: {namen} leave the roster.',
  'Een importbestand is een foto van het moment waarop het gemaakt is. Een ouder bestand zet terug wat je daarna in de app wijzigde. Laat dit uit als je alleen lessen wil bijladen.':
    'An import file is a photograph of the moment it was made. An older file puts back what you '
    + 'changed in the app afterwards. Leave this off if you only want to add lessons.',
  'Ja, pas ook deze wijzigingen toe': 'Yes, apply these changes as well',
  'Deze lessen staan in de app maar niet meer in het bestand':
    'These lessons are in the app but no longer in the file',
  'Ze blijven staan; een import haalt nooit iets weg.':
    'They stay; an import never removes anything.',
  '{groep} op {dag} om {tijd}.': '{groep} on {dag} at {tijd}.',
  'Zet in Supabase eerst "Confirm email" aan. Deze import maakt spelersaccounts aan voor die mensen zelf ooit ingelogd hebben, en zonder die instelling kan iemand met hun e-mailadres zo een account claimen.':
    'Turn on “Confirm email” in Supabase first. This import creates player accounts before those '
    + 'people have ever logged in, and without that setting anyone who knows their email address '
    + 'can claim such an account.',
  'Eerst gaan de spelers weg, dan de lesgroepen, dan de lessen. Gaat er onderweg iets mis, dan blijft staan wat er al stond en komt er niets dubbel bij: hetzelfde bestand nog een keer inlezen maakt het af. Het is dus veilig om opnieuw te draaien, maar het is geen import die zichzelf in één keer terugdraait.':
    'The players are saved first, then the lesson groups, then the lessons. If something goes '
    + 'wrong along the way, whatever was already saved stays and nothing is added twice: reading '
    + 'the same file again finishes the job. So it is safe to re-run, but it is not an import '
    + 'that rolls itself back in one go.',
  'Zeker weten?': 'Are you sure?',
  'Hierna staan de spelers, de lesgroepen en de lessen hierboven echt in de app, en veranderen ook de lessen en de roosters die hierboven genoemd staan.':
    'After this the players, lesson groups and lessons above are really in the app, and the '
    + 'lessons and rosters named above change along with them.',
  'Hierna staan de spelers, de lesgroepen en de lessen hierboven echt in de app. Wat er weggenomen of omgezet zou worden, blijft met rust.':
    'After this the players, lesson groups and lessons above are really in the app. Whatever '
    + 'would be taken away or switched over is left alone.',
  'Ja, nu importeren': 'Yes, import now',
  'Nee, toch niet': 'No, never mind',
  'Dit is niet weggeschreven': 'This was not saved',
  'Het wegschrijven is halverwege misgegaan': 'Saving went wrong halfway',
  'Het wegschrijven is mislukt.': 'Saving failed.',
  'Wat er al weggeschreven was, blijft staan. Er komt niets dubbel bij: kies hieronder Opnieuw proberen, dan zie je wat er nog openstaat.':
    'Whatever was already saved stays. Nothing is added twice: choose Try again below to see '
    + 'what is still outstanding.',

  // --- redenen uit de trainingenimport, ingevuld op het scherm --------------
  'De koprij mist een verplichte kolom: Datum, Uur, Groep, Coach of Leerling.':
    'The header row is missing a required column: Datum, Uur, Groep, Coach or Leerling.',
  'Geen datum ingevuld.': 'No date filled in.',
  'Geen uur ingevuld.': 'No time filled in.',
  'Geen coach ingevuld.': 'No coach filled in.',
  'Geen leerling ingevuld.': 'No student filled in.',
  'Deze datum kon niet gelezen worden: {waarde}': 'This date could not be read: {waarde}',
  'Dit uur kon niet gelezen worden: {waarde}': 'This time could not be read: {waarde}',
  'Deze groep heeft een Groep-ID dat ik niet ken: {waarde}. Ik zoek de groep op dag, uur en baan.':
    'This group has a Groep-ID I do not know: {waarde}. I look the group up by day, time and court.',
  'Op {dag} om {uur} staan lessen op meer dan één baan; ik houd ze uit elkaar als aparte lesgroepen.':
    'On {dag} at {uur} lessons are on more than one court; I keep them apart as separate '
    + 'lesson groups.',
  'De groep {groep} heeft meer dan één coach: {gekozen} en {andere}. Ik neem {gekozen}.':
    'Group {groep} has more than one coach: {gekozen} and {andere}. I use {gekozen}.',
  'De groep {groep} heeft meer dan één Type les: {gekozen} en {andere}. Ik neem {gekozen}.':
    'Group {groep} has more than one Type les: {gekozen} and {andere}. I use {gekozen}.',
  'Er staan al meerdere leden die {naam} kunnen zijn; koppel deze leerling zelf, ik laat hem staan.':
    'Several members could be {naam}; link this student yourself, I leave them alone.',
  'Ik ken geen trainer {naam}; koppel hem aan een account, anders worden de lessen van {groep} niet ingepland.':
    'I do not know a coach {naam}; link them to an account, otherwise the lessons of {groep} '
    + 'are not scheduled.',
  'Bij {groep} staat geen trainer; zonder trainer worden haar lessen niet ingepland.':
    'There is no coach for {groep}; without a coach its lessons are not scheduled.',
  'Ik ken geen baan {waarde}; koppel er een aan {groep}, anders worden haar lessen niet ingepland.':
    'I do not know a court {waarde}; link one to {groep}, otherwise its lessons are not scheduled.',
  'Bij {groep} staat geen baan; koppel er een, anders worden haar lessen niet ingepland.':
    'There is no court for {groep}; link one, otherwise its lessons are not scheduled.',
  'Ik kan de lesgroep {groep} niet aanmaken: {reden} Haar lessen gaan dus ook niet door.':
    'I cannot create lesson group {groep}: {reden} So its lessons do not go ahead either.',
  'De lessen van {groep} worden niet ingepland: er ontbreekt een trainer, een baan of een leerling.':
    'The lessons of {groep} are not scheduled: a coach, a court or a student is missing.',

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
  'Voor trainers, spelers en beheerders': 'For coaches, players and admins',
  'Voor trainers': 'For coaches',
  'Voor spelers': 'For players',
  'Voor beheerders': 'For admins',

  // --- Het verloop van een speler (components/progress/VoortgangVerloop) ---
  // 'Verloop', '1 notitie' en '{n} notities' staan hierboven al: het omzetverloop en de
  // spelerslijst gebruiken dezelfde woorden, en dat hoort ook zo.
  'Gemiddelde score per maand.': 'Average score per month.',
  '{maand}: geen notities': '{maand}: no notes',
  '{maand}: {score} uit {n}': '{maand}: {score} from {n}',
  'Gemiddeld {score} uit {n}': 'Average {score} from {n}',
  ' · 1 notitie': ' · 1 note',
  ' · {n} notities': ' · {n} notes',
  '{n} hoger dan bij de start': '{n} higher than at the start',
  '{n} lager dan bij de start': '{n} lower than at the start',
  'gelijk gebleven': 'unchanged',
  'Nog geen scores. Zodra je bij een notitie sterren zet, verschijnt hier het verloop.':
    'No scores yet. As soon as you add stars to a note, the trend appears here.',
  'De laatste {n} maanden. Een maand zonder notities blijft leeg staan — dat gat is zelf informatie.':
    'The last {n} months. A month without notes stays empty — that gap is information in itself.',

  // --- Een les verzetten (components/VerzetLes) ---
  'Les verzetten': 'Move lesson',
  'Verzetten': 'Move',
  'Nu: {moment}': 'Now: {moment}',
  'Wordt: {moment}': 'Becomes: {moment}',
  'Nieuwe dag': 'New day',
  'Nieuw beginuur': 'New start time',
  'Het blijft dezelfde les: de betaalwijze, de deelnemers en de aanwezigheid gaan mee.':
    'It stays the same lesson: payment method, participants and attendance come along.',
  'Dit is het moment waar de les nu al staat.': 'That is where the lesson already is.',
  'Kies een geldige dag en een geldig uur.': 'Pick a valid day and time.',
  'De tijden van deze les zijn onleesbaar.': 'The times of this lesson are unreadable.',
  '{vakantie}: de club geeft die dag geen les.':
    '{vakantie}: the club has no lessons that day.',
  'Wat andere spelers bij deze trainer boekten, zie je hier niet. Of een uur echt vrij is, bevestigt de trainer bij je aanvraag.':
    'You cannot see what other players booked with this coach. Your coach confirms whether the hour is really free when you request it.',
  'Kopieer als tekst': 'Copy as text',
  'De hele gids staat op je klembord. Plak hem in een mail.':
    'The whole guide is on your clipboard. Paste it into an email.',
  'De gids is klaargezet om te delen.': 'The guide is ready to share.',
  'Kopiëren lukte niet. Selecteer de tekst hieronder en kopieer hem zelf.':
    'Copying failed. Select the text below and copy it yourself.',

  // --- Beheer → Lesgroepen: de vaste groepen van de tennisschool (app/admin/lesgroepen) ---
  'Lesgroepen': 'Lesson groups',
  'Lesgroep': 'Lesson group',
  'Naam, niveau, rooster en spelers': 'Name, level, schedule and players',
  'Lesgroepen zijn alleen voor de beheerder.': 'Lesson groups are for the administrator only.',
  'Een lesgroep is het blijvende gegeven onder de lessen: dezelfde spelers, dezelfde dag, hetzelfde uur, het hele seizoen. Wijzig je hem later, dan gaan de lessen van vandaag en later mee; wat al gegeven is blijft staan zoals het was.':
    'A lesson group is the lasting thing underneath the lessons: the same players, the same day, '
    + 'the same hour, all season. Change it later and the lessons from today onwards follow; '
    + 'what has already been taught stays as it was.',
  'bv. Woensdag 16u groep 3': 'e.g. Wednesday 4pm group 3',
  'Niveau': 'Level',
  'bv. Kidstennis oranje': 'e.g. Kids tennis orange',
  'Lesdag': 'Lesson day',
  'Beginuur': 'Start time',
  'Baan (mag leeg)': 'Court (may be empty)',
  'Geen baan': 'No court',
  'Geen trainer': 'No coach',
  'Seizoen van': 'Season from',
  'Lesgroep aanmaken': 'Create lesson group',
  '1 lesgroep': '1 lesson group',
  '{n} lesgroepen': '{n} lesson groups',
  'Gearchiveerd': 'Archived',
  'Nog geen lesgroepen. Een groep die je hier aanmaakt zet nog geen lessen in de agenda: het inplannen van een heel seizoen komt met de import van de planning. Tot dan hang je een les zelf aan een groep.':
    'No lesson groups yet. A group you create here does not put any lessons in the schedule: '
    + 'planning a whole season comes with the import of the planning. Until then you attach a '
    + 'lesson to a group yourself.',
  // Het detailscherm van één groep (app/admin/lesgroepen/[id]).
  'Lesgroep niet gevonden.': 'Lesson group not found.',
  'Wie je hier toevoegt of weghaalt, staat vanaf vandaag op de lessen van deze groep. De lessen die al geweest zijn houden hun eigen deelnemerslijst en veranderen niet mee.':
    'Whoever you add or remove here is on this group\u2019s lessons from today onwards. The '
    + 'lessons that have already been taught keep their own list of players and do not change '
    + 'along with it.',
  'Er hangt nog geen enkele les aan deze groep. Het inplannen van een heel seizoen komt met de import van de planning; tot dan hang je een les zelf aan deze groep.':
    'There is not a single lesson attached to this group yet. Planning a whole season comes '
    + 'with the import of the planning; until then you attach a lesson to this group yourself.',
  'Nog 1 les te gaan': '1 lesson still to come',
  'Nog {n} lessen te gaan': '{n} lessons still to come',
  'Er komt geen les van deze groep meer aan.': 'No more lessons of this group are coming up.',
  'Eerder en afgezegd': 'Earlier and cancelled',
  'Er is nog geen les van deze groep geweest.': 'No lesson of this group has been taught yet.',
  'Archiveren': 'Archiving',
  'Archiveren haalt de groep uit de actieve lijst, en verder gebeurt er niets: de lessen die gegeven zijn en hun geschiedenis blijven onaangeroerd, en het rooster blijft staan zodat je later nog ziet wie erin zat.':
    'Archiving takes the group out of the active list, and nothing else happens: the lessons '
    + 'that have been taught and their history stay untouched, and the roster stays put so you '
    + 'can still see later who was in it.',
  'Groep archiveren': 'Archive group',
  'Terug in de actieve lijst': 'Back in the active list',
  // De voorvertoning bij de Bewaren-knop van het groepsdetail: wat er meeverzet en wat er om
  // welke reden blijft staan. De tellingen '1 les' en '{n} lessen' staan al bij het
  // boekingsvenster; deze zinnen hangen eraan vast.
  'Een ander uur, een andere dag, een andere trainer of een andere baan werkt door in de lessen van vandaag en later. Een les die iemand anders al gaf, blijft van hem.':
    'A different hour, a different day, a different coach or a different court carries through '
    + 'to the lessons of today and later. A lesson someone else already taught stays theirs.',
  '{lessen} van vandaag en later verzetten mee. De lessen die al geweest zijn blijven staan waar ze stonden.':
    '{lessen} of today and later move along. The lessons that have already been taught stay '
    + 'where they were.',

  '{lessen} zouden in een vakantie vallen en blijven staan: {dagen}.':
    '{lessen} would fall in a holiday and stay put: {dagen}.',
  '{lessen} zouden hierdoor in het verleden komen te staan en blijven staan: {dagen}.':
    '{lessen} would end up in the past because of this and stay put: {dagen}.',
  'Naam, niveau en seizoen raken de lessen niet; er verzet niets mee.':
    'Name, level and season do not touch the lessons; nothing moves along.',
  // De meldingen van `lesGroepFout` in lib/lesgroepen; ze komen op dit scherm in de foutregel
  // te staan, dus zonder deze regels bleven ze in het Nederlands hangen.
  'Geef de lesgroep een naam.': 'Give the lesson group a name.',
  'Geef de lesgroep een niveau.': 'Give the lesson group a level.',
  'Kies een lesdag van de week.': 'Pick a day of the week.',
  'Kies een beginuur tussen 0 en 23.': 'Pick a start hour between 0 and 23.',
  'Kies een beginminuut tussen 0 en 59.': 'Pick a start minute between 0 and 59.',
  'Kies een trainer voor de lesgroep.': 'Pick a coach for the lesson group.',
  'Het seizoen eindigt voor het begint.': 'The season ends before it starts.',
  // Het groepsblok op het lesdetailblad (components/BookingDetailSheet), alleen voor de beheerder.
  'Deze les verwijst naar een lesgroep die hier niet (meer) te vinden is.':
    'This lesson points to a lesson group that cannot (no longer) be found here.',
  'Losmaken van de lesgroep': 'Detach from the lesson group',
  'Er is nog geen lesgroep om aan te hangen. Je maakt er een aan bij Beheer, onder Lesgroepen.':
    'There is no lesson group to attach to yet. You create one under Admin, in Lesson groups.',
  'Deze les hoort bij geen enkele lesgroep. Eraan hangen verandert niets aan de les zelf: wie erbij stond, het uur en de betaling blijven.':
    'This lesson does not belong to any lesson group. Attaching it changes nothing about the '
    + 'lesson itself: who was there, the hour and the payment all stay.',
  'Aan een lesgroep hangen': 'Attach to a lesson group',

  // --- Beheer → Instellingen: de lesduur als clubinstelling (app/admin/settings) ---
  'Lesduur': 'Lesson length',
  'Hoe lang een les duurt. Dit geldt voor lessen die je hierna inplant; lessen die al in de agenda staan houden hun eigen uur.':
    'How long a lesson lasts. This applies to lessons you schedule from now on; lessons that '
    + 'are already in the schedule keep their own hour.',
  '{n} min': '{n} min',

  // --- Beheer → Ziekmelding: een trainer ziek melden en de meldingen terugzien
  //     (app/admin/ziekmelding) ---
  'Ziekmelding': 'Sick leave',
  'Werklijst': 'Work list',
  'Werklijst en vervangers': 'Work list and substitutes',
  'Ziekmeldingen zijn alleen voor de beheerder.': 'Sick leave is for the administrator only.',
  'Meld hier een trainer ziek over een periode van dag tot en met dag.':
    'Report a coach sick here, over a period from day to day.',
  'Je komt daarna meteen op de werklijst van die melding: elke les die eronder valt, met wie hem kan overnemen.':
    'You then land straight on the work list for that report: every lesson it covers, with who '
    + 'can take it over.',
  'De app verwittigt niemand — bellen en appen blijft mensenwerk.':
    'The app notifies no one — calling and texting stays a job for people.',
  'Wie is er ziek?': 'Who is sick?',
  'Ziek van': 'Sick from',
  'Reden (mag leeg)': 'Reason (may be blank)',
  'bv. griep': 'e.g. flu',
  'Ziek melden': 'Report sick',
  'De ziekmelding is niet bewaard. Probeer het zo nog eens.':
    'The sick leave was not saved. Please try again in a moment.',
  'Er loopt op dit moment geen enkele ziekmelding.': 'No sick leave is running right now.',
  '1 lopende ziekmelding': '1 sick leave running',
  '{n} lopende ziekmeldingen': '{n} sick leaves running',
  'Werklijst openen': 'Open work list',
  'Ingetrokken': 'Withdrawn',
  'Definitief verwijderen': 'Delete for good',
  'Toch niet': 'Never mind',
  'Deze ziekmelding wordt verwijderd. De vervangers en de afzeggingen die eruit volgden worden teruggedraaid, voor zover die lessen nog moeten komen. Een les die de speler zelf afzegde blijft afgezegd.':
    'This sick note will be deleted. The stand-ins and cancellations it caused are undone, for lessons still to come. A lesson the player cancelled themselves stays cancelled.',
  'De ziekteperiode eindigt voor ze begint.': 'The sick leave ends before it starts.',
  'Alles in één keer': 'All at once',
  'Kies een datum uit de kalender': 'Pick a date from the calendar',
  'Maand terug': 'Previous month',
  'Maand verder': 'Next month',
  'Wie kan er het meeste overnemen? De lessen waarop hij niet kan blijven openstaan.':
    'Who can take on the most? The lessons they cannot take stay open.',
  '{naam} · kan er {kan} van de {totaal}': '{naam} · can take {kan} of {totaal}',
  '{n} lessen naar {naam}.': '{n} lessons assigned to {naam}.',
  '{n} lessen naar {naam}. {rest} blijven openstaan.':
    '{n} lessons assigned to {naam}. {rest} stay open.',
  'Onbekende trainer': 'Unknown coach',

  // --- Beheer → Ziekmelding: de werklijst (app/admin/ziekmelding/[id]) ---
  'Deze ziekmelding bestaat niet meer.': 'This sick leave no longer exists.',
  'Geen enkele les zoekt nog een vervanger.': 'No lesson is still looking for a substitute.',
  '1 les zoekt nog een vervanger': '1 lesson is still looking for a substitute',
  '{n} lessen zoeken nog een vervanger': '{n} lessons are still looking for a substitute',
  'Deze ziekmelding raakt geen enkele les.': 'This sick leave affects no lesson at all.',
  'Afgezegd': 'Cancelled',
  'Geregeld': 'Sorted',
  'Zoekt vervanger': 'Looking for a substitute',
  'Vaste trainer': 'Regular coach',
  'Vervanger koppelen': 'Attach a substitute',
  'Andere vervanger': 'Another substitute',
  'Laten staan': 'Leave it standing',
  'Afzeggen': 'Cancel the lesson',
  'Wie kan deze les overnemen?': 'Who can take this lesson over?',
  'Er is geen andere trainer om uit te kiezen.': 'There is no other coach to choose from.',
  'Kan invallen': 'Can step in',
  'Geen enkele collega kan dit uur.': 'No colleague is free at this hour.',
  'Kan niet, tenzij je het toch wil': 'Cannot, unless you want them anyway',
  'kan invallen': 'can step in',
  'geeft dan zelf al les': 'is teaching a lesson of their own then',
  'geeft dan geen les': 'does not teach then',
  'is die periode afwezig': 'is away during that period',
  'de club is dan dicht': 'the club is closed then',
  'is zelf ziek gemeld': 'has been reported sick',
  'De trainer is ziek gemeld: deze les zoekt nog een vervanger.':
    'The coach has been reported sick: this lesson is still looking for a substitute.',
  'Je regelt hem op de werklijst, onder Beheer bij Ziekmelding.':
    'You sort it out on the work list, under Admin in Sick leave.',

  // --- Beheer → Banen: een baan aanmaken (app/admin/courts, lib/banen) ---
  'Banen zijn alleen voor de beheerder.': 'Courts are for the administrator only.',
  'Welke baan': 'Which court',
  'Baan kiezen, nu {baan}': 'Choose a court, now {baan}',
  'Alle banen': 'All courts',
  '1 staffelstap': '1 tariff step',
  '{n} staffelstappen': '{n} tariff steps',
  'Baan toevoegen': 'Add a court',
  'bv. Gravel 3': 'e.g. Clay 3',
  'Nummer': 'Number',
  'bv. 3': 'e.g. 3',
  'bv. 30': 'e.g. 30',
  'Ligging': 'Location',
  'Een nieuwe baan begint zonder staffel: tot je er een instelt, geldt dit uurtarief ook voor een groepsles.':
    'A new court starts without a group tariff: until you set one, this hourly rate applies to '
    + 'a group lesson too.',
  'Geef de baan een naam.': 'Give the court a name.',
  'Geef de baan een nummer: een heel getal vanaf 1.':
    'Give the court a number: a whole number from 1 up.',
  'Baan {nr} bestaat al.': 'Court {nr} already exists.',
  'Vul een uurtarief in, bijvoorbeeld 30 of 22,50.':
    'Fill in an hourly rate, for example 30 or 22.50.',
  // --- lessen zonder trainer ---------------------------------------------
  'Deze les bestaat niet meer.': 'This lesson no longer exists.',
  'Dit is je eigen les.': 'This is your own lesson.',
  'Een collega was je voor: deze les heeft al een lesgever.':
    'A colleague beat you to it: this lesson already has a coach.',
  'Deze les is al begonnen.': 'This lesson has already started.',
  'Deze les zoekt geen trainer meer.': 'This lesson is no longer looking for a coach.',
  'Deze les staat niet op jouw naam.': 'This lesson is not in your name.',
  'Lessen zonder trainer': 'Lessons without a coach',
  'Deze lijst is voor trainers.': 'This list is for coaches.',
  'Nog zonder trainer': 'Still without a coach',
  'Er staat op dit moment geen les zonder trainer.':
    'There is no lesson without a coach right now.',
  '{naam} is ziek gemeld.': '{naam} has been reported sick.',
  'Vrijgegeven door {naam}.': 'Released by {naam}.',
  'Je geeft dan zelf al les.': 'You are already teaching then.',
  'Dit valt buiten je uren.': 'This falls outside your hours.',
  'Je bent die periode afwezig.': 'You are away during that period.',
  'De club is die dag dicht.': 'The club is closed that day.',
  'Je bent zelf ziek gemeld.': 'You have been reported sick yourself.',
  'Ik neem deze les': 'I will take this lesson',
  'Toch nemen': 'Take it anyway',
  'Laat maar': 'Never mind',
  'De les staat nu op jouw naam.': 'The lesson is now in your name.',
  'De les staat weer open.': 'The lesson is open again.',
  'Door mij overgenomen': 'Taken over by me',
  'Vaste trainer: {naam}': 'Regular coach: {naam}',
  'Teruggeven': 'Give back',
  'geen': 'none',
  'Deze les zoekt een trainer': 'This lesson needs a coach',
  'Toch zelf geven': 'Teach it myself after all',
  // --- lesmateriaal doorsturen -------------------------------------------
  'Kies welk lesmateriaal je doorstuurt.': 'Choose which lesson material you are sending on.',
  'Kies een trainer, een groep, of beide.': 'Choose a coach, a group, or both.',
  'De periode eindigt voor ze begint.': 'The period ends before it starts.',
  'Lesplanning': 'Lesson planning',
  'Materiaal per periode en groep': 'Material per period and group',
  'Lesplanning is alleen voor de beheerder.': 'Lesson planning is for the administrator only.',
  'Kies lesmateriaal en een periode, en zeg voor wie het geldt: een trainer, een groep, of een groep bij een trainer. De trainer ziet het bij zijn les staan.':
    'Choose lesson material and a period, and say who it applies to: a coach, a group, or a group with a coach. The coach sees it with their lesson.',
  'Doorsturen': 'Send on',
  'Doorgestuurd': 'Sent on',
  'Er is nog niets doorgestuurd.': 'Nothing has been sent on yet.',
  '{groep} bij {trainer}': '{groep} with {trainer}',
  'Onbekend lesmateriaal': 'Unknown lesson material',
  'Onbekende groep': 'Unknown group',
  'Ja, weghalen': 'Yes, remove it',
  'Deze periode: {titel}': 'This period: {titel}',
  'Lesmateriaal {titel} openen': 'Open lesson material {titel}',
  'Zoek een trainer…': 'Search for a coach…',
  'Zoek een groep…': 'Search for a group…',
  'Doorsturen naar…': 'Send on to…',
  'Doorgestuurd: {periode} · {aanWie}': 'Sent on: {periode} · {aanWie}',
  'Hier staat wat er aan wie is doorgestuurd, en voor welke periode. Doorsturen doe je in Lesmateriaal → Databank: zoek de training en gebruik "Doorsturen naar…".':
    'This is what has been sent on to whom, and for which period. To send something on, go to Lesson material → Database: find the training and use "Send on to…".',
  'Geen trainer gekozen': 'No coach chosen',
  'Geen groep gekozen': 'No group chosen',
};
