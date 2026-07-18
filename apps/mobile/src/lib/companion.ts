/**
 * The Hearth Companion brain: a pure, local answer function. No model, no
 * network, no database imports; the chat screen assembles a small context
 * snapshot from the repos and this module turns a question into a calm,
 * honest answer about what is already in Hearth. It never diagnoses,
 * never doses, and never pretends to be a clinician or an LLM.
 *
 * Safety invariant: any emergency-sounding message answers with the 911
 * line FIRST, before anything else, no matter what other keywords appear.
 */

export interface CompanionAction {
  label: string;
  route: string;
}

export interface CompanionAnswer {
  text: string;
  action?: CompanionAction;
}

export interface CompanionCtx {
  /** Everyone in the care circle, with their record route. */
  people: { name: string; route: string }[];
  /** Medication runways that need attention, tightest first. */
  worstRunways: { patient: string; med: string; daysRemaining: number; route: string }[];
  /** The soonest scheduled visit, if any. */
  nextVisit: { patientName: string; provider: string; whenLine: string; route: string } | null;
}

const GET_THERE_LINE =
  'The Get there section of the visit sheet covers rides: rideshare, paratransit, and NEMT booking windows.';

/** "2 days", "1 day", "has run out": plain sentences, no jargon. */
function runwaySentence(r: CompanionCtx['worstRunways'][number]): string {
  if (r.daysRemaining <= 0) return `${r.patient}'s ${r.med} has run out.`;
  const days = r.daysRemaining === 1 ? '1 day' : `${r.daysRemaining} days`;
  return `${r.patient}'s ${r.med} has ${days} left.`;
}

function listNames(people: CompanionCtx['people']): string {
  const names = people.map((p) => p.name);
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
}

export function answerFor(text: string, ctx: CompanionCtx): CompanionAnswer {
  const t = text.toLowerCase();
  const asks = (re: RegExp) => re.test(t);

  // The 911-first rule: emergencies outrank every other match.
  if (asks(/fall|choke|bleed|stroke|confus|emergency|\ber\b|\b911\b/)) {
    return {
      text:
        'If this is happening right now, call 911.\n' +
        'The emergency guides walk through six situations in four calm steps each, and they work with no signal.',
      action: { label: 'Open the emergency guides', route: '/guides' },
    };
  }

  if (asks(/refill|medication|run out|supply/)) {
    if (ctx.worstRunways.length === 0) {
      return {
        text:
          'No refills are running low right now. When a fill is logged, Hearth counts the days of supply down and lists the tightest ones here.',
      };
    }
    const worst = [...ctx.worstRunways].sort((a, b) => a.daysRemaining - b.daysRemaining);
    const top = worst.slice(0, 3);
    return {
      text: top.map(runwaySentence).join(' '),
      action: { label: `Open ${top[0]!.patient}'s record`, route: top[0]!.route },
    };
  }

  if (asks(/appointment|visit|ride|transport|get there|uber|\bbus\b/)) {
    if (ctx.nextVisit) {
      const v = ctx.nextVisit;
      return {
        text: `${v.patientName} sees ${v.provider} ${v.whenLine}. ${GET_THERE_LINE}`,
        action: { label: 'Open the visit sheet', route: v.route },
      };
    }
    return {
      text: `No visits are on the calendar right now. ${GET_THERE_LINE}`,
      action: { label: 'Open appointments', route: '/appointments' },
    };
  }

  if (asks(/scan|label|bottle/)) {
    return {
      text:
        'Point the camera at a medication bottle and Hearth reads the label: name, strength, and fill details. You confirm every field before anything is saved.',
      action: { label: 'Open the scanner', route: '/scan' },
    };
  }

  if (asks(/paper|insurance|denial|appeal|hipaa|release|letter/)) {
    return {
      text:
        'The paperwork tools assemble denial appeals, renewals, and HIPAA release requests from what is already on file. You review every fact before anything goes out.',
      action: { label: 'Open paperwork tools', route: '/workflows' },
    };
  }

  if (asks(/\bwho\b|circle|people/)) {
    if (ctx.people.length === 0) {
      return {
        text: 'Nobody is in the circle yet. Add the first person you care for and Hearth starts organizing around them.',
        action: { label: 'Add a person', route: '/patient/new' },
      };
    }
    return {
      text: `You are caring for ${listNames(ctx.people)}. Open a record for medications, visits, and documents.`,
      action: { label: `Open ${ctx.people[0]!.name}'s record`, route: ctx.people[0]!.route },
    };
  }

  // Default: a warm orientation, honest about what this is and is not.
  return {
    text:
      'I can find what is already in Hearth: refill runways, the next visit and how to get there, the emergency guides, and the paperwork tools. Ask in plain words, like "what refills are due" or "how do we get to the visit".',
  };
}
