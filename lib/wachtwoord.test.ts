import {
  controleerWachtwoord, gaatOverEenBestaandAccount, MIN_WACHTWOORD,
  magVersturen, magNieuwWachtwoordVersturen, isHerstelHash,
  aanmeldUitkomst, aanmeldMelding, BESTAAT_AL_MELDING, BEVESTIG_MAIL_MELDING,
} from './wachtwoord';

describe('controleerWachtwoord', () => {
  it('keurt een goed en tweemaal gelijk wachtwoord goed', () => {
    expect(controleerWachtwoord('geheim123', 'geheim123')).toBeNull();
  });

  it('houdt een te kort wachtwoord tegen', () => {
    expect(controleerWachtwoord('kort', 'kort')).toBe(
      'Kies een wachtwoord van minstens zes tekens.',
    );
  });

  it('houdt twee verschillende wachtwoorden tegen', () => {
    expect(controleerWachtwoord('geheim123', 'geheim124')).toBe(
      'De twee wachtwoorden zijn niet gelijk.',
    );
  });

  it('klaagt eerst over de lengte, want dat is de fout die je zelf ziet', () => {
    expect(controleerWachtwoord('kort', 'anders')).toBe(
      'Kies een wachtwoord van minstens zes tekens.',
    );
  });

  it('telt spaties mee als tekens — een wachtwoord is geen naam', () => {
    expect(controleerWachtwoord('a b c ', 'a b c ')).toBeNull();
    expect(MIN_WACHTWOORD).toBe(6);
  });
});

describe('gaatOverEenBestaandAccount', () => {
  it('herkent waar Supabase mee komt als het adres al een login heeft', () => {
    expect(gaatOverEenBestaandAccount('User already registered')).toBe(true);
    expect(gaatOverEenBestaandAccount('A user with this email address has already been registered'))
      .toBe(true);
  });

  it('laat een andere fout met rust', () => {
    expect(gaatOverEenBestaandAccount('Network request failed')).toBe(false);
  });
});

describe('magVersturen', () => {
  const velden = { email: 'a@b.be', wachtwoord: 'geheim123', herhaling: 'geheim123', naam: 'Piet' };

  it('is genoeg om in te loggen: alleen adres en wachtwoord', () => {
    expect(magVersturen('inloggen', { ...velden, herhaling: '', naam: '' })).toBe(true);
  });

  it('vraagt bij "nieuw" ook een herhaling', () => {
    expect(magVersturen('nieuw', { ...velden, herhaling: '' })).toBe(false);
    expect(magVersturen('nieuw', velden)).toBe(true);
  });

  it('vraagt nooit om een naam: die staat er al, of de databank vult hem aan', () => {
    expect(magVersturen('nieuw', { ...velden, naam: '' })).toBe(true);
  });

  it('houdt een leeg e-mailadres of wachtwoord altijd tegen', () => {
    expect(magVersturen('inloggen', { ...velden, email: '  ' })).toBe(false);
    expect(magVersturen('inloggen', { ...velden, wachtwoord: '' })).toBe(false);
  });

  it('vraagt bij "vergeten" alleen een e-mailadres, geen wachtwoord', () => {
    expect(magVersturen('vergeten', { ...velden, wachtwoord: '', herhaling: '', naam: '' })).toBe(true);
    expect(magVersturen('vergeten', { ...velden, email: '  ' })).toBe(false);
  });
});

describe('magNieuwWachtwoordVersturen', () => {
  it('vraagt beide velden ingevuld', () => {
    expect(magNieuwWachtwoordVersturen('geheim123', 'geheim123')).toBe(true);
    expect(magNieuwWachtwoordVersturen('', 'geheim123')).toBe(false);
    expect(magNieuwWachtwoordVersturen('geheim123', '')).toBe(false);
  });
});

describe('isHerstelHash', () => {
  it('herkent de hash die Supabase na een herstellink meegeeft', () => {
    expect(isHerstelHash('#access_token=abc&type=recovery&expires_in=3600')).toBe(true);
  });

  it('laat een gewone hash met rust', () => {
    expect(isHerstelHash('')).toBe(false);
    expect(isHerstelHash('#access_token=abc&type=signup')).toBe(false);
  });
});

describe('aanmeldUitkomst', () => {
  it('herkent een bestaand, bevestigd adres aan de lege identiteitenlijst', () => {
    expect(aanmeldUitkomst(false, 0)).toBe('bestaat-al');
  });

  it('is meteen ingelogd als er een sessie meekomt (Confirm email staat uit)', () => {
    expect(aanmeldUitkomst(true, 1)).toBe('ingelogd');
  });

  it('moet nog bevestigd worden als er geen sessie meekomt (Confirm email staat aan)', () => {
    expect(aanmeldUitkomst(false, 1)).toBe('bevestig-je-mail');
  });

  it('laat de sessie winnen: `identities` is optioneel in het User-type, een sessie niet', () => {
    // Komt er ooit een antwoord mét sessie maar zónder identiteiten, dan is deze persoon
    // feitelijk al binnen — dat weegt zwaarder dan een lege identiteitenlijst.
    expect(aanmeldUitkomst(true, 0)).toBe('ingelogd');
  });
});

describe('aanmeldMelding', () => {
  it('geeft de "bestaat al"-melding', () => {
    expect(aanmeldMelding('bestaat-al')).toBe(BESTAAT_AL_MELDING);
  });

  it('geeft de "bevestig je mail"-melding', () => {
    expect(aanmeldMelding('bevestig-je-mail')).toBe(BEVESTIG_MAIL_MELDING);
  });

  it('heeft niets te zeggen bij een geslaagde, meteen ingelogde aanmelding', () => {
    expect(aanmeldMelding('ingelogd')).toBeNull();
  });
});
