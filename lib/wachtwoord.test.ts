import { controleerWachtwoord, gaatOverEenBestaandAccount, MIN_WACHTWOORD } from './wachtwoord';

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
