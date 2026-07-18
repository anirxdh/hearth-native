import { answerFor, type CompanionCtx } from '../companion';

function ctx(overrides: Partial<CompanionCtx> = {}): CompanionCtx {
  return {
    people: [
      { name: 'Amara', route: '/patient/p1' },
      { name: 'Joseph', route: '/patient/p2' },
    ],
    worstRunways: [
      { patient: 'Amara', med: 'Metformin', daysRemaining: 2, route: '/patient/p1' },
      { patient: 'Joseph', med: 'Lisinopril', daysRemaining: 5, route: '/patient/p2' },
      { patient: 'Amara', med: 'Atorvastatin', daysRemaining: 9, route: '/patient/p1' },
      { patient: 'Joseph', med: 'Warfarin', daysRemaining: 11, route: '/patient/p2' },
    ],
    nextVisit: {
      patientName: 'Amara',
      provider: 'Dr. Osei',
      whenLine: 'in 3 days (2026-07-21)',
      route: '/appointments/a1',
    },
    ...overrides,
  };
}

describe('answerFor: the 911-first rule', () => {
  it('answers an emergency with the 911 line first and routes to the guides', () => {
    const a = answerFor('I think dad had a fall', ctx());
    expect(a.text.split('\n')[0]).toBe('If this is happening right now, call 911.');
    expect(a.action).toEqual({ label: 'Open the emergency guides', route: '/guides' });
  });

  it('outranks every other keyword when an emergency word is present', () => {
    const a = answerFor('she is bleeding and also needs a refill', ctx());
    expect(a.text.split('\n')[0]).toBe('If this is happening right now, call 911.');
    expect(a.action?.route).toBe('/guides');
  });

  it('matches er and 911 only as whole words, so paper stays paperwork', () => {
    const a = answerFor('help with an insurance paper', ctx());
    expect(a.action?.route).toBe('/workflows');
  });
});

describe('answerFor: refills', () => {
  it('summarizes the three worst runways and routes to the most urgent person', () => {
    const a = answerFor('What refills are due?', ctx());
    expect(a.text).toContain("Amara's Metformin has 2 days left.");
    expect(a.text).toContain("Joseph's Lisinopril has 5 days left.");
    expect(a.text).toContain("Amara's Atorvastatin has 9 days left.");
    expect(a.text).not.toContain('Warfarin');
    expect(a.action).toEqual({ label: "Open Amara's record", route: '/patient/p1' });
  });

  it('says plainly when a medication has run out', () => {
    const a = answerFor('did anything run out of supply?', ctx({
      worstRunways: [{ patient: 'Joseph', med: 'Insulin', daysRemaining: 0, route: '/patient/p2' }],
    }));
    expect(a.text).toContain("Joseph's Insulin has run out.");
    expect(a.action?.route).toBe('/patient/p2');
  });

  it('is honest when nothing is running low', () => {
    const a = answerFor('any medication refills coming?', ctx({ worstRunways: [] }));
    expect(a.text).toContain('No refills are running low right now.');
    expect(a.action).toBeUndefined();
  });
});

describe('answerFor: visits and rides', () => {
  it('gives the next visit line and points at the Get there section', () => {
    const a = answerFor('How do we get there for the visit?', ctx());
    expect(a.text).toContain('Amara sees Dr. Osei in 3 days (2026-07-21).');
    expect(a.text).toContain(
      'The Get there section of the visit sheet covers rides: rideshare, paratransit, and NEMT booking windows.',
    );
    expect(a.action).toEqual({ label: 'Open the visit sheet', route: '/appointments/a1' });
  });

  it('falls back to the appointments list when nothing is scheduled', () => {
    const a = answerFor('need a ride', ctx({ nextVisit: null }));
    expect(a.text).toContain('Get there');
    expect(a.action).toEqual({ label: 'Open appointments', route: '/appointments' });
  });
});

describe('answerFor: other routes', () => {
  it('routes scan questions to the scanner', () => {
    const a = answerFor('can I scan a bottle?', ctx());
    expect(a.action?.route).toBe('/scan');
  });

  it('lists the circle when asked who is in it', () => {
    const a = answerFor('who is in my circle?', ctx());
    expect(a.text).toContain('Amara and Joseph');
    expect(a.action?.route).toBe('/patient/p1');
  });
});

describe('answerFor: the default orientation', () => {
  it('offers a warm orientation with no action and no pretending', () => {
    const a = answerFor('hello there', ctx());
    expect(a.text).toContain('I can find what is already in Hearth');
    expect(a.action).toBeUndefined();
    expect(a.text.toLowerCase()).not.toContain('doctor');
    expect(a.text.toLowerCase()).not.toContain('diagnos');
  });
});
