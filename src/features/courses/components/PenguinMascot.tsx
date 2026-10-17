const themeColor = 'var(--accent, #63556B)'
type PenguinExpression = 'happy' | 'wink' | 'excited' | 'curious'

interface PenguinMascotProps { expression: PenguinExpression; dance?: boolean }

export function PenguinMascot({ expression, dance = false }: PenguinMascotProps) {
  return <svg className={`question-encouragement-vector penguin-mascot is-${expression}${dance ? ' is-dancing' : ''}`} viewBox="0 0 180 180" fill="none" aria-hidden="true">
    <ellipse cx="90" cy="161" rx="55" ry="8" fill="#E7D5DF" />
    <g className="penguin-character">
    <path className="penguin-wing penguin-wing-left" d="M52 80C35 72 18 68 13 76c-5 9 16 35 42 44l13-19L52 80Z" fill={themeColor} stroke="#352941" strokeWidth="4" strokeLinejoin="round" />
    <path className="penguin-wing penguin-wing-right" d="M128 80c17-8 34-12 39-4 5 9-16 35-42 44l-13-19 16-21Z" fill={themeColor} stroke="#352941" strokeWidth="4" strokeLinejoin="round" />
    <path className="penguin-body" d="M90 22c-36 0-61 30-61 71v28c0 29 24 43 61 43s61-14 61-43V93c0-41-25-71-61-71Z" fill={themeColor} stroke="#352941" strokeWidth="4" />
    <path className="penguin-body penguin-tuft" d="M82 27c-6-16-2-23 3-23 4 0 8 8 8 14 3-8 10-12 14-8 5 4 0 13-11 18" fill={themeColor} stroke="#352941" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M90 49c-28 0-45 25-45 57v18c0 22 17 32 45 32s45-10 45-32v-18c0-32-17-57-45-57Z" fill="#FFFDFC" />
    <path d="M53 74c3-19 17-33 37-33s34 14 37 33c-10-10-19-14-27-13-4 1-7 5-10 10-3-5-6-9-10-10-8-1-17 3-27 13Z" fill="#FFFDFC" />
    {expression === 'wink' ? <><path d="M59 83c6 5 13 5 19 0" stroke="#30233A" strokeWidth="5" strokeLinecap="round" /><ellipse className="penguin-eye" cx="111" cy="82" rx="11" ry="16" fill="#30233A" /><ellipse cx="108" cy="77" rx="3.5" ry="5" fill="white" /></> : <><ellipse className="penguin-eye" cx="69" cy="82" rx={expression === 'excited' ? 12 : expression === 'curious' ? 9 : 11} ry={expression === 'excited' ? 18 : expression === 'curious' ? 13 : 16} fill="#30233A" /><ellipse className="penguin-eye" cx="111" cy="82" rx={expression === 'excited' ? 12 : expression === 'curious' ? 9 : 11} ry={expression === 'excited' ? 18 : expression === 'curious' ? 13 : 16} fill="#30233A" /><ellipse cx="66" cy="77" rx="3.5" ry="5" fill="white" /><ellipse cx="108" cy="77" rx="3.5" ry="5" fill="white" /></>}
    <path d="m80 95 10-11 10 11-10 6-10-6Z" fill="#F2A42C" stroke="#352941" strokeWidth="3" strokeLinejoin="round" /><path d="m84 100 6 1 6-1c-1 7-4 10-6 10s-5-3-6-10Z" fill="#D65677" stroke="#352941" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M70 155c-10 2-17 10-16 15 2 5 11 4 19-2 7 7 15 5 17 0-2-6-10-11-20-13Z" fill="#F4B22F" stroke="#352941" strokeWidth="3" strokeLinejoin="round" /><path d="M110 155c10 2 17 10 16 15-2 5-11 4-19-2-7 7-15 5-17 0 2-6 10-11 20-13Z" fill="#F4B22F" stroke="#352941" strokeWidth="3" strokeLinejoin="round" />
    </g>
  </svg>
}
