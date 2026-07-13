/**
 * Bundled emergency guides. Plain, clinically conservative first-aid steps
 * with small line pictograms, available offline. Content is versioned and
 * carries an honest review status until a clinician has signed off.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type GuideStep = {
  n: number;
  title: string;
  body: string;
  Art: React.FC<{ size?: number }>;
};

export type Guide = {
  id: string;
  title: string;
  oneLiner: string;
  callFirst: boolean;
  steps: GuideStep[];
  warning?: string;
  review: { version: string; reviewer: string; reviewedOn: string };
};

/* ---------- pictogram plumbing ---------- */

const INK = '#1D1D1F';
const RED = '#C4362F';

/** Shared stroke style for every pictogram line. */
const P = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

/** Small red accent strokes, used sparingly (a phone, a warning mark). */
const R = {
  stroke: RED,
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
} as const;

function Frame({
  size = 56,
  children,
}: {
  size?: number | undefined;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {children}
    </Svg>
  );
}

/* ---------- fall ---------- */

/** Person lying on the floor. */
const FallArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Line x1={6} y1={54} x2={58} y2={54} {...P} />
    <Circle cx={13} cy={47} r={5} {...P} />
    <Path d="M19 48 L38 48" {...P} />
    <Path d="M38 48 L48 43" {...P} />
    <Path d="M38 48 L50 51" {...P} />
    <Path d="M26 48 L30 40" {...P} />
  </Frame>
);

/** Helper kneeling beside the person, hand reaching to them. */
const FallArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Line x1={6} y1={56} x2={58} y2={56} {...P} />
    <Circle cx={13} cy={51} r={4} {...P} />
    <Path d="M18 52 L32 52" {...P} />
    <Circle cx={45} cy={22} r={5} {...P} />
    <Path d="M45 27 L45 40" {...P} />
    <Path d="M45 40 L53 44 L53 52" {...P} />
    <Path d="M45 40 L41 50" {...P} />
    <Path d="M45 31 L34 44" {...P} />
  </Frame>
);

/** Phone with a red medical cross on the screen. */
const FallArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={22} y={10} width={20} height={38} rx={5} {...P} />
    <Line x1={29} y1={42} x2={35} y2={42} {...P} />
    <Line x1={32} y1={21} x2={32} y2={31} {...R} />
    <Line x1={27} y1={26} x2={37} y2={26} {...R} />
  </Frame>
);

/** Sturdy chair with a slow rise arrow. */
const FallArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Path d="M20 14 L20 50" {...P} />
    <Path d="M20 38 L42 38 L42 50" {...P} />
    <Path d="M26 38 L26 50" {...P} />
    <Path d="M52 40 L52 22" {...P} />
    <Path d="M47 27 L52 22 L57 27" {...P} />
  </Frame>
);

/* ---------- choking ---------- */

/** Person with both hands at the throat, the universal choking sign. */
const ChokingArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={14} r={6} {...P} />
    <Path d="M32 20 L32 42" {...P} />
    <Path d="M32 42 L24 55" {...P} />
    <Path d="M32 42 L40 55" {...P} />
    <Path d="M18 34 L24 26 L28 23" {...P} />
    <Path d="M46 34 L40 26 L36 23" {...P} />
  </Frame>
);

/** Person bent forward, a firm blow landing between the shoulder blades. */
const ChokingArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={15} cy={28} r={5} {...P} />
    <Path d="M20 31 L36 40" {...P} />
    <Path d="M36 40 L36 55" {...P} />
    <Path d="M36 40 L43 54" {...P} />
    <Path d="M25 34 L22 44" {...P} />
    <Path d="M52 14 L42 27" {...P} />
    <Path d="M42 27 L44 19" {...P} />
    <Path d="M42 27 L50 24" {...P} />
  </Frame>
);

/** Helper behind the person, fist placed above the navel. */
const ChokingArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={25} cy={13} r={5} {...P} />
    <Path d="M25 18 L25 42" {...P} />
    <Path d="M25 42 L19 55" {...P} />
    <Path d="M25 42 L31 55" {...P} />
    <Circle cx={45} cy={19} r={5} {...P} />
    <Path d="M45 24 L41 42" {...P} />
    <Path d="M41 42 L36 55" {...P} />
    <Path d="M44 29 C36 27 31 29 28 31" {...P} />
    <Circle cx={27} cy={32} r={2.5} {...P} />
  </Frame>
);

/** Phone with a red urgency mark. */
const ChokingArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={22} y={10} width={20} height={38} rx={5} {...P} />
    <Line x1={29} y1={42} x2={35} y2={42} {...P} />
    <Line x1={32} y1={19} x2={32} y2={29} {...R} />
    <Circle cx={32} cy={35} r={1.6} fill={RED} />
  </Frame>
);

/* ---------- stroke ---------- */

/** Face with one side drooping. */
const StrokeArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={32} r={17} {...P} />
    <Circle cx={25} cy={27} r={1.8} fill={INK} />
    <Circle cx={39} cy={30} r={1.8} fill={INK} />
    <Path d="M24 39 C28 40 34 43 40 46" {...P} />
  </Frame>
);

/** One arm raised, the other drifting down. */
const StrokeArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={13} r={5.5} {...P} />
    <Path d="M32 19 L32 42" {...P} />
    <Path d="M32 25 L17 13" {...P} />
    <Path d="M32 25 L45 36" {...P} />
    <Path d="M49 40 L49 48" {...P} />
    <Path d="M46 45 L49 48 L52 45" {...P} />
    <Path d="M32 42 L25 55" {...P} />
    <Path d="M32 42 L39 55" {...P} />
  </Frame>
);

/** Speech bubble with a garbled line inside. */
const StrokeArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={10} y={12} width={44} height={26} rx={6} {...P} />
    <Path d="M22 38 L18 48 L30 38" {...P} />
    <Path d="M18 25 Q21 20 24 25 T30 25 T36 25 T42 25" {...P} />
  </Frame>
);

/** Clock, because the start time matters. */
const StrokeArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={32} r={17} {...P} />
    <Path d="M32 22 L32 32 L41 37" {...P} />
    <Path d="M32 17 L32 19" {...P} />
    <Path d="M47 32 L45 32" {...P} />
  </Frame>
);

/* ---------- chest pain ---------- */

/** Phone with red call waves, dial first. */
const ChestArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={18} y={10} width={20} height={38} rx={5} {...P} />
    <Line x1={25} y1={42} x2={31} y2={42} {...P} />
    <Path d="M44 22 C48 26 48 32 44 36" {...R} />
    <Path d="M48 16 C55 23 55 35 48 42" {...R} />
  </Frame>
);

/** Person seated on a chair, resting. */
const ChestArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={27} cy={15} r={5} {...P} />
    <Path d="M27 20 L27 37" {...P} />
    <Path d="M27 37 L39 37 L39 53" {...P} />
    <Path d="M27 26 L35 32" {...P} />
    <Path d="M19 17 L19 41 L45 41" {...P} />
    <Path d="M45 41 L45 53" {...P} />
    <Path d="M23 41 L23 53" {...P} />
  </Frame>
);

/** Scored tablet with a question mark, ask before giving. */
const ChestArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={26} cy={36} r={10} {...P} />
    <Line x1={17.5} y1={36} x2={34.5} y2={36} {...P} />
    <Path d="M42 18 C42 13 52 13 52 18 C52 22 47 22 47 27" {...P} />
    <Circle cx={47} cy={33} r={1.8} fill={INK} />
  </Frame>
);

/** Two figures together, a hand resting on a shoulder. */
const ChestArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={22} cy={17} r={5} {...P} />
    <Path d="M22 22 L22 42" {...P} />
    <Path d="M22 42 L16 55" {...P} />
    <Path d="M22 42 L28 55" {...P} />
    <Circle cx={44} cy={15} r={5} {...P} />
    <Path d="M44 20 L44 42" {...P} />
    <Path d="M44 42 L38 55" {...P} />
    <Path d="M44 42 L50 55" {...P} />
    <Path d="M44 25 L29 23" {...P} />
  </Frame>
);

/* ---------- bleeding ---------- */

/** Cloth pad pressed onto a forearm. */
const BleedingArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Path d="M8 42 L36 42 C42 42 42 52 36 52 L8 52" {...P} />
    <Rect x={18} y={33} width={16} height={9} rx={2.5} {...P} />
    <Path d="M26 14 L26 28" {...P} />
    <Path d="M21 23 L26 28 L31 23" {...P} />
  </Frame>
);

/** A second cloth layered on top, pressure kept on. */
const BleedingArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={18} y={38} width={28} height={10} rx={3} {...P} />
    <Rect x={22} y={30} width={20} height={8} rx={3} {...P} />
    <Path d="M32 8 L32 24" {...P} />
    <Path d="M26 18 L32 24 L38 18" {...P} />
  </Frame>
);

/** Arm raised above the heart. */
const BleedingArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={26} cy={22} r={5.5} {...P} />
    <Path d="M26 28 L26 46" {...P} />
    <Path d="M26 46 L19 56" {...P} />
    <Path d="M26 46 L33 56" {...P} />
    <Path d="M26 32 L42 17" {...P} />
    <Path d="M50 26 L50 12" {...P} />
    <Path d="M45 17 L50 12 L55 17" {...P} />
  </Frame>
);

/** Phone with a red drop, call when bleeding will not slow. */
const BleedingArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={17} y={10} width={20} height={38} rx={5} {...P} />
    <Line x1={24} y1={42} x2={30} y2={42} {...P} />
    <Path d="M48 22 C44 28 42 31 42 34 A6 6 0 0 0 54 34 C54 31 52 28 48 22" {...R} />
  </Frame>
);

/* ---------- confusion ---------- */

/** Head with a swirl, sudden confusion. */
const ConfusionArt1: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={26} r={13} {...P} />
    <Path d="M32 33 a4 4 0 0 1 -4 -4 a5.5 5.5 0 0 1 5.5 -5.5 a7 7 0 0 1 6.5 7" {...P} />
    <Path d="M16 52 Q32 44 48 52" {...P} />
  </Frame>
);

/** Thermometer, check for fever. */
const ConfusionArt2: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={29} y={8} width={6} height={34} rx={3} {...P} />
    <Circle cx={32} cy={49} r={7} {...P} />
    <Circle cx={32} cy={49} r={3} fill={RED} />
    <Line x1={32} y1={45} x2={32} y2={22} {...R} />
    <Line x1={39} y1={16} x2={43} y2={16} {...P} />
    <Line x1={39} y1={24} x2={43} y2={24} {...P} />
    <Line x1={39} y1={32} x2={43} y2={32} {...P} />
  </Frame>
);

/** Water glass, offer a drink. */
const ConfusionArt3: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Path d="M22 12 L26 52 L38 52 L42 12" {...P} />
    <Line x1={24} y1={28} x2={40} y2={28} {...P} />
  </Frame>
);

/** Med list on a clipboard, ready for the call. */
const ConfusionArt4: React.FC<{ size?: number }> = ({ size }) => (
  <Frame size={size}>
    <Rect x={17} y={10} width={30} height={44} rx={4} {...P} />
    <Rect x={26} y={6} width={12} height={8} rx={2} {...P} />
    <Line x1={24} y1={24} x2={40} y2={24} {...P} />
    <Line x1={24} y1={32} x2={40} y2={32} {...P} />
    <Line x1={24} y1={40} x2={40} y2={40} {...P} />
  </Frame>
);

/* ---------- guides ---------- */

const REVIEW = {
  version: '0.9',
  reviewer: 'Pending clinician review',
  reviewedOn: '2026-07-13',
} as const;

export const GUIDES: Guide[] = [
  {
    id: 'fall',
    title: 'After a fall',
    oneLiner: 'What to do when someone has fallen',
    callFirst: false,
    steps: [
      {
        n: 1,
        title: 'Keep them still at first',
        body: 'Do not rush to lift them. Ask if anything hurts and whether they hit their head.',
        Art: FallArt1,
      },
      {
        n: 2,
        title: 'Check before moving',
        body: 'Look for bleeding, swelling, or a limb at an odd angle. If they have severe pain or cannot move, keep them still and call 911.',
        Art: FallArt2,
      },
      {
        n: 3,
        title: 'Call if they hit their head',
        body: 'If they hit their head, call their clinician or 911, especially if they take a blood thinner. A head hit on a blood thinner needs medical review even if they seem fine.',
        Art: FallArt3,
      },
      {
        n: 4,
        title: 'Help them up slowly',
        body: 'If they are uninjured, take it slow. Have them roll to their side, get to hands and knees, and rise using a sturdy chair.',
        Art: FallArt4,
      },
    ],
    warning:
      'If they take a blood thinner and hit their head, treat it as urgent even if they seem fine.',
    review: REVIEW,
  },
  {
    id: 'choking',
    title: 'Choking',
    oneLiner: 'When someone cannot clear their airway',
    callFirst: true,
    steps: [
      {
        n: 1,
        title: 'See if they can cough',
        body: 'Ask if they are choking. If they can cough or speak, encourage them to keep coughing and stay with them.',
        Art: ChokingArt1,
      },
      {
        n: 2,
        title: 'Give 5 back blows',
        body: 'If they cannot cough, speak, or breathe, lean them forward. Give 5 firm blows between the shoulder blades with the heel of your hand.',
        Art: ChokingArt2,
      },
      {
        n: 3,
        title: 'Give 5 abdominal thrusts',
        body: 'If back blows do not work, stand behind them. Place a fist just above the navel, grasp it with your other hand, and pull sharply inward and upward 5 times.',
        Art: ChokingArt3,
      },
      {
        n: 4,
        title: 'Call 911 and keep going',
        body: 'Call 911 if the object does not come out or they cannot breathe. Keep alternating 5 back blows and 5 thrusts until help arrives.',
        Art: ChokingArt4,
      },
    ],
    review: REVIEW,
  },
  {
    id: 'stroke',
    title: 'Possible stroke',
    oneLiner: 'Use the FAST check and act quickly',
    callFirst: true,
    steps: [
      {
        n: 1,
        title: 'Face',
        body: 'Ask them to smile. Look for one side of the face drooping.',
        Art: StrokeArt1,
      },
      {
        n: 2,
        title: 'Arms',
        body: 'Ask them to raise both arms. Watch for one arm drifting down or feeling weak.',
        Art: StrokeArt2,
      },
      {
        n: 3,
        title: 'Speech',
        body: 'Ask them to repeat a simple sentence. Listen for slurred or strange words.',
        Art: StrokeArt3,
      },
      {
        n: 4,
        title: 'Time',
        body: 'If any sign is present, call 911 now and note the time symptoms started. Do not drive them yourself.',
        Art: StrokeArt4,
      },
    ],
    review: REVIEW,
  },
  {
    id: 'chest-pain',
    title: 'Chest pain',
    oneLiner: 'Pressure or pain in the chest is an emergency',
    callFirst: true,
    steps: [
      {
        n: 1,
        title: 'Call 911 first',
        body: 'Call 911 before anything else. Do not wait to see if the pain passes, and do not drive them yourself.',
        Art: ChestArt1,
      },
      {
        n: 2,
        title: 'Keep them seated and calm',
        body: 'Help them sit down and rest. A half-sitting position with knees bent is often most comfortable.',
        Art: ChestArt2,
      },
      {
        n: 3,
        title: 'Ask before giving aspirin',
        body: 'Do not give aspirin unless the 911 dispatcher or their own clinician says to. Follow their instructions exactly.',
        Art: ChestArt3,
      },
      {
        n: 4,
        title: 'Stay with them',
        body: 'Loosen tight clothing and stay close. If they become unresponsive, tell the dispatcher right away.',
        Art: ChestArt4,
      },
    ],
    review: REVIEW,
  },
  {
    id: 'bleeding',
    title: 'Serious bleeding',
    oneLiner: 'Steady pressure controls most bleeding',
    callFirst: true,
    steps: [
      {
        n: 1,
        title: 'Press firmly',
        body: 'Press hard on the wound with a clean cloth or bandage. Keep the pressure steady and continuous.',
        Art: BleedingArt1,
      },
      {
        n: 2,
        title: 'Do not peek',
        body: 'Do not lift the cloth to check the wound. If blood soaks through, add more cloth on top and keep pressing.',
        Art: BleedingArt2,
      },
      {
        n: 3,
        title: 'Raise the limb',
        body: 'If the wound is on an arm or leg, raise it above the level of the heart while you keep pressing.',
        Art: BleedingArt3,
      },
      {
        n: 4,
        title: 'Call 911 if it will not slow',
        body: 'Call 911 if bleeding is heavy, spurting, or does not slow after 10 minutes of pressure. Tell them if the person takes a blood thinner.',
        Art: BleedingArt4,
      },
    ],
    warning: 'Blood thinners make bleeding harder to stop. Call 911 sooner if they take one.',
    review: REVIEW,
  },
  {
    id: 'confusion',
    title: 'Sudden confusion',
    oneLiner: 'New confusion is a medical warning sign',
    callFirst: false,
    steps: [
      {
        n: 1,
        title: 'Take it seriously',
        body: 'Confusion that is new or sudden is urgent. It is not a normal part of aging.',
        Art: ConfusionArt1,
      },
      {
        n: 2,
        title: 'Check for fever and injury',
        body: 'Take their temperature if you can. Look them over for signs of injury, especially a recent fall or head bump.',
        Art: ConfusionArt2,
      },
      {
        n: 3,
        title: 'Keep them safe and offer water',
        body: 'Stay with them somewhere calm and offer a drink of water. Dehydration and infections are common causes.',
        Art: ConfusionArt3,
      },
      {
        n: 4,
        title: 'Call with the med list ready',
        body: 'Call their clinician today, or 911 if they are hard to wake or getting worse. Have the med list ready when you call.',
        Art: ConfusionArt4,
      },
    ],
    review: REVIEW,
  },
];
