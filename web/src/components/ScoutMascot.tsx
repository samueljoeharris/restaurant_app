/**
 * Illustrated scout mascot for onboarding, auth, and empty states (geometric ScoutLogo stays the app mark).
 * Fox scout in the original illustrated art style — cap with compass badge, neckerchief, backpack,
 * open trail map. Hand-built flat-vector SVG; swap for commissioned art later by replacing the
 * markup below and keeping the ScoutMascot name/props so call sites don't change. (Issue #71)
 */
export function ScoutMascot({
  className,
  size = 160,
  alt = "Little Scout — your friendly fox scout with a trail map",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={alt}
    >
  {/* tail (behind torso, anchored at right hip) */}
  <path d="M262 400 Q300 372 330 330 Q356 290 352 240 Q350 216 336 202 Q344 232 330 268 Q312 310 276 344 Q254 364 240 372 L240 400 Z" fill="#E8862F"/>
  <path d="M352 240 Q350 216 336 202 Q340 220 334 244 Q344 244 352 240 Z" fill="#FDF3E3"/>

  {/* torso / shirt */}
  <path d="M120 400 Q118 300 152 272 Q180 252 200 252 Q220 252 248 272 Q282 300 280 400 Z" fill="#4FAEDC"/>
  <path d="M248 272 Q282 300 280 400 L240 400 Q252 320 236 280 Z" fill="#3E9CCB" opacity="0.55"/>

  {/* backpack straps (outboard so the kerchief doesn't cover them) */}
  <path d="M152 274 Q146 336 152 400 L172 400 Q166 336 170 268 Z" fill="#8C5F3C"/>
  <path d="M248 274 Q254 336 248 400 L228 400 Q234 336 230 268 Z" fill="#8C5F3C"/>
  <path d="M152 274 Q146 336 152 400 L158 400 Q152 336 158 272 Z" fill="#7A5233"/>
  <path d="M248 274 Q254 336 248 400 L242 400 Q248 336 242 272 Z" fill="#7A5233"/>
  <rect x="154" y="322" width="16" height="11" rx="2" fill="#5C4126"/>
  <rect x="230" y="322" width="16" height="11" rx="2" fill="#5C4126"/>

  {/* neckerchief: rolled band + hanging triangle + knot */}
  <path d="M156 256 Q200 282 244 256 L248 268 Q200 296 152 268 Z" fill="#F5A544"/>
  <path d="M156 256 Q200 282 244 256 Q200 278 156 256 Z" fill="#E8912F"/>
  <path d="M176 270 L224 270 L204 330 Q200 336 196 330 Z" fill="#F5A544"/>
  <path d="M176 270 L224 270 L217 290 L183 290 Z" fill="#E8912F" opacity="0.7"/>
  <ellipse cx="200" cy="276" rx="10" ry="8" fill="#E8912F"/>

  {/* ears */}
  <path d="M124 108 Q112 58 122 34 Q150 52 166 92 Z" fill="#E8862F"/>
  <path d="M131 96 Q124 64 128 48 Q146 62 154 88 Z" fill="#4A3527"/>
  <path d="M276 108 Q288 58 278 34 Q250 52 234 92 Z" fill="#E8862F"/>
  <path d="M269 96 Q276 64 272 48 Q254 62 246 88 Z" fill="#4A3527"/>

  {/* head */}
  <path d="M200 88 Q262 88 272 148 Q278 190 258 218 Q234 248 200 248 Q166 248 142 218 Q122 190 128 148 Q138 88 200 88 Z" fill="#F0913F"/>
  <path d="M142 190 Q118 196 108 212 Q128 218 146 214 Q138 204 142 190 Z" fill="#F0913F"/>
  <path d="M258 190 Q282 196 292 212 Q272 218 254 214 Q262 204 258 190 Z" fill="#F0913F"/>
  <path d="M258 120 Q272 150 268 180 Q262 214 240 232 Q260 208 262 170 Q263 140 252 116 Z" fill="#DE7E2F" opacity="0.6"/>

  {/* muzzle */}
  <path d="M200 160 Q238 162 240 196 Q240 226 200 232 Q160 226 160 196 Q162 162 200 160 Z" fill="#FDF3E3"/>
  <path d="M191 186 Q200 181 209 186 Q209 196 200 199 Q191 196 191 186 Z" fill="#3A2E24"/>
  <path d="M200 199 L200 208 Q193 216 185 212" stroke="#3A2E24" strokeWidth="3" fill="none" strokeLinecap="round"/>
  <path d="M200 208 Q207 216 215 212" stroke="#3A2E24" strokeWidth="3" fill="none" strokeLinecap="round"/>

  {/* eyes + brows */}
  <ellipse cx="168" cy="156" rx="9" ry="10" fill="#3A2E24"/>
  <ellipse cx="232" cy="156" rx="9" ry="10" fill="#3A2E24"/>
  <circle cx="165" cy="152" r="3" fill="#FFFFFF"/>
  <circle cx="229" cy="152" r="3" fill="#FFFFFF"/>
  <path d="M156 138 Q166 132 176 136" stroke="#DE7E2F" strokeWidth="4" fill="none" strokeLinecap="round"/>
  <path d="M224 136 Q234 132 244 138" stroke="#DE7E2F" strokeWidth="4" fill="none" strokeLinecap="round"/>

  {/* cap */}
  <path d="M130 106 Q136 52 200 50 Q264 52 270 106 Q236 92 200 92 Q164 92 130 106 Z" fill="#45A8D9"/>
  <path d="M200 50 Q264 52 270 106 Q252 98 232 95 Q238 62 200 50 Z" fill="#3893C2"/>
  <path d="M122 104 Q200 76 278 104 Q282 112 276 116 Q200 92 124 116 Q118 112 122 104 Z" fill="#3893C2"/>
  <circle cx="200" cy="74" r="13" fill="#F7B04A"/>
  <circle cx="200" cy="74" r="9" fill="#FDF3E3"/>
  <path d="M200 67 L203 74 L200 81 L197 74 Z" fill="#E05744"/>

  {/* arms + map */}
  <path d="M132 296 Q120 330 138 352 Q150 362 164 356 L180 340 L156 300 Z" fill="#4FAEDC"/>
  <path d="M268 296 Q280 330 262 352 Q250 362 236 356 L220 340 L244 300 Z" fill="#3E9CCB"/>
  <path d="M148 330 L196 316 L204 316 L252 330 L252 392 L204 378 L196 378 L148 392 Z" fill="#F4EFDC"/>
  <path d="M196 316 L204 316 L204 378 L196 378 Z" fill="#E4DCC4"/>
  <path d="M148 330 L196 316 L196 378 L148 392 Z" fill="#EFE8D2"/>
  <path d="M156 344 Q170 336 184 342 L184 362 Q168 356 156 364 Z" fill="#BCD4A2"/>
  <path d="M214 340 Q228 334 242 342 L242 360 Q228 352 214 358 Z" fill="#BCD4A2"/>
  <path d="M160 380 Q186 360 210 356 Q228 352 236 340" stroke="#E08A50" strokeWidth="3" fill="none" strokeDasharray="6 6" strokeLinecap="round"/>
  <path d="M236 326 Q244 326 244 334 Q244 340 236 348 Q228 340 228 334 Q228 326 236 326 Z" fill="#E05744"/>
  <circle cx="236" cy="333" r="3" fill="#FDF3E3"/>
  <path d="M150 336 Q140 340 142 350 Q146 358 156 354 L162 348 L158 336 Z" fill="#F0913F"/>
  <path d="M250 336 Q260 340 258 350 Q254 358 244 354 L238 348 L242 336 Z" fill="#E8862F"/>
    </svg>
  );
}
