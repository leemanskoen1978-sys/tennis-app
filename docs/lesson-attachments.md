# Les-bijlagen (PDF)

Een les kan PDF's hebben via `Lesson.attachments: LessonAttachment[]` (`lib/types.ts`).

```ts
interface LessonAttachment {
  id: string;
  name: string;
  mime: string;          // nu altijd 'application/pdf'
  size: number;          // bytes
  source: 'local' | 'drive';
  uri: string;           // data URL (local) of Drive webViewLink (drive)
  drive_file_id?: string;
}
```

## Nu (web)

`components/LessonAttachments.tsx` gebruikt een verborgen `<input type="file" accept="application/pdf">`
en slaat het bestand op als base64 data URL in de mock store (localStorage).
Daarom een limiet van **2 MB per bestand** (`MAX_ATTACHMENT_BYTES`): localStorage is ~5 MB
totaal en base64 voegt ~33% toe.

Openen gaat via `openAttachment()`, dat een data URL omzet naar een blob-URL —
browsers blokkeren het direct navigeren naar `data:`-URL's.

## Native (iOS/Android)

Nu een placeholder, net als de voice memo. Native pad: `expo-document-picker`
(`DocumentPicker.getDocumentAsync({ type: 'application/pdf' })`) + `expo-file-system`
om het bestand te kopiëren of te uploaden.

## Later: Google Drive

Het datamodel is er al op voorbereid. Bij de overstap:

1. Upload het bestand naar Drive (OAuth + Drive API `files.create`, resumable upload).
2. Sla op als `{ source: 'drive', drive_file_id, uri: webViewLink }` — `uri` blijft
   het ding dat de UI opent, dus `AttachmentList`/`openAttachment` hoeven niet te wijzigen.
3. `size`/`name`/`mime` komen uit de Drive-response.
4. Bestaande `source: 'local'` bijlagen kunnen blijven werken of eenmalig gemigreerd
   worden (data URL → Drive-upload).

Met Drive vervalt de 2 MB-limiet; die geldt alleen voor de lokale data-URL-opslag.
