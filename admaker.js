// ══════════════════════════════════════════════════════════════
//  BRAND OS · AD Maker  (v10.5)
//  變更紀錄:
//    [v10.5] ★ 整合 CMAP 動態擴充
//             - fetchAndMergeBrandPacksFromGAS 載入後自動呼叫
//               registerBrandPackColors(packs) 注入 CMAP
//             - 之後 GAS brands.navColor='brand_xxx' 就能生效
//    [v10.3] ★ 加 gas_brand_packs_fetch + 5 分鐘快取
//             - BRAND_STYLE_PACKS 改成 let 可動態覆蓋
//             - GAS 失敗自動 fallback 內建預設
//    [v10.2] ★ 5 版式骨架系統 (LAYOUT_TEMPLATES)
//             - 雜誌封面型 / 規格分解型 / 情境寫真型 / 戲劇飛濺型 / 極簡海報型
//    [v10.2] ★ 品牌風格包 (BRAND_STYLE_PACKS)
//             - 巧福 CF 墨綠美學 / 咖啡店日系 / LACEZ 法式精品 / RADESIGN 街頭
//             - 沒匹配到品牌時走 default_clean
//    [v10.2] ★ 重組 buildPosterPrompt:版式 × 品牌包 × 風土 × 情境 四維合成
//    [v10.2] ★ 修 bug:setPrMode 切到 gpt_poster 清乾淨靈感鍵選中狀態
//    [v10.2] ★ UI:風格靈感區改為「版式骨架 + 風土調味」二段式選擇
//    [v10.1] 8 靈感鍵 + GPT Image 2 edit 模式(保留作備援)
//    [v10.1] 海報→5秒影片 (Kling v2.1)
//    [v9.1] 字體系統 + 場景擴增
// ══════════════════════════════════════════════════════════════

const PRESERVE_SUBJECT =
  'CRITICAL: Do NOT modify any product, person body proportions, clothing details, or accessories. Keep all subjects pixel-perfect identical to the original. Only modify the background, environment, and ambient lighting.';

const FACE_LOCK =
  ' ULTRA CRITICAL FACE LOCK: The person face must be 100% identical to the original - preserve exact eye shape and position, nose shape, mouth shape, jawline, cheekbones, face proportions, skin tone, freckles, moles, eyebrows, and all micro facial features. Treat the face as a protected frozen region that MUST NOT be regenerated or altered in any way. The person must look like the exact same individual.';

const NO_ASIAN_TEXT =
  ' STRICTLY NO Chinese, Japanese, Korean, or any East Asian characters anywhere in the image. Use ONLY English letters, numbers, or pure abstract neon shapes and glowing light patterns. Any visible signage must be in clear English only or be non-textual light glows.';

const COMMERCIAL_CONTEXT =
  'Professional commercial product advertisement, mainstream retail catalog photography, ' +
  'acceptable for major retailers and department stores. ';

const CAM_DEFAULT = 'Shot on Nikon Z9 NIKKOR Z 24-70mm f/2.8 S.';
const CAM_PORTRAIT = 'Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8.';
const CAM_MACRO = 'Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S.';

// ★ v11.1 設計師工法層 (DESIGNER_POLISH) — 具體反 AI 指紋版(相機/佈光 + 品類 + 單一促銷 + 真材質),風格分流、不碰選定風格
const DESIGNER_POLISH =
'Output must look like REAL human-made work, never an AI render. ' +
'For PHOTOGRAPHIC styles: render as real professional photography — shot on a pro body (Nikon Z9 / Sony A1 / Canon R5) with a real lens (35mm or 50mm prime for scenes, 85mm for portraits, macro for food and product detail), professional lighting setup (softbox key plus natural fill), realistic depth of field, true-to-life materials and micro-texture; avoid the over-glossy, over-smooth, over-symmetrical AI-render sheen. ' +
'For ILLUSTRATION, ink or graphic styles: execute in the authentic medium (real ink, paint, print, collage texture) with a human designer hand, not slick AI gradients. ' +
'Decoration must fit the product category logically (seaweed uses ocean / wave / seaweed motifs, NOT wheat or coffee; tech uses clean studio; food uses real ingredients) — no off-category or meaningless symbols. ' +
'Keep only ONE primary promotional message; never repeat the same discount or event across multiple badges. ' +
'All text must be real, meaningful and correctly spelled; supporting icons form ONE cohesive set with identical weight and detail. ' +
'ONE clear focal hierarchy on a deliberate grid, intentional and edited, never over-filled.';

// ═══════════════════════════════════════════════════════════════════════
//  v10.2 ★ PRODUCT_SCENES (情境生成模式專用,維持 v9.1 原樣)
// ═══════════════════════════════════════════════════════════════════════
const PRODUCT_SCENES = {
  studio_white:
    `${COMMERCIAL_CONTEXT}Replace the entire background with a clean seamless white studio backdrop, subtle gradient from bright white at top to soft grey shadow at base. Professional commercial product photography lighting with soft directional key light from upper left. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/8, studio strobe.`,

  dark_luxury:
    `${COMMERCIAL_CONTEXT}Replace the background with a rich deep charcoal-to-black gradient (NOT pure black void - keep it visible and atmospheric). Add strong warm golden rim lighting wrapping around the product and subject edges, plus a soft key light from upper left to keep the subject clearly illuminated and well-exposed. The overall image must remain BRIGHT and READABLE - the face and product must be clearly visible. Luxury magazine advertisement aesthetic with rich golden highlights. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, dramatic but well-lit.`,

  marble_premium:
    `${COMMERCIAL_CONTEXT}Replace the scene: foreground surface becomes polished Italian Calacatta marble with natural grey veining, background becomes dark charcoal gradient wall. Add warm golden accent rim lighting from upper right. Luxury product photography aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  minimal_grey:
    `${COMMERCIAL_CONTEXT}Replace the background with a smooth light-to-medium grey seamless gradient, no texture. Soft diffused softbox lighting from above creating gentle shadow beneath product. Minimalist Scandinavian aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  forest_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a lush atmospheric forest scene. Choose a natural variation: either Japanese cedar with morning mist, or temperate deciduous forest with autumn light, or tropical jungle with dense green foliage. Dappled golden sunlight filtering through canopy creating bokeh highlights. Visible depth with blurred trees in far background. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/2.8, shallow depth of field.`,

  night_city:
    `${COMMERCIAL_CONTEXT}Replace the background with a cinematic futuristic night cityscape. Blurred abstract neon light streaks and glowing orbs in warm orange, cool blue, electric magenta, and cyan creating rich bokeh. Wet reflective street surface if visible. Cyberpunk atmospheric haze with colored fog. Neon rim light naturally illuminating product and subject edges.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/1.4, heavy bokeh.`,

  lifestyle_home:
    `${COMMERCIAL_CONTEXT}Replace the scene with a warm Scandinavian home interior. Aged light oak wooden surface in foreground, soft-focus background showing white linen curtains with morning sunlight filtering through, hint of potted green plants. Warm 4000K natural lighting, cozy hygge atmosphere. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.`,

  tech_space:
    `${COMMERCIAL_CONTEXT}Replace the background with a deep space atmosphere. Earth curvature softly glowing at lower horizon, dark cosmic backdrop with subtle star field, purple-to-blue atmospheric gradient rim light. Flagship tech product photography aesthetic, clean futuristic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  fashion_minimal:
    `${COMMERCIAL_CONTEXT}Replace the background with clean off-white to warm beige seamless studio gradient. Soft natural light from large window on the left creating gentle falloff. High-end fashion editorial aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_PORTRAIT}`,

  fashion_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a golden hour urban or natural street scene. Choose a natural variation: either European cobblestone alley, or New York SoHo brownstone, or Parisian boulevard, or London South Bank, or California palm-lined street. Warm backlight creating natural halo, bokeh environment.${NO_ASIAN_TEXT} Editorial lifestyle fashion aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.`,

  pet_home:
    `${COMMERCIAL_CONTEXT}Replace the scene with a warm cozy home interior. Light wood floor with natural grain, soft-focus background of white walls with hanging green plants, morning window light from the side creating warm highlights. Gentle 4500K ambient atmosphere. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/2.8.`,

  pet_outdoor:
    `${COMMERCIAL_CONTEXT}Replace the background with a sunny outdoor park scene. Fresh bright green grass foreground, blurred trees and soft sunlight flares in background, natural daylight from upper left. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2.8, bokeh background.`,

  yoga_zen:
    `${COMMERCIAL_CONTEXT}Replace the scene with a serene Japanese zen environment. Choose a variation: either a tatami room with shoji paper screens and soft diffused morning light, or an outdoor bamboo garden with stone path, or a minimal rock garden with raked sand. Peaceful atmospheric. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  wellness_bright:
    `${COMMERCIAL_CONTEXT}Replace the scene with a bright airy wellness studio. Large floor-to-ceiling windows with soft natural morning sunlight streaming in, white walls with subtle shadow of green plants, light wood or white floor. Fresh minimalist wellness aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT}`,

  snack_playful:
    `${COMMERCIAL_CONTEXT}Replace the background with a bold colorful flat surface. Choose a variation: either bright warm yellow, or coral pink, or mint green, or vibrant turquoise. Add playful scattered ingredient props (nuts, fruit slices, splashes) arranged artistically. Bright fun commercial food photography. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_MACRO}`,

  sport_energy:
    `${COMMERCIAL_CONTEXT}Replace the background with a bold dynamic gradient. Choose a variation: deep navy to electric orange, or black to neon green, or crimson to gold. Add subtle motion blur lines, energetic atmospheric haze. Athletic commercial photography aesthetic. ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 70-200mm f/2.8 S.`,

  jewelry_dark:
    `${COMMERCIAL_CONTEXT}Replace the background with pure black velvet texture. Add single dramatic overhead spotlight creating strong focused beam, subtle teal-blue reflection on dark polished glass surface below. Luxury jewelry photography aesthetic. Keep the product EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/5.6, high-key contrast.`,

  design_editorial:
    `${COMMERCIAL_CONTEXT}Replace the scene with a minimalist editorial design magazine aesthetic. Soft off-white paper-textured background with subtle beige and sage green tones, warm natural window light from the side. Add subtle design elements like thin decorative lines and delicate paper grain texture. Clean asymmetric composition with generous negative space, Kinfolk magazine aesthetic, Japanese editorial design influence. Muted desaturated color palette.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_PORTRAIT}`,

  summer_hot:
    `${COMMERCIAL_CONTEXT}Replace the background with a vibrant hot summer scene. Choose a natural variation: either a sunny tropical beach with turquoise water and palm tree shadows, or a poolside with crystal blue water and bright white tiles, or a bright summer garden with cicada-loud greenery and flare highlights. Intense golden sunlight creating strong warm highlights, visible sun flare, shimmering heat haze. Saturated tropical color palette with azure blues, sun yellows, and coral pinks. Refreshing atmospheric feel. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright summer daylight.`,

  tropical_resort:
    `${COMMERCIAL_CONTEXT}Swimwear and beach lifestyle photography. Replace the background with a luxurious tropical resort beach scene. Choose from: Maldives overwater villa deck with crystal turquoise water, or Bali private beach with white sand and coconut palms, or Phuket infinity pool edge with ocean horizon. Warm golden afternoon sunlight, gentle ocean breeze atmosphere, soft palm shadow patterns. Sophisticated resort wear catalog aesthetic, similar to Victoria's Secret Swim campaign or Seafolly lookbook. Saturated azure and teal ocean tones, warm sand neutrals. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright resort daylight.`,

  poolside_luxe:
    `${COMMERCIAL_CONTEXT}Poolside swimwear editorial photography. Replace the background with a modern luxury villa poolside scene. Choose from: Beverly Hills modernist villa pool with white stone deck and tropical plants, or Miami Art Deco hotel poolside with pastel blue tiles, or LA Hollywood Hills pool with city view in background. Bright midday sunlight creating sparkling water reflections and crisp shadows, clean minimal architecture, turquoise pool water. High-end swimwear campaign aesthetic like La Perla or Eres catalog. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/5.6, sharp bright daylight.`,

  okinawa_beach:
    `${COMMERCIAL_CONTEXT}Okinawa beach resort morning lifestyle photography, swimwear and beachwear aesthetic. Replace the background with an authentic Okinawa beach scene. Choose from: Okinawa main island Emerald Beach with white coral sand and turquoise ocean at sunrise, or Ishigaki Island beach with coconut palm trees silhouettes against pastel morning sky, or Miyakojima beach with crystal clear shallow water reflecting soft pink dawn clouds. Gentle morning sunlight with soft warm glow, tropical sea breeze atmosphere, subtle pastel color palette (pale blue, coral pink, warm cream). Luxury Japanese resort magazine aesthetic like LEON or CLASSY, or Ryokan Rinka-Iwa campaign. Include subtle props: a white beach towel on pale wood deck, a shell. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, soft morning daylight.`,

  bali_sunrise:
    `${COMMERCIAL_CONTEXT}Bali sunrise beach resort swimwear lifestyle photography. Replace the background with a picturesque Bali beach scene. Choose from: Uluwatu cliff edge with infinity ocean view and golden sunrise rays, or Nusa Dua private beach with white sand and distant palm grove silhouettes, or Seminyak beach deck with sea-facing daybed and early morning golden haze. Warm tropical golden hour lighting, lens flare from rising sun, saturated warm tones (amber gold, teal ocean, coral sky). High-end tropical resort campaign aesthetic like COMO Shambhala or Bulgari Bali lookbook. Soft atmospheric haze, palm frond shadows. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, warm sunrise light.`,

  japan_premium:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into premium Japanese wabi-sabi aesthetic. Replace surface with aged hinoki cypress wood or dark charcoal stone slate, replace background with soft washi paper texture or blurred shoji screen with warm interior light behind. Add subtle Japanese design elements: a small ceramic tea cup in the far background bokeh, a single dried branch or bamboo leaf. Soft diffused side lighting 4000K, low saturation, muted earth tones (beige, sumi black, soft green), contemplative mono-no-aware atmosphere.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/2.`,

  kpop_korea:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into trendy Korean K-POP music video aesthetic. Replace background with a dreamy gradient of pastel pink, lavender purple, and soft sky blue, with subtle sparkle bokeh and soft neon light streaks. Add Y2K-inspired elements: subtle holographic light flares, soft pink and blue rim lighting on product and subject edges, dreamy atmospheric glow. High-key bright exposure, glossy aesthetic, youthful Seoul fashion magazine vibe.${NO_ASIAN_TEXT} ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 50mm f/1.2 S, f/1.8, dreamy bokeh.`,

  american_wild:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into American wild west / Route 66 aesthetic. Replace background with a vast dramatic landscape: choose from either Arizona red rock desert at golden hour, or Texas highway with dusty horizon and lens flare, or Californian canyon with rugged cliffs. Warm amber-orange sunset lighting with long dramatic shadows, slight dust haze atmosphere, vintage film grain texture. Masculine rugged aesthetic, Marlboro campaign influence, cinematic wide depth. Slightly desaturated cinematic color grade (teal shadows, orange highlights). ${PRESERVE_SUBJECT}${FACE_LOCK} Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S, f/5.6, sweeping landscape.`,

  hk_banquet_gold:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into Hong Kong top-tier Cantonese banquet aesthetic (Fook Lam Moon / Lung King Heen level). Replace surface with pristine white tablecloth with delicate gold trim embroidery, replace background with softly blurred warm amber interior showing hints of gold filigree wall panels and red lacquered details. Add an elegant Chinese porcelain tea set and a pair of ivory chopsticks with gold tips as subtle props. Warm golden chandelier lighting from above (3000K), creating a bright luxurious atmosphere - the dish must be clearly lit and visible, NOT dark or moody. Rich gold and deep red color palette, Michelin banquet magazine aesthetic, business-entertainment dining class. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/4, bright and luxurious.`,

  tw_retro_ad:
    `${COMMERCIAL_CONTEXT}Transform the entire scene into authentic 1970s-1980s Taiwanese print advertisement aesthetic. Replace background with a warmly-lit vintage Taiwanese living room scene: floral-patterned fabric sofa in soft focus, terrazzo floor tiles, wooden venetian blinds with late afternoon golden sunlight creating dappled dramatic shadows, a glass of iced barley tea on a round wooden side table as prop. Warm sepia-amber color grading with slightly faded highlights, visible paper grain texture overlay, subtle film halation, Kodachrome film tones, soft edge vignetting. Looks like a scanned vintage magazine page from 1975 Taiwan. Nostalgic warm mood. ${PRESERVE_SUBJECT}${FACE_LOCK} ${CAM_DEFAULT} f/2.8, warm vintage film look.`,

  food_drama:
    `${COMMERCIAL_CONTEXT}Transform the scene into a Michelin 3-star restaurant advertisement. Replace background with deep charcoal gradient (not pure black), replace surface with dark slate. Add dramatic single overhead spotlight from above, atmospheric steam wisps rising from food, warm golden rim light on dish edges. The food must remain BRIGHT and clearly visible. Keep all food, dishes, and hands EXACTLY unchanged in position and details. ${CAM_DEFAULT} f/4, dramatic but well-lit.`,

  food_japanese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Japanese kappo fine dining aesthetic. Replace surface with dark charcoal aged stone slate with rough texture, replace background with deep shadowed wood wall. Soft single-source cool side lighting 4000K, wabi-sabi minimal atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_MACRO}`,

  food_cantonese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Hong Kong Cantonese banquet aesthetic. Replace surface with dark lacquered rosewood table, replace background with deep red-gold wall with subtle abstract pattern. Warm amber pendant light from above creating rich golden glow, traditional opulent atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_DEFAULT}`,

  food_korean:
    `${COMMERCIAL_CONTEXT}Transform the scene into Korean BBQ restaurant atmosphere. Replace surface with dark volcanic stone or cast iron plate, replace background with moody dark wood with hint of charcoal grill glow. Dramatic warm backlight from behind creating orange-red rim glow on food edges, atmospheric steam. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  food_taiwanese:
    `${COMMERCIAL_CONTEXT}Transform the scene into Taiwanese traditional comfort food aesthetic. Replace surface with warm aged teak wood table with natural grain, replace background with blurred vintage tile wall or wooden partition. Soft 3800K tungsten overhead light creating warm nostalgic glow, traditional ceramic tea cup and chopsticks as props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,

  food_french:
    `${COMMERCIAL_CONTEXT}Transform the scene into French fine dining editorial. Replace surface with deep navy blue linen tablecloth, replace background with soft blurred restaurant ambience. Add silver cutlery and crystal glassware as props, soft cool natural window light 5500K creating clean elegant atmosphere. Keep all food, dishes, and hands EXACTLY unchanged. ${CAM_MACRO}`,

  food_outdoor:
    `${COMMERCIAL_CONTEXT}Transform the scene into an outdoor golden hour picnic. Replace surface with rustic wooden board or checkered cloth on grass, replace background with natural green meadow with warm sunset backlight creating halo. Rustic wooden utensil props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 85mm f/1.4 S, f/2, shallow depth.`,

  food_bright:
    `${COMMERCIAL_CONTEXT}Transform the scene into bright Nordic brunch aesthetic. Replace surface with clean white Carrara marble, replace background with bright white wall with soft natural morning window light 6000K streaming from the side. Add fresh herb sprigs and citrus slice props. Keep all food, dishes, and hands EXACTLY unchanged. Shot on Nikon Z9 NIKKOR Z 35mm f/1.8 S.`,
};


// ═══════════════════════════════════════════════════════════════════════
// ★ v10.2 核心:5 版式骨架 (LAYOUT_TEMPLATES)
//   每個版式描述「畫面長什麼樣」——商品位置 / 文字位置 / 裝飾元素 / 構圖規則
//   不寫死美感(那部分由 BRAND_STYLE_PACKS 注入)
// ═══════════════════════════════════════════════════════════════════════
const LAYOUT_TEMPLATES = {
  // 1. 雜誌封面型 (圖 2 BREW / 巧福串圖-05 致敬)
  magazine_cover: {
    label: '雜誌封面型',
    desc: '人物+商品+大字標題+引言區,封面雜誌排版',
    composition: `Editorial magazine cover composition layout:
- Top-left corner: large display title in elegant typography (the headline)
- Upper area: small kicker text or category label above the title
- Right or center area: the product placed as hero focal point with the model interacting naturally
- Mid-left or bottom: short body paragraph (3-4 lines) describing the product story
- Bottom strip: brand signature, issue/season label, and category tags
- Generous negative space (35-45% empty area) for breathing room
- Asymmetric grid layout, magazine spread feel
- Use a real magazine layout grid, NOT a poster collage
Reference aesthetic: Japanese lifestyle magazines (BRUTUS, &Premium, POPEYE), Kinfolk editorial spreads`
  },

  // 2. 規格分解型 (圖 3 COCONUT MILK / 巧福串圖-04 編號功能 / 巧福串圖-03 規格頁)
  spec_breakdown: {
    label: '規格分解型',
    desc: '商品+功能編號圈+規格說明,科普展示',
    composition: `Product spec breakdown layout:
- Center: the product placed prominently as hero
- Around the product: 4 numbered feature callouts (01, 02, 03, 04) in circular badges with thin connecting lines pointing to specific parts
- Each callout has a short feature title + 1-2 line description in small text
- Top: large product name or category title
- Bottom: technical specifications row (size, weight, power, color options) in clean horizontal layout
- Use thin elegant lines, small geometric icons, refined typography
- Could include exploded/floating ingredient or component visualization above the product
Reference aesthetic: Japanese food/appliance ad spreads (UCC, Muji), Tesla spec sheets, e-commerce detail pages`
  },

  // 3. 情境寫真型 (圖 4 椰子場景 / 圖 7 木頭+植物 / 巧福串圖-05 沙發場景)
  scene_lifestyle: {
    label: '情境寫真型',
    desc: '商品+情境道具+人物互動,生活場景',
    composition: `Lifestyle scene photography layout:
- Product placed naturally within a curated everyday scene
- Surround the product with thematically related supporting props (e.g. for fans: vintage radio, books, plants, ceramic vase, woven basket; for coffee: beans, cloth, fruit, ceramic cup)
- 45-degree elevated camera angle, shallow depth of field with bokeh background
- Soft natural directional window light from upper-left at 4000-5000K
- Optional: a model interacting with the product naturally (sitting beside, holding, looking at it)
- Title text overlaid on the upper third with generous space, body text on the side
- Brand mark small at bottom corner
- The scene must feel REAL, not staged — like a documentary lifestyle photo
Reference aesthetic: Kinfolk lifestyle photography, Muji homeware catalogs, Japanese living magazines`
  },

  // 4. 戲劇飛濺型 (圖 5 椰子飛濺 / 圖 3 上半部材料噴飛)
  dramatic_splash: {
    label: '戲劇飛濺型',
    desc: '商品懸浮+材料飛濺,動態爆發力',
    composition: `Dramatic splash hero photography layout:
- Product is the absolute center hero, visually prominent and razor-sharp
- Liquid splashes, ingredient particles, or component pieces frozen mid-air around the product as if exploding outward
- Optional: product appears to be floating or suspended (no visible support)
- Frozen high-speed motion: water droplets, splash crowns, particle bursts
- Dramatic single key light from one side creating strong rim lighting
- Atmospheric color saturation pumped up
- Background can be either a contextual nature scene (foliage, wood) or a clean gradient
- Minimal text — just a bold short product name on top, optional one-line tagline
- High contrast, cinematic punch
Reference aesthetic: Pinterest food photography hero shots, premium beverage commercials, Japanese drink ads`
  },

  // 5. 極簡海報型 (圖 6 Creamy Layer / 巧福串圖-05 大字版)
  minimal_poster: {
    label: '極簡海報型',
    desc: '商品大特寫+大字標題+極簡裝飾',
    composition: `Minimal poster layout:
- Product centered, slightly off-axis (rule of thirds), occupying 40-55% of vertical canvas
- Single large bold display headline (Serif or strong Sans) at top, 2 lines maximum
- Subtitle in smaller refined typography below headline
- Tiny brand logo signature at top-center or bottom-center
- Very minimal supporting elements: maybe a thin decorative line, a small icon, a price tag
- Bottom: 3-4 short product feature tags separated by middle-dots or thin vertical bars
- Generous negative space (50%+ empty)
- Soft natural directional lighting on product
- Background is plain or near-plain (single color wash, soft gradient, paper texture)
Reference aesthetic: Apple product posters, Blue Bottle Coffee posters, Muji store displays, Aesop magazine ads`
  }
};


// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// ★ v10.3 核心:品牌風格包 (BRAND_STYLE_PACKS)
// ═══════════════════════════════════════════════════════════════════════
let BRAND_STYLE_PACKS = {
  chiaofu: {
    matchKeywords: ['chiaofu', 'chiao fu', '巧福', 'chiao'],
    label: '巧福 CHIAO FU',
    dna: `BRAND VISUAL DNA — CHIAO FU (Taiwan Health Home Appliance — Suction-type Mosquito Trap & Retro Fan):
- Primary brand color: deep forest green #3D5A3F (used for headlines, footer bands, accent strokes, brand circular logo)
- Secondary palette: warm cream #F5EFE5, soft beige #E8DCC8, dusty terracotta #C49B7E, retro powder blue #A8C5D0
- Typography hierarchy: Traditional Chinese display headline in 明朝體 / Mincho Serif (large, refined, slightly squared); body copy in clean thin Sans (思源黑體 light); brand signature is the round "CHIAO FU" white-on-green logo
- Photography style: warm natural daylight from upper-left window, 4500-5500K, soft shadows, slight matte film texture (not glossy)
- Mood: nostalgic-modern Taiwan, Showa-era Taiwan domestic life, "old-but-renewed" feeling, quiet and gentle
- Decorative elements: thin horizontal divider lines (1-2px solid green), the round "CHIAO FU" logo mark centered at bottom on green band, modest paper grain texture overlay
- Background scenes: vintage Taiwanese home interior with mid-century furniture (Togo sofa, vinyl turntable, rattan, wooden parquet floor, framed retro posters), or sunlit Taiwanese countryside porch, or 1970s-style domestic still life with terrazzo floor
- Composition habit: large generous negative space (40-50%), bottom solid green band as footer with white round logo, headline text in deep forest green
- Product category specifics:
  · Suction-type mosquito trap (UC-700 / UC-800LED / UC-850LED): a quiet appliance that draws mosquitoes in by airflow — NOT an electric zapper, no purple light, no zapping sound. Position as "靜音 / 無電擊 / 全家安心" (silent / no electric shock / safe for the whole family). Show in domestic scenes (bedroom corner, living room, baby room).
  · Rechargeable mosquito swatter (UC-723): handheld, modern but quiet positioning.
  · Retro fan (寶島復古電風): hero product, Showa-modern positioning.
- AVOID: neon colors, electric zapper imagery (purple-light bug zappers), buzzing/electricity FX, sharp tech aesthetics, cluttered layouts, glossy plastic feel, anything that looks like an industrial pesticide product
`
  },

  ka_yoga: {
    matchKeywords: ['ka', '空瑪那', 'kamana', 'yoga', '瑜珈', '瑜伽'],
    label: '空瑪那 KA 瑜珈',
    dna: `BRAND VISUAL DNA — KA (Yoga Studio / Wellness):
- Primary palette: warm sand #E8DCC8, soft sage #B5C5A8, deep pine #4A5D4A, accent terracotta #C49B7E
- Secondary: ivory cream #F5EFE8, dusty mauve #B8A8B0
- Typography: refined Serif headline (Cormorant Garamond / Playfair) for English + 思源宋體 Light for Chinese; lots of letter-spacing; calligraphy-feel for accent words
- Photography style: soft directional natural daylight from large window, 4500-5500K, low contrast, slight film grain, hands and body in graceful posture
- Mood: contemplative, breathing, slow, Japanese-Korean-Indian wellness fusion (lululemon × Aesop × Ryokan)
- Decorative elements: thin botanical line illustrations (lotus, branches), Sanskrit mantra characters as background watermark texture, wooden mala bead props, ceramic incense holder, single dried flower
- Background scenes: minimalist yoga studio with light oak floor and white walls, traditional tatami room with shoji screens, Japanese garden stone path with moss, candle-lit retreat space, sunrise mountain meditation deck
- Composition habit: vertical breathing space, headline placed mid-upper third, body copy in narrow column, generous 50%+ negative space, asymmetric off-center balance
- AVOID: neon, harsh contrast, hyperactive layouts, fitness gym aesthetic (this is yoga not crossfit), overtly sexy poses, kitsch cartoon
`
  },

  raby_coffee: {
    matchKeywords: ['raby', '咖啡', 'coffee', 'cafe', 'daylight'],
    label: 'RABY 咖啡日系',
    dna: `BRAND VISUAL DNA — Coffee Lifestyle (Japanese-Korean Hybrid):
- Primary palette: warm ivory #F5EBD9, soft sage #B5C5A8, pottery brown #8B6F4E, accent gold #C9A665
- Secondary: dusty pink #E8C8B8, deep coffee #3D2418
- Typography: serif display headline in English (Playfair Display / Cormorant) + 思源宋體 Traditional Chinese; small caps for category labels; refined Italic for taglines
- Photography style: golden hour natural side window light, 4000K warm tone, shallow DOF f/1.8-f/2.8, slight grain
- Mood: Kinfolk magazine, Japanese ryokan morning, Korean OliveYoung clean café
- Decorative elements: thin botanical line illustrations, small dried-flower motifs, ceramic cup props, hand-drawn underlines, decorative middle-dots, vol. number badges
- Background scenes: Japanese wooden café interior with shoji screens, Korean modern minimal café with cream walls, Taiwanese 老屋 daylight café with terrazzo and oak
- Composition habit: layered text columns (left-text right-image), magazine kicker labels, generous breathing space
- AVOID: cluttered, oversaturated, hard-tech, neon
`
  },

  lacez: {
    matchKeywords: ['lacez', '內衣', 'lingerie', 'underwear'],
    label: 'LACEZ 法式精品',
    dna: `BRAND VISUAL DNA — LACEZ (Lingerie):
- Primary palette: dusty rose #E5C4C0, ivory cream #F5EFE8, champagne nude #DDC4A8, deep wine #722F2E
- Secondary: soft taupe #B8A89E, gold accent #C9A665
- Typography: elegant Serif italic for headlines (Cormorant Italic / Playfair); 思源宋體 light for Chinese; refined small caps; lots of letter-spacing
- Photography style: soft window-shaded daylight, low contrast, faint film grain, skin-warm tones
- Mood: La Perla / Eres / French boudoir editorial, intimate elegance, NEVER overtly sexual or aggressive
- Decorative elements: silk ribbon graphics, thin gold lines, lace texture overlays, French phrases
- Background scenes: Parisian apartment morning light, ivory linen drapery, marble dresser, mirror reflections
- Composition habit: portrait orientation, ample negative space, headline often italicized
- AVOID: neon, retro Y2K, masculine sharp tech, comedy/cute
`
  },

  radesign: {
    matchKeywords: ['radesign', 'ra design', '鞋', 'shoe', 'sneaker', 'outlet'],
    label: 'RADESIGN 街頭潮',
    dna: `BRAND VISUAL DNA — RADESIGN (Footwear / Street):
- Primary palette: charcoal black #1A1A1B, off-white #F0EDE5, asphalt grey #4A4A4D, accent neon orange #FF6A2A
- Secondary: warm tan #C49B7E, dusty olive #6B7A4E
- Typography: bold condensed Sans Serif (Bebas Neue / Helvetica Inserat / 思源黑體 Heavy); large numerical price/model treatment; underlined category tags
- Photography style: high contrast, slightly desaturated, urban concrete textures, golden-hour street light or fluorescent gym light
- Mood: AAPE / HUMAN MADE / New Balance MADE / Carhartt WIP, Tokyo Harajuku street, raw and lived-in
- Decorative elements: tape graphics, dotted reference grids, model number stamps, hand-drawn arrows, retro athletic department badges
- Background scenes: Tokyo back-alley wet asphalt, vintage gymnasium wood floor, brutalist concrete wall, NY SoHo cobblestone, Taipei night-market texture
- Composition habit: dynamic asymmetric, often diagonal axis, large model number as decorative element
- AVOID: precious-looking, soft floral, romance, marble luxury
`
  },

  default_clean: {
    matchKeywords: [],
    label: '通用乾淨',
    dna: `BRAND VISUAL DNA — Clean Generic Commercial:
- Primary palette: soft off-white #F8F5F0, warm grey #B8B4A8, accent amber #C9A665
- Typography: clean Sans Serif (Inter / 思源黑體 Regular), restrained letter-spacing
- Photography style: bright soft daylight, neutral white balance, clean uncluttered
- Mood: modern e-commerce catalog, restrained and trustworthy
- Decorative elements: minimal, only thin lines and small icons
- Composition habit: centered or rule-of-thirds, balanced negative space
- AVOID: anything overly stylized
`
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ★ v10.2 風土調味 (REGIONAL_FLAVORS)
// ═══════════════════════════════════════════════════════════════════════
const REGIONAL_FLAVORS = {
  none: {
    label: '— 不加調味 —',
    flavor: ''
  },
  japan_kinfolk: {
    label: '🇯🇵 日系雅致',
    flavor: 'Add Japanese editorial flavor: muted earth tones, washi paper texture overlay, vertical Mincho serif feel, lots of negative space, single dried branch or ceramic vase prop in background bokeh, contemplative wabi-sabi atmosphere.'
  },
  korea_oliveyoung: {
    label: '🇰🇷 韓系乾淨',
    flavor: 'Add Korean beauty brand flavor: soft pastel ivory and dusty pink palette, very high-key bright exposure, glossy clean surfaces, holographic micro sparkles, dreamy soft-focus highlights, OliveYoung / Innisfree campaign vibe.'
  },
  showa_retro: {
    label: '昭和復古',
    flavor: 'Add 1970s Showa-era retro flavor: slight Kodachrome film grain, faded warm highlights, terrazzo floor or vintage wallpaper background, retro objects like turntables, rotary phones, glass bottles as props, sepia-amber color cast, soft vignetting at edges.'
  },
  retro_future_y2k: {
    label: '復古未來 Y2K',
    flavor: 'Add Y2K retro-futuristic flavor: chrome metallic highlights, holographic gradient backgrounds (purple to blue to pink), bubble-shaped soft UI elements, slight CRT scan lines, 2000s techno-optimism, soft glow halations.'
  },
  bold_clash_2026: {
    label: '2026 大膽撞色',
    flavor: 'Add 2026 trend bold color clashing flavor: high-saturation contrasting color pairs (electric blue + acid yellow, bubblegum pink + lime green, terracotta orange + cobalt), oversized typography, brutalist blocky layouts, intentional roughness.'
  },
  ugly_cute_2026: {
    label: '2026 醜萌',
    flavor: 'Add 2026 ugly-cute trend flavor: hand-drawn squiggly lines, intentionally awkward emoji-like decorations, mixed mismatched fonts, scrapbook-style pasted elements, casual snapshot energy, NewJeans-cover aesthetic.'
  },
  euro_editorial: {
    label: '🇪🇺 歐美雜誌',
    flavor: 'Add European editorial flavor: high contrast film tones, sharp Serif headlines (Playfair / Didot), confident large typography, minimalist graphic elements, Vogue / The Gentlewoman magazine sophistication.'
  },
  taiwan_nostalgia: {
    label: '🇹🇼 台式懷舊',
    flavor: 'Add Taiwanese nostalgia flavor: 1980s magazine paper grain, terrazzo floor, vintage Taiwanese tile patterns, faded poster colors (mustard, teal, brick), floral patterned fabric backgrounds, warm afternoon light through wooden venetian blinds.'
  },

  // ══ v11 新增:2026 設計風格 (25) ══
  bauhaus: {
    label: '🔴 包浩斯',
    flavor: 'Add Bauhaus design flavor: bold geometric blocks, circles and triangles in primary red/blue/yellow, strict grid-based composition, clean negative space, modernist sans-serif typography, flat color planes, balanced structural layout.'
  },
  chrome_futurism: {
    label: '鍍鉻未來',
    flavor: 'Add chrome futurism flavor: reflective liquid-metal chrome surfaces, silver and dark backdrop, high-contrast studio lighting, sci-fi luxury sheen, sleek modern typography, glossy premium product feel.'
  },
  neo_minimal: {
    label: '溫暖新極簡',
    flavor: 'Add warm neo-minimalism flavor: single hero subject in generous negative space, soft natural daylight, restrained palette with one warm accent, quiet-luxury calm, subtle paper or fabric texture, refined modern composition.'
  },
  architectural_min: {
    label: '建築極簡',
    flavor: 'Add architectural minimalism flavor: clean concrete and stone surfaces, sharp directional sunlight casting deep crisp shadows, monochrome or warm-grey palette, strong spatial geometry, precise lines, calm premium structure.'
  },
  experimental_type: {
    label: '實驗字體',
    flavor: 'Add experimental typography flavor: oversized distorted and overlapping headline text as the main visual, layered ink/spray/glitch textures, broken asymmetric grid, bold graphic tension, contemporary design-studio energy.'
  },
  cinematic_light: {
    label: '光影電影感',
    flavor: 'Add cinematic light flavor: a single dramatic beam of light on the subject, dark moody negative space around it, deep atmospheric shadows, film-poster tension, emotional minimal staging.'
  },
  gradient_glow: {
    label: '漸層光暈',
    flavor: 'Add gradient glow flavor: smooth vibrant gradient field (pink to blue to orange to purple), soft glowing abstract spheres, clean tech-minimal layout, futuristic typography, polished digital sheen.'
  },
  blurry_floral: {
    label: '模糊花卉',
    flavor: 'Add blurry floral flavor: soft-focus flowers melting into a dreamy grainy gradient, ethereal pastel haze, atmosphere over detail, delicate luminous mood, fine grain texture overlay.'
  },
  geometric_abstract: {
    label: '幾何抽象',
    flavor: 'Add geometric abstract flavor: circles, rectangles and lines in confident asymmetric composition, bold flat color accents, strong visual rhythm, controlled modern graphic structure.'
  },
  mono_contrast: {
    label: '黑白高對比',
    flavor: 'Add black-and-white high-contrast flavor: stark monochrome palette, torn-paper texture, bold condensed typography, dramatic light/dark separation, raw gritty editorial impact.'
  },
  natural_shadow: {
    label: '自然光影',
    flavor: 'Add natural light-and-shadow flavor: soft sunlight casting leaf or window shadows across a warm neutral wall, quiet lifestyle calm, subtle texture, refined minimal editorial tone.'
  },
  luxury_texture: {
    label: '輕奢質感',
    flavor: 'Add luxury-texture flavor: black and gold palette, premium material surfaces (marble, brushed metal, velvet), single dramatic spotlight, refined high-end beauty-campaign elegance.'
  },
  hand_doodle: {
    label: '手繪塗鴉',
    flavor: 'Add hand-drawn doodle flavor: sketchy black pen lines, playful handwritten text, raw paper texture, casual imperfect strokes, youthful energetic charm.'
  },
  collage_art: {
    label: '拼貼藝術',
    flavor: 'Add collage-art flavor: torn paper layers, mixed photo fragments, rough cut-and-paste textures, editorial vintage-modern hybrid, expressive layered contrast.'
  },
  line_art: {
    label: '〰️ 線描極簡',
    flavor: 'Add line-art minimal flavor: single continuous-line drawing or delicate abstract linework, neutral background, elegant negative space, calm gallery-poster refinement.'
  },
  pop_art: {
    label: '普普藝術',
    flavor: 'Add pop-art flavor: comic-style illustration, halftone dots, bold primary colors, playful retro energy, high-contrast graphic punch, iconic commercial pop look.'
  },
  acid_neon: {
    label: '🟢 螢光科技',
    flavor: 'Add acid neon flavor: fluorescent green and electric color clashes, surreal glossy 3D form, cyber-inspired composition, bold glow effects, edgy experimental energy.'
  },
  ink_zen: {
    label: '水墨禪意',
    flavor: 'Add ink-wash zen flavor: black sumi ink mountain or abstract stroke, rice-paper texture, calm minimal composition, poetic negative space, meditative East-Asian tone.'
  },
  chaos_pkg: {
    label: '混沌極繁',
    flavor: 'Add chaos / maximalist packaging flavor: loud clashing colors, playful display fonts, hand-drawn illustration and sticker elements, dense cut-and-paste layout, confident over-the-top personality.'
  },
  kinetic_3d: {
    label: '立體動態',
    flavor: 'Add 3D kinetic flavor: oversized sculptural 3D forms (giant spheres, twisted ribbons, liquid metal shapes), surreal depth, energetic motion feel, futuristic dimensional layout.'
  },
  scattered_layout: {
    label: '散布佈局',
    flavor: 'Add scattered-layout flavor: elements freely placed across the frame like a discovery map, playful non-linear arrangement, looks random but carefully balanced, experimental editorial feel.'
  },
  candid_film: {
    label: '真實膠卷',
    flavor: 'Add candid film-roll flavor: natural unretouched lighting, slightly imperfect snapshot framing, warm film-grain texture, real spontaneous everyday moment, anti-polished authenticity.'
  },
  trinket: {
    label: '收藏品式',
    flavor: 'Add trinket-collection flavor: objects arranged and numbered like museum specimens, neat grid of small items, nostalgic cataloguing charm, playful curated collector mood.'
  },
  blueprint: {
    label: '藍圖風格',
    flavor: 'Add blueprint flavor: object rendered as a precise white technical line-drawing on deep blue, engineering schematic labels and measurement lines, rigorous structural tech-aesthetic.'
  },
  surveillance: {
    label: '監控美學',
    flavor: 'Add surveillance-aesthetic flavor: machine-vision overlays, face-tracking frames, infrared/thermal color mapping, timestamped data grids, cold futuristic monitoring tone.'
  },
  future_medieval: {
    label: '未來中世紀',
    flavor: 'Add future-medieval flavor: mystical gothic symbols and blackletter type fused with digital patterns and AI-generated ornament, ornate layered florals, both ancient and futuristic ritual mood.'
  },

  // ══ v11 新增:標竿品牌風格 (7) ══
  brand_3coins: {
    label: '3COINS',
    flavor: 'Add 3COINS lifestyle flavor: bright airy Japanese variety-goods styling, soft fresh pastel palette, casual handwritten captions, neatly arranged everyday small items as a friendly life proposal.'
  },
  brand_uniqlo: {
    label: '🔴 UNIQLO',
    flavor: 'Add UNIQLO LifeWear flavor: clean minimal grid layout, product front-and-center on plain white, restrained palette with red/black accents, functional honest simplicity, large crisp product photography.'
  },
  brand_muji: {
    label: '無印良品',
    flavor: 'Add MUJI flavor: ultra-minimal no-brand calm, off-white and natural-wood tones, generous empty space, no decoration, soft even natural light, quiet honest materials.'
  },
  brand_beams: {
    label: 'BEAMS',
    flavor: 'Add BEAMS select-shop flavor: Japanese street-meets-refined styling, lively accent-color blocking, editorial collage energy, curated fashion-forward mix, confident youthful tone.'
  },
  brand_issey: {
    label: '三宅一生',
    flavor: 'Add Issey Miyake flavor: pleated sculptural structure, avant-garde minimalism, bold single-color planes, material and form experimentation, architectural fashion sophistication.'
  },
  brand_snowpeak: {
    label: 'Snow Peak',
    flavor: 'Add Snow Peak outdoor flavor: refined nature aesthetic, muted grey-green and earth tones, metal and raw-wood textures, calm functional craftsmanship, quiet premium outdoor mood.'
  },
  brand_plusd: {
    label: '+d',
    flavor: 'Add +d (h concept) flavor: playful Japanese everyday-object design, warm humorous kawaii spirit, simple clean form, single hero object on soft uplifting background, friendly product-still styling.'
  }
};


// ═══════════════════════════════════════════════════════════════════════
// ★ v10.2 情境主題 (CONTEXT_THEMES)
// ═══════════════════════════════════════════════════════════════════════
const CONTEXT_THEMES = {
  none: {
    label: '— 無 —',
    context: ''
  },
  summer: {
    label: '夏日',
    context: 'Summer season context: hot bright daylight, refreshing cool elements, outdoor or near-window setting, light fabric and glass textures.'
  },
  winter_cozy: {
    label: '冬日溫暖',
    context: 'Winter cozy context: warm indoor setting, soft yellow tungsten light, knit blanket textures, hot beverage prop, condensation on window.'
  },
  festive_cny: {
    label: '農曆新年',
    context: 'Lunar New Year festive context: subtle red and gold accent elements, hint of plum blossom or auspicious decoration in background bokeh, warm celebratory atmosphere — but keep it tasteful, NOT loud or kitschy.'
  },
  back_to_school: {
    label: '開學季',
    context: 'Back-to-school context: study desk setting, books and stationery as props, fresh autumn morning light, optimistic productive mood.'
  },
  unboxing: {
    label: '開箱時刻',
    context: 'Unboxing moment context: brand box and tissue paper visible, anticipation atmosphere, hands-in-frame interaction, the product just revealed.'
  },
  daily_use: {
    label: '日常使用',
    context: 'Everyday-use context: the product naturally integrated into a real daily scene (bedroom, kitchen, living room, work desk), no staged feel.'
  },
  promo_sale: {
    label: '限時促銷',
    context: 'Promotional sale context: include a small price tag or "限時優惠 EARLY BIRD" badge, clear call-to-action visual emphasis, but keep the design refined NOT garish.'
  },
  gift_giving: {
    label: '送禮場合',
    context: 'Gift-giving context: ribbon, wrapping paper, small card, two-hands-presenting gesture, intimate warm-toned scene.'
  },
  year_end_sale: {
    label: '年終特賣',
    context: 'Year-end mega sale context: bold festive red and gold sale energy, a clear "年終特賣 / YEAR-END SALE" badge, percentage-off price tags, abundant celebratory atmosphere with strong urgency — keep it punchy but still structured, not messy.'
  },
  double11: {
    label: '1️⃣1️⃣ 雙11',
    context: 'Double 11 shopping-festival context: high-energy e-commerce sale mood, vivid red and magenta, large "11.11" numerals, countdown and price-slash badges, bold urgent call-to-action — loud but clean composition.'
  }
};


// ═══════════════════════════════════════════════════════════════════════
//  v10.2 狀態
// ═══════════════════════════════════════════════════════════════════════
let AM = { w:1080, h:1080, scriptIdx:null };
let PR_BG_IMG  = null;
// 🆕 2026-08-08:預設模式改「懶人 AI 廣告圖」。
//   實務上使用者一進來就是要用這個,情境生成／真人試穿已在 index.html 隱藏
//   (只是 display:none,沒有刪掉 —— 之後有更強的 AI 再打開)。
let PR_MODE    = 'gpt_poster';
let TEXT_ALIGN = 'left';
let TEXT_FONT  = 'bold';
let CANVAS_TAINTED = false;
let LAST_BLOB_SIZE = 0;

let SELECTED_LAYOUT  = 'minimal_poster';
let SELECTED_FLAVOR  = 'none';
let SELECTED_CONTEXT = 'none';
let SELECTED_INSPIRATION = null;
let LAST_POSTER_URL = null;

const BLACK_IMAGE_THRESHOLD = 30000;


// ★ v10.5:從 worker 拿 GAS brand_packs
let _BRAND_PACKS_GAS_LOADED = false;
let _BRAND_PACKS_GAS_LOADING = false;
async function fetchAndMergeBrandPacksFromGAS() {
  if (_BRAND_PACKS_GAS_LOADED || _BRAND_PACKS_GAS_LOADING) return;
  _BRAND_PACKS_GAS_LOADING = true;
  try {
    const resp = await fetch(CF_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gas_brand_packs_fetch', password: GAS_PASSWORD }),
    });
    const data = await resp.json();
    if (!data.ok) {
      console.warn('[v10.5] GAS brand packs 載入失敗:', data.error, '— 維持使用內建預設');
      return;
    }
    if (!Array.isArray(data.packs) || data.packs.length === 0) {
      console.log('[v10.5] GAS 回傳空 brand_packs,維持內建預設');
      return;
    }

    if (typeof registerBrandPackColors === 'function') {
      registerBrandPackColors(data.packs);
    } else {
      console.warn('[v10.5] registerBrandPackColors 函式不存在,CMAP 不會被更新。請確認 config.js 已升級到 v10.5');
    }

    const merged = { ...BRAND_STYLE_PACKS };
    for (const p of data.packs) {
      if (!p.pack_key) continue;
      const dnaLines = [
        `BRAND VISUAL DNA — ${p.label || p.pack_key}:`,
        p.primary_color     ? `- Primary brand color: ${p.primary_color}` : '',
        p.secondary_palette ? `- Secondary palette: ${p.secondary_palette}` : '',
        p.typography        ? `- Typography: ${p.typography}` : '',
        p.photography_style ? `- Photography style: ${p.photography_style}` : '',
        p.mood              ? `- Mood: ${p.mood}` : '',
        p.decorative_elements ? `- Decorative elements: ${p.decorative_elements}` : '',
        p.scenes            ? `- Background scenes: ${p.scenes}` : '',
        p.composition_habit ? `- Composition habit: ${p.composition_habit}` : '',
        p.avoid             ? `- AVOID: ${p.avoid}` : '',
      ].filter(Boolean);

      merged[p.pack_key] = {
        matchKeywords: Array.isArray(p.matchKeywords) ? p.matchKeywords : [],
        label: p.label || p.pack_key,
        dna: dnaLines.join('\n') + '\n',
        _source: 'gas',
      };
    }
    BRAND_STYLE_PACKS = merged;
    _BRAND_PACKS_GAS_LOADED = true;

    const gasCount = data.packs.length;
    const totalCount = Object.keys(BRAND_STYLE_PACKS).length;
    console.log(`[v10.5] ✅ 已從 GAS 載入 ${gasCount} 個品牌包,當前總計 ${totalCount} 個 (含 default_clean)`);
    if (data.cached) console.log(`[v10.5] (worker cache hit, age=${data.cache_age_sec}s)`);

    try { updateBrandPackBadge(); } catch(_) {}
  } catch (e) {
    console.warn('[v10.5] GAS brand packs 載入錯誤:', e.message, '— 維持使用內建預設');
  } finally {
    _BRAND_PACKS_GAS_LOADING = false;
  }
}


function detectBrandPack() {
  const brand = window.BRANDS?.find(b => b.id === window.S?.brandId);
  if (!brand) return BRAND_STYLE_PACKS.default_clean;
  const haystack = `${brand.id || ''} ${brand.name || ''} ${brand.label || ''}`.toLowerCase().trim();
  if (!haystack) return BRAND_STYLE_PACKS.default_clean;

  const matchPairs = [];
  for (const [key, pack] of Object.entries(BRAND_STYLE_PACKS)) {
    if (key === 'default_clean') continue;
    for (const kw of pack.matchKeywords) {
      matchPairs.push({ pack, keyword: kw.toLowerCase() });
    }
  }
  matchPairs.sort((a, b) => b.keyword.length - a.keyword.length);

  const isChinese = (s) => /[\u4e00-\u9fff]/.test(s);

  for (const { pack, keyword } of matchPairs) {
    let hit = false;
    if (isChinese(keyword)) {
      hit = haystack.includes(keyword);
    } else {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      hit = regex.test(haystack);
    }
    if (hit) {
      console.log('[v10.2.1] 命中品牌包:', pack.label, '(關鍵字:', keyword, '· haystack:', haystack, ')');
      return pack;
    }
  }
  console.log('[v10.2.1] 未命中任何品牌包,走 default_clean (haystack:', haystack, ')');
  return BRAND_STYLE_PACKS.default_clean;
}


// ═══════════════════════════════════════════════════════════════════════
//  v9.x 原樣保留
// ═══════════════════════════════════════════════════════════════════════
function openAdMaker(idx) {
  PR_BG_IMG = null; PR_MODE = 'gpt_poster';   // 🆕 2026-08-08:開啟編輯器就是懶人模式
  CANVAS_TAINTED = false;
  setPrStatus('', '');

  fetchAndMergeBrandPacksFromGAS();

  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  // 🆕 2026-08-08:亮起「懶人 AI 廣告圖」那顆,不再是第一顆(第一顆已隱藏)。
  //   用 id 找,找不到才退回第一顆 → index.html 還沒更新也不會壞。
  (document.getElementById('prModeGpt') || document.querySelector('.pr-mode-btn'))?.classList.add('on');
  ['prSceneSection','prVirtualSection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';        // 🆕 兩個舊模式的設定區一律收起
  });
  const gpt = document.getElementById('prGptPosterSection');
  if (gpt) gpt.style.display = 'block';       // 🆕 直接展開懶人模式的設定區
  // 懶人模式的預設選取狀態(照抄 setPrMode 的 gpt_poster 分支)
  if (typeof updateBrandPackBadge === 'function') updateBrandPackBadge();
  document.querySelector(`.layout-btn[data-layout="${SELECTED_LAYOUT}"]`)?.classList.add('on');
  document.querySelector(`.flavor-btn[data-flavor="${SELECTED_FLAVOR}"]`)?.classList.add('on');
  document.querySelector(`.context-btn[data-context="${SELECTED_CONTEXT}"]`)?.classList.add('on');

  let initialTitle = '';
  if (idx === -1 || idx == null || !window.S.scripts?.[idx]) {
    AM.scriptIdx = -1;
  } else {
    const s = window.S.scripts[idx];
    AM.scriptIdx = idx;
    initialTitle = s.hook?.script || '';
  }

  // 🆕 2026-08-08:amTitle 已從 index.html 移除(手動打字跟「懶人」定位相反)。
  //   ⚠️ 這行原本沒有 ?. —— 元素不在就會噴 null,整個編輯器打不開。
  //   保留賦值是為了「哪天想把輸入框加回來」時不用再改這裡。
  const _amTitleEl = document.getElementById('amTitle');
  if (_amTitleEl) _amTitleEl.value = initialTitle;
  document.getElementById('prCustomPrompt').value = '';
  renderAmPhotoRow();
  updateBrandPackBadge();
  document.getElementById('adMakerModal').style.display = 'block';
  if (typeof setVisionStage === 'function') setVisionStage(2);
  renderAdCanvas();
}

function closeAdMaker() {
  document.getElementById('adMakerModal').style.display = 'none';
  if (typeof setVisionStage === 'function') setVisionStage(1);
}

function renderAmPhotoRow() {
  const row = document.getElementById('amPhotoThumbRow');
  const nameEl = document.getElementById('amPhotoName');
  if (!row) return;
  if (!window.S.photos.length) {
    row.innerHTML = '<span style="font-size:10px;color:var(--t3);">請先到右側抓取照片</span>';
    if (nameEl) nameEl.textContent = '⚠️ 尚未選擇';
    return;
  }
  row.innerHTML = window.S.photos.map((f, i) => {
    const isSelected = window.S.selPhoto === i;
    const thumb = f.src || f.thumb;
    const imgHtml = thumb
      ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:contain;border-radius:3px;">`
      : '<span style="font-size:16px;"></span>';
    return `<div onclick="selectPhotoInAM(${i})" title="${f.name}"
      style="width:36px;height:36px;border-radius:5px;overflow:hidden;flex-shrink:0;cursor:pointer;
             border:2px solid ${isSelected?'#C9A665':'rgba(255,255,255,0.1)'};background:var(--bg4);
             display:flex;align-items:center;justify-content:center;">${imgHtml}</div>`;
  }).join('');
  if (nameEl) nameEl.textContent = window.S.selPhoto !== null
    ? ('✅ ' + window.S.photos[window.S.selPhoto].name)
    : '← 點選上方照片';
}

function selectPhotoInAM(i) {
  window.S.selPhoto = i; PR_BG_IMG = null;
  CANVAS_TAINTED = false;
  renderAmPhotoRow(); renderAssets(); renderAdCanvas();
}

function onMdPhotoSelected(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1500;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h*MAX/w); w = MAX; }
        else { w = Math.round(w*MAX/h); h = MAX; }
      }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const mdImg = document.getElementById('mdPhotoImg');
      const placeholder = document.getElementById('mdPhotoPlaceholder');
      if (mdImg) { mdImg.src = canvas.toDataURL('image/jpeg',0.85); mdImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setPrMode(btn, mode) {
  document.querySelectorAll('.pr-mode-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on'); PR_MODE = mode;
  document.getElementById('prSceneSection').style.display     = mode === 'product_shot' ? 'block' : 'none';
  document.getElementById('prVirtualSection').style.display   = mode === 'kling_tryon'  ? 'block' : 'none';
  const gpt = document.getElementById('prGptPosterSection');
  if (gpt) gpt.style.display = mode === 'gpt_poster' ? 'block' : 'none';

  if (mode !== 'gpt_poster') {
    SELECTED_INSPIRATION = null;
    document.querySelectorAll('.insp-btn').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.flavor-btn').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.context-btn').forEach(b => b.classList.remove('on'));
  }
  if (mode === 'gpt_poster') {
    updateBrandPackBadge();
    document.querySelector(`.layout-btn[data-layout="${SELECTED_LAYOUT}"]`)?.classList.add('on');
    document.querySelector(`.flavor-btn[data-flavor="${SELECTED_FLAVOR}"]`)?.classList.add('on');
    document.querySelector(`.context-btn[data-context="${SELECTED_CONTEXT}"]`)?.classList.add('on');
  }
}

function setPrScene(btn, scene) {
  document.querySelectorAll('#prSceneSection .pr-scene-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('prSceneSection').dataset.scene = scene;
}

function setTextAlign(align, btn) {
  TEXT_ALIGN = align;
  ['alignLeft','alignCenter','alignRight'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  btn.classList.add('on'); renderAdCanvas();
}

function setTextFont(fontKey, btn) {
  TEXT_FONT = fontKey;
  ['fontBold','fontSerif','fontLight','fontScript'].forEach(id => document.getElementById(id)?.classList.remove('on'));
  btn.classList.add('on');
  renderAdCanvas();
}

function getFontStyle() {
  switch(TEXT_FONT) {
    case 'serif':
      return { family: "'Playfair Display', 'Cormorant Garamond', 'Noto Serif TC', serif", weight: 500, letterSpacing: 0.02 };
    case 'light':
      return { family: "'Inter', 'Noto Sans TC', sans-serif", weight: 300, letterSpacing: 0.05 };
    case 'script':
      return { family: "'Caveat', 'Noto Serif TC', cursive", weight: 700, letterSpacing: 0 };
    case 'bold':
    default:
      return { family: "'Noto Sans TC', sans-serif", weight: 900, letterSpacing: 0 };
  }
}

function setPrStatus(msg, color) {
  const el = document.getElementById('prStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--t3)'; }
}

function startProgress(totalMs) {
  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  if (prBar) prBar.style.display = 'block';
  let pctVal = 0;
  const msgs = ['上傳中...','生成場景...','光影融合...','最終輸出...'];
  const interval = setInterval(() => {
    if (pctVal >= 90) return;
    pctVal = Math.min(90, pctVal + (pctVal < 30 ? 2 : pctVal < 60 ? 1 : 0.4));
    if (prFill) prFill.style.width = pctVal + '%';
    if (prPct) prPct.textContent = Math.round(pctVal) + '%';
    setPrStatus(msgs[Math.min(Math.floor(pctVal/25), msgs.length-1)], 'var(--t3)');
  }, totalMs / 100);
  return interval;
}

function finishProgress(interval) {
  clearInterval(interval);
  const prBar  = document.getElementById('prProgBar');
  const prFill = document.getElementById('prProgFill');
  const prPct  = document.getElementById('prPct');
  const btn    = document.getElementById('prApplyBtn');
  if (prFill) prFill.style.width = '100%';
  if (prPct) prPct.textContent = '100%';
  setTimeout(() => { if(prBar) prBar.style.display='none'; if(prPct) prPct.textContent=''; }, 2000);
  if (btn) { btn.disabled = false; btn.textContent = '套用 AI 效果'; }
}

function failProgress(interval, errMsg) {
  clearInterval(interval);
  const prBar = document.getElementById('prProgBar');
  const prPct = document.getElementById('prPct');
  const btn   = document.getElementById('prApplyBtn');
  if (prBar) prBar.style.display = 'none';
  if (prPct) prPct.textContent = '';
  setPrStatus('❌ ' + errMsg, 'var(--red)');
  if (btn) { btn.disabled = false; btn.textContent = '套用 AI 效果'; }
}

// 各動作扣點對照(對齊 V2/PDF;前端樂觀扣,後端 Worker 真扣)
const _BITS_COST = {
  gpt_poster_edit_submit: 240,    // 廣告圖
  flux_kontext_submit: 60,        // 換場景
  kling_tryon_submit: 120,        // 試穿
  kling_poster_video_submit: 960  // 影片(5秒 Kling)
};
async function callWorker(params) {
  const _cost = _BITS_COST[params.action] || 0;
  const _email = (typeof _userEmail !== 'undefined' && _userEmail) ? _userEmail : (localStorage.getItem('bs_sso_email') || '');
  if (_cost > 0 && typeof bumpBitsDisplay === 'function') bumpBitsDisplay(-_cost);   // 樂觀扣點
  const resp = await fetch(CF_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, email: _email, password: GAS_PASSWORD })
  });
  const j = await resp.json();
  if (_cost > 0 && j && j.error === 'INSUFFICIENT_BITS') {
    if (typeof bumpBitsDisplay === 'function') bumpBitsDisplay(_cost);  // 不足→退回
    showInsufficientBits(_cost);
  }
  return j;
}

// 點數不足:跳白話提示 + 導去儲值/升級
function showInsufficientBits(cost) {
  const go = confirm('能量(點數)不足\n\n本次操作需要 ' + cost + ' 點,你目前的點數不夠,所以這次沒有扣款、也沒有產出。\n\n要前往儲值 / 升級方案嗎?');
  if (!go) return;
  if (typeof openBitsShop === 'function') openBitsShop();
  else location.href = 'plans.html';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function uploadToFal(base64) {
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('base64 格式錯誤');
  const mimeType = match[1];
  const urlData = await callWorker({ action: 'fal_get_upload_url', mimeType });
  if (!urlData.ok) throw new Error('取得上傳URL失敗: ' + (urlData.error || ''));
  const binaryStr = atob(match[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const putResp = await fetch(urlData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: bytes
  });
  if (!putResp.ok) throw new Error('圖片上傳失敗: ' + putResp.status);
  return urlData.fileUrl;
}

async function pollUntilDone(requestId, endpoint, maxMs = 300000, responseUrl = null, statusUrl = null) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(5000);
    try {
      const pollData = await callWorker({ action:'fal_poll', requestId, endpoint, responseUrl, statusUrl });
      if (pollData.status === 'COMPLETED') return pollData;
      if (pollData.status === 'FAILED') return { status:'FAILED', error: pollData.error || '任務失敗' };
      // 🆕 進度條由 startProgress 單一驅動,這裡不再寫(避免兩套搶 → 跳來跳去)
    } catch(e) {
      console.warn('poll 單次失敗,繼續:', e.message);
    }
  }
  return { status:'TIMEOUT' };
}

async function submitFluxAndCheckBlob(scenePrompt, paddedBase64) {
  const imageUrl = await uploadToFal(paddedBase64);

  const submitData = await callWorker({
    action: 'flux_kontext_submit',
    imageUrl,
    prompt: scenePrompt
  });
  if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

  const result = await pollUntilDone(submitData.requestId, submitData.endpoint, 120000, submitData.responseUrl, submitData.statusUrl);

  if (result.status === 'TIMEOUT' || result.status === 'FAILED') {
    throw new Error(result.error || '生成失敗');
  }

  const falUrl = result.imageBase64 || result.imageUrl;
  if (!falUrl) throw new Error('未回傳圖片資料');

  if (falUrl.startsWith('data:')) {
    return { ok: true, imageUrl: falUrl, blobSize: 0 };
  }

  try {
    const resp = await fetch(falUrl, { mode: 'cors' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    console.log('[v10.2] 下載圖片, size:', blob.size, 'type:', blob.type);
    LAST_BLOB_SIZE = blob.size;

    if (blob.size < BLACK_IMAGE_THRESHOLD) {
      console.warn('[v10.2] ⚠️ 偵測到黑圖! size:', blob.size, '< 門檻', BLACK_IMAGE_THRESHOLD);
      return { ok: false, reason: 'BLACK_IMAGE', blobSize: blob.size };
    }

    const blobUrl = URL.createObjectURL(blob);
    return { ok: true, imageUrl: blobUrl, blobSize: blob.size, originalUrl: falUrl };
  } catch(fetchErr) {
    console.warn('[v10.2] fetch 檢查失敗,使用原 URL:', fetchErr.message);
    return { ok: true, imageUrl: falUrl, blobSize: -1 };
  }
}

async function applyPhotoroomBg() {
  const btn = document.getElementById('prApplyBtn');

  if (PR_MODE === 'gpt_poster') {
    btn.disabled = true; btn.textContent = '⏳ AI 廣告圖生成中...';
    await generateGptPoster();
    return;
  }

  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇照片!', 'var(--red)'); return; }
  setPrStatus('⏳ 載入原圖...', 'var(--t3)');
  await ensureFullRes(photo, true);   // 🆕 改抓 s1600 縮圖:小回應不斷線,1600px 對 1080 海報綽綽有餘(治大 base64 回應斷線)
  const imgSrc = photo.canvasRes || photo.full || photo.hiRes || photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 照片尚未載入', 'var(--red)'); return; }

  btn.disabled = true; btn.textContent = '⏳ AI 處理中...';

  if (PR_MODE === 'kling_tryon') {
    const interval = startProgress(60000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const compressed = await compressImageBase64(base64, 1500, 0.90);
      const mdImg = document.getElementById('mdPhotoImg');
      if (!mdImg || !mdImg.src || mdImg.style.display === 'none') throw new Error('請先上傳 MD 照片!');
      setPrStatus('送出試穿任務...', 'var(--t3)');
      const submitData = await callWorker({
        action: 'kling_tryon_submit',
        humanImageBase64: mdImg.src,
        garmentImageBase64: compressed
      });
      if (!submitData.ok) throw new Error(submitData.error || '提交失敗');
      setPrStatus('⏳ AI 試穿中(約30-90秒)...', 'var(--t3)');
      let result = await pollUntilDone(submitData.requestId, submitData.endpoint, 180000, submitData.responseUrl, submitData.statusUrl);
      if (result.status === 'TIMEOUT') {
        setPrStatus('超時,最後查詢一次...', 'var(--t3)');
        for (let i = 0; i < 3; i++) {
          await sleep(5000);
          result = await callWorker({ action:'fal_poll', requestId: submitData.requestId, endpoint: submitData.endpoint, responseUrl: submitData.responseUrl, statusUrl: submitData.statusUrl });
          if (result.status === 'COMPLETED' && (result.imageUrl || result.imageBase64)) break;
        }
      }
      if (result.status === 'FAILED') throw new Error(result.error || '試穿失敗');
      if (!result.imageUrl && !result.imageBase64) throw new Error('試穿超時,請再試一次');
      PR_BG_IMG = result.imageUrl || result.imageBase64;
      CANVAS_TAINTED = false;
      await renderAdCanvasWithPR();
      finishProgress(interval);
      setPrStatus('✅ MD 試穿完成!', 'var(--mint)');
    } catch(e) { failProgress(interval, e.message); }
    return;
  }

  if (PR_MODE === 'product_shot') {
    const interval = startProgress(30000);
    try {
      const blob = await urlToBlob(imgSrc);
      const base64 = await blobToBase64(blob);
      const paddedBase64 = await padImageTo1080(base64);

      const sceneKey = document.getElementById('prSceneSection')?.dataset?.scene || 'studio_white';
      const customPrompt = document.getElementById('prCustomPrompt')?.value?.trim();
      const scenePrompt = customPrompt || PRODUCT_SCENES[sceneKey] || PRODUCT_SCENES.studio_white;

      setPrStatus('AI 情境生成中...', 'var(--t3)');

      let result = await submitFluxAndCheckBlob(scenePrompt, paddedBase64);

      if (!result.ok && result.reason === 'BLACK_IMAGE') {
        console.warn('[v10.2] 第一次被擋,自動重試中...');
        setPrStatus('內容審查擋下,重試中...', '#E8C878');
        result = await submitFluxAndCheckBlob(scenePrompt, paddedBase64);
      }

      if (!result.ok && result.reason === 'BLACK_IMAGE') {
        console.error('[v10.2] 兩次都被擋,顯示警示');
        finishProgress(interval);
        setPrStatus('⚠️ AI 內容審查擋下,請改用真人試穿或換場景', 'var(--red)');
        showBlackImageWarning(result.blobSize);
        return;
      }

      PR_BG_IMG = result.imageUrl;
      CANVAS_TAINTED = false;
      await renderAdCanvasWithPR();
      finishProgress(interval);

      if (result.blobSize > 0) {
        setPrStatus(`✅ AI 情境生成完成!(${Math.round(result.blobSize/1024)} KB)`, 'var(--mint)');
      } else {
        setPrStatus('✅ AI 情境生成完成!', 'var(--mint)');
      }
    } catch(e) { failProgress(interval, e.message); }
  }
}

function showBlackImageWarning(blobSize) {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const grad = ctx.createLinearGradient(0,0,0,AM.h);
  grad.addColorStop(0, '#1A1510');
  grad.addColorStop(1, '#0A0A0B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, AM.w, AM.h);
  ctx.fillStyle = '#C9A665';
  ctx.font = '900 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️', AM.w/2, AM.h/2 - 150);
  ctx.fillStyle = '#FAFAFA';
  ctx.font = '900 44px "Noto Sans TC",sans-serif';
  ctx.fillText('AI 內容審查擋下了這張圖', AM.w/2, AM.h/2 - 50);
  ctx.fillStyle = '#B8B4A8';
  ctx.font = '500 22px "Noto Sans TC",sans-serif';
  const kbSize = blobSize > 0 ? `(回傳 ${Math.round(blobSize/1024)} KB 異常圖)` : '';
  if (kbSize) ctx.fillText(kbSize, AM.w/2, AM.h/2 - 10);
  ctx.fillStyle = '#C9A665';
  ctx.font = '900 26px "Noto Sans TC",sans-serif';
  ctx.fillText('建議改用:', AM.w/2, AM.h/2 + 60);
  ctx.fillStyle = '#E8C878';
  ctx.font = '500 22px "Noto Sans TC",sans-serif';
  const suggestions = [
    ' 改用「AI 真人試穿」(內衣類推薦)',
    ' 換海邊場景: 炎熱夏日/熱帶渡假/沖繩海邊',
    ' 或換一張商品照再試'
  ];
  suggestions.forEach((s, i) => {
    ctx.fillText(s, AM.w/2, AM.h/2 + 110 + i * 42);
  });
  ctx.fillStyle = '#6A6860';
  ctx.font = '400 16px "Noto Sans TC",sans-serif';
  ctx.fillText('已自動重試一次,AI 仍判定此組合為敏感內容', AM.w/2, AM.h - 60);
}

async function loadImageSmart(src) {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) reject(new Error('圖片大小為 0'));
        else resolve();
      };
      img.onerror = () => reject(new Error('img 載入失敗'));
      img.src = src;
    });
    return { img, tainted: false };
  }

  try {
    const response = await fetch(src, { mode: 'cors' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const blob = await response.blob();
    if (blob.size < 500) throw new Error('圖片太小');
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('naturalWidth 為 0'));
        } else resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('blob img 載入失敗'));
      };
      img.src = blobUrl;
    });
    return { img, tainted: false, blobUrl };
  } catch(e) {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (img.naturalWidth === 0) reject(new Error('naturalWidth 為 0'));
        else resolve();
      };
      img.onerror = () => reject(new Error('img 直接載入也失敗'));
      img.src = src;
    });
    return { img, tainted: true };
  }
}

async function renderAdCanvas() {
  const canvas = document.getElementById('adCanvas');
  if (canvas) canvas.style.display = 'block';
  if (PR_BG_IMG) { await renderAdCanvasWithPR(); return; }
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;

  if (photo && (photo.full || photo.src || photo.thumb)) {
    try {
      await ensureFullRes(photo, true);   // 🆕 canvas 用 s1600 縮圖(小、不爆 QUIC、畫 1080 夠;不影響 FAL 原圖)
      const { img, tainted } = await loadImageSmart(photo.canvasRes || photo.full || photo.src || photo.thumb);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, AM.w, AM.h);
      const scale = Math.min(AM.w/img.width, AM.h/img.height);
      ctx.drawImage(img,
        Math.round((AM.w-img.width*scale)/2),
        Math.round((AM.h-img.height*scale)/2),
        img.width*scale, img.height*scale);
      if (tainted) CANVAS_TAINTED = true;
    } catch(e) {
      drawBgFallback(ctx);
    }
  } else {
    drawBgFallback(ctx);
  }
  drawOverlay(ctx, title, getAccentColor());
}

async function renderAdCanvasWithPR() {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;
  canvas.width = AM.w; canvas.height = AM.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const title = document.getElementById('amTitle')?.value || '';
  const isTryon = PR_MODE === 'kling_tryon';
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, AM.w, AM.h);

  try {
    const { img, tainted } = await loadImageSmart(PR_BG_IMG);
    if (tainted) CANVAS_TAINTED = true;

    if (isTryon) {
      const scaleCover   = Math.max(AM.w/img.width, AM.h/img.height);
      const scaleContain = Math.min(AM.w/img.width, AM.h/img.height);
      if (1 - scaleContain/scaleCover <= 0.20) {
        ctx.drawImage(img,
          Math.round((AM.w-img.width*scaleCover)/2),
          Math.round((AM.h-img.height*scaleCover)/2),
          img.width*scaleCover, img.height*scaleCover);
      } else {
        ctx.filter = 'blur(18px)';
        ctx.drawImage(img,
          Math.round((AM.w-img.width*scaleCover)/2),
          Math.round((AM.h-img.height*scaleCover)/2),
          img.width*scaleCover, img.height*scaleCover);
        ctx.filter = 'none';
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0,0,AM.w,AM.h);
        ctx.drawImage(img,
          Math.round((AM.w-img.width*scaleContain)/2),
          Math.round((AM.h-img.height*scaleContain)/2),
          img.width*scaleContain, img.height*scaleContain);
      }
    } else {
      const scale = Math.min(AM.w/img.width, AM.h/img.height);
      ctx.drawImage(img,
        Math.round((AM.w-img.width*scale)/2),
        Math.round((AM.h-img.height*scale)/2),
        img.width*scale, img.height*scale);
    }
  } catch(e) {
    console.error('[v10.2] render 失敗:', e.message);
    drawBgFallback(ctx);
    ctx.fillStyle = '#C9A665';
    ctx.font = '900 32px "Noto Sans TC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 圖片載入失敗', AM.w/2, AM.h/2 - 20);
    ctx.font = '400 20px "Noto Sans TC",sans-serif';
    ctx.fillStyle = '#F0E0D0';
    ctx.fillText('請重新生成或重新整理頁面', AM.w/2, AM.h/2 + 30);
  }

  drawOverlay(ctx, title, getAccentColor());
}

function getAccentColor() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  return { gold:'#C9A665', red:'#E8603A', sky:'#5BC8C8', mint:'#7ED4B0', purple:'#B89ED4', brown:'#C8A870' }[brand?.navColor] || '#C9A665';
}

function drawBgFallback(ctx) {
  const grad = ctx.createLinearGradient(0,0,AM.w,AM.h);
  grad.addColorStop(0,'#14141a'); grad.addColorStop(1,'#0a0a0b');
  ctx.fillStyle = grad; ctx.fillRect(0,0,AM.w,AM.h);
}

function autoLines(ctx, text, maxWidth) {
  const chars=text.split(''), lines=[]; let cur='';
  for (const c of chars) {
    if (ctx.measureText(cur+c).width > maxWidth && cur) { lines.push(cur); cur=c; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawOverlay(ctx, title, accent) {
  const W=AM.w, H=AM.h;
  const gradStartPct = (parseInt(document.getElementById('amGradStart')?.value||38))/100;
  const gradStrength = (parseInt(document.getElementById('amGradStrength')?.value||85))/100;
  const grad = ctx.createLinearGradient(0, H*gradStartPct, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, `rgba(0,0,0,${Math.round(gradStrength*0.65*100)/100})`);
  grad.addColorStop(1, `rgba(0,0,0,${gradStrength})`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
  if (!title) return;
  const baseFontSize = parseInt(document.getElementById('amFontSize')?.value||94);
  const textYPct = parseInt(document.getElementById('amTextY')?.value||80)/100;
  const align = TEXT_ALIGN||'left';

  const fontStyle = getFontStyle();
  ctx.font = `${fontStyle.weight} ${baseFontSize}px ${fontStyle.family}`;
  ctx.textAlign = align;

  const tx = align==='left' ? Math.round(W*0.07) : align==='right' ? Math.round(W*0.93) : Math.round(W/2);
  const lines = autoLines(ctx, title, W*0.86);
  const lineH = baseFontSize * (TEXT_FONT === 'script' ? 1.1 : 1.18);
  const ty = Math.round(H*textYPct) - (lines.length-1)*lineH;
  lines.forEach((line, i) => {
    ctx.shadowColor='rgba(0,0,0,0.85)'; ctx.shadowBlur=20; ctx.shadowOffsetY=4;
    ctx.fillStyle='#FFFFFF';
    if (fontStyle.letterSpacing > 0 && ctx.letterSpacing !== undefined) {
      ctx.letterSpacing = `${fontStyle.letterSpacing}em`;
    }
    ctx.fillText(line, tx, ty+i*lineH);
  });
  ctx.shadowColor='transparent'; ctx.shadowBlur=0;
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0em';
}

function downloadAd() {
  const canvas = document.getElementById('adCanvas');
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const filename = `${brand?.name||'ad'}_${window.S.prod?.name||'img'}.jpg`.replace(/[^\w\u4e00-\u9fff\-_.]/g,'_');

  try {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    if (window._driveToken) uploadAdToDrive(canvas, filename);
  } catch(e) {
    if (PR_BG_IMG && !PR_BG_IMG.startsWith('data:')) {
      const msg = '因瀏覽器安全限制無法直接下載\n將開啟圖片,請右鍵「另存圖片」';
      if (confirm(msg)) window.open(PR_BG_IMG, '_blank');
    } else {
      alert('下載失敗,請稍後重新生成一次');
    }
  }
}

async function compressImageBase64(base64, maxSize, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w=img.width, h=img.height;
      if (w>maxSize||h>maxSize) {
        if (w>h) { h=Math.round(h*maxSize/w); w=maxSize; }
        else { w=Math.round(w*maxSize/h); h=maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = base64;
  });
}

async function padImageTo1080(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.width, h0 = img.height;
      const ratio = w0 / h0;

      if (ratio >= 0.85 && ratio <= 1.15 && Math.min(w0, h0) >= 1000) {
        resolve(base64);
        return;
      }

      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      let fillColor = '#ffffff';
      try {
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = w0; tmpCanvas.height = h0;
        const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true });
        tmpCtx.drawImage(img, 0, 0);
        const sampleSize = Math.max(10, Math.floor(Math.min(w0, h0) * 0.02));
        const corners = [
          tmpCtx.getImageData(0, 0, sampleSize, sampleSize).data,
          tmpCtx.getImageData(w0-sampleSize, 0, sampleSize, sampleSize).data,
          tmpCtx.getImageData(0, h0-sampleSize, sampleSize, sampleSize).data,
          tmpCtx.getImageData(w0-sampleSize, h0-sampleSize, sampleSize, sampleSize).data,
        ];
        let r=0, g=0, b=0, n=0;
        corners.forEach(d => {
          for (let i=0; i<d.length; i+=4) { r+=d[i]; g+=d[i+1]; b+=d[i+2]; n++; }
        });
        r = Math.round(r/n); g = Math.round(g/n); b = Math.round(b/n);
        fillColor = `rgb(${r},${g},${b})`;
      } catch(e) {
        fillColor = '#888888';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, SIZE, SIZE);

      const scale = Math.min(SIZE / w0, SIZE / h0);
      const w = Math.round(w0 * scale);
      const h = Math.round(h0 * scale);
      const x = Math.round((SIZE - w) / 2);
      const y = Math.round((SIZE - h) / 2);
      ctx.drawImage(img, x, y, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = base64;
  });
}

async function urlToBlob(src) {
  if (src.startsWith('data:')) { const res = await fetch(src); return res.blob(); }
  const res = await fetch(src);
  if (!res.ok) throw new Error('圖片載入失敗');
  return res.blob();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


// ═══════════════════════════════════════════════════════════════════════
// ★ v10.1 / v10.2:懶人 AI 廣告圖模組 (GPT Image 2 edit 模式)
// ═══════════════════════════════════════════════════════════════════════

const INSPIRATION_KEYS = {
  summer_beach: { label: '夏日海邊', style: 'vibrant tropical summer scene...' },
  japan_minimal: { label: '日系極簡', style: 'Japanese minimalist editorial...' },
  korean_ecom: { label: '韓系電商', style: 'Korean e-commerce glossy...' },
  japan_food: { label: '日式食品', style: 'Japanese food editorial dark...' },
  family_warm: { label: '家庭溫馨', style: 'warm cozy family lifestyle...' },
  surreal_art: { label: '超現實藝術', style: 'surreal art photography...' },
  tech_detail: { label: '科技詳情頁', style: 'high-tech product detail page...' },
  retro_vintage: { label: '復古印刷', style: '1970s Taiwanese vintage magazine...' }
};

function setInspiration(btn, key) {
  document.querySelectorAll('.insp-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  SELECTED_INSPIRATION = key;
  const descEl = document.getElementById('gptStyleDesc');
  if (descEl && INSPIRATION_KEYS[key]) {
    descEl.value = INSPIRATION_KEYS[key].style;
  }
}

function setLayout(btn, layoutKey) {
  document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  SELECTED_LAYOUT = layoutKey;
  console.log('[v10.2] 版式選擇:', layoutKey, LAYOUT_TEMPLATES[layoutKey]?.label);
}

function setFlavor(btn, flavorKey) {
  document.querySelectorAll('.flavor-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  SELECTED_FLAVOR = flavorKey;
  console.log('[v10.2] 風土調味:', flavorKey, REGIONAL_FLAVORS[flavorKey]?.label);
}

function setContext(btn, contextKey) {
  document.querySelectorAll('.context-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  SELECTED_CONTEXT = contextKey;
  console.log('[v10.2] 情境主題:', contextKey, CONTEXT_THEMES[contextKey]?.label);
}

function updateBrandPackBadge() {
  const badge = document.getElementById('brandPackBadge');
  if (!badge) return;
  const pack = detectBrandPack();
  badge.textContent = pack.label;
  badge.style.color = pack === BRAND_STYLE_PACKS.default_clean ? 'var(--t3)' : '#C9B8E8';
}

function getBrandContext() {
  const brand = window.BRANDS.find(b => b.id === window.S.brandId);
  const sub = brand?.subs?.find(s => s.id === window.S.subId);
  const prod = window.S.prod;
  return {
    brand:     brand?.name || '',
    subBrand:  sub?.name || '',
    product:   prod?.name || '',
    adStyle:   brand?.adStyle || '',
    hashtags:  brand?.hashtags || '',
    spec:      prod?.spec || '',
    feature:   prod?.feature || ''
  };
}

function buildPosterPrompt() {
  const ctx = getBrandContext();
  const brandPack = detectBrandPack();
  const layout = LAYOUT_TEMPLATES[SELECTED_LAYOUT] || LAYOUT_TEMPLATES.minimal_poster;
  const flavor = REGIONAL_FLAVORS[SELECTED_FLAVOR] || REGIONAL_FLAVORS.none;
  const contextTheme = CONTEXT_THEMES[SELECTED_CONTEXT] || CONTEXT_THEMES.none;

  const styleDesc = document.getElementById('gptStyleDesc')?.value?.trim() || '';
  const headline = document.getElementById('gptHeadline')?.value?.trim() || '';
  const subHeadline = document.getElementById('gptSubHeadline')?.value?.trim() || '';

  let prompt = '';

  prompt += `=== CRITICAL PRODUCT PRESERVATION (HIGHEST PRIORITY) ===\n`;
  prompt += `- The product in the source image MUST be reproduced PIXEL-PERFECT identical\n`;
  prompt += `- Preserve exact product shape, proportions, colors, label design, logo, and all packaging typography\n`;
  prompt += `- Do NOT redesign the product, do NOT invent new packaging, do NOT alter brand marks\n`;
  prompt += `- The product is the hero — build the advertising scene AROUND it\n\n`;

  prompt += `=== BRAND STYLE PACK (AMBIENCE ONLY — does NOT define product look) ===\n`;
  prompt += brandPack.dna + '\n';
  if (ctx.brand) prompt += `Brand name to display (small signature): "${ctx.brand}"${ctx.subBrand ? ' · ' + ctx.subBrand : ''}\n`;
  if (ctx.adStyle) prompt += `Additional brand direction note: ${ctx.adStyle}\n`;
  prompt += '\n';

  if (ctx.product || ctx.spec || ctx.feature) {
    prompt += `=== PRODUCT ESSENCE (HIGH PRIORITY — must be respected) ===\n`;
    prompt += `This specific product variant has its OWN character that MUST be preserved regardless of brand mood or regional flavor:\n`;
    if (ctx.product) prompt += `- Product name: "${ctx.product}"\n`;
    if (ctx.spec)    prompt += `- Product specifications (physical traits — color, material, era, style): ${ctx.spec}\n`;
    if (ctx.feature) prompt += `- Product features (selling points, positioning, context): ${ctx.feature}\n`;
    prompt += `IMPORTANT: The product's intrinsic visual character (e.g. "retro brass" stays retro brass, "white minimalist tech" stays white tech) MUST override any conflicting hints from the brand pack ambience or regional flavor. The brand pack only defines AMBIENCE; the product specs define what the product LOOKS LIKE.\n\n`;
  }

  prompt += `=== LAYOUT FRAMEWORK ===\n`;
  prompt += `Layout type: ${layout.label}\n`;
  prompt += layout.composition + '\n\n';

  if (flavor.flavor) {
    prompt += `=== REGIONAL FLAVOR (OVERRIDES brand pack scene hints) ===\n`;
    prompt += flavor.flavor + '\n';
    prompt += `CRITICAL OVERRIDE RULE: This regional flavor takes precedence over any scene description, era, or decor hinted by the brand pack. If brand pack says "warm domestic Taiwan" and flavor says "Korean clean pastel" → output MUST be Korean clean pastel (not Taiwan retro). Brand pack only contributes overall mood; flavor decides the actual visual scene.\n\n`;
  }

  if (contextTheme.context) {
    prompt += `=== CONTEXTUAL THEME ===\n`;
    prompt += contextTheme.context + '\n\n';
  }

  if (styleDesc) {
    prompt += `=== ADDITIONAL STYLE NOTES ===\n`;
    prompt += styleDesc + '\n\n';
  }

  if (headline || subHeadline) {
    prompt += `=== TEXT TO RENDER ===\n`;
    prompt += `Render the following Traditional Chinese text with pixel-perfect typography (correct glyphs, proper spacing, professional editorial layout). Match the typography hierarchy specified in the brand DNA above.\n`;
    if (headline) prompt += `- Primary headline (large, eye-catching): "${headline}"\n`;
    if (subHeadline) prompt += `- Secondary subheadline (smaller, supporting): "${subHeadline}"\n`;
    if (ctx.brand) prompt += `- Brand signature (small, at corner or footer): "${ctx.brand}"\n`;
    prompt += `Typography must be crisp, readable, and integrated naturally into the layout.\n\n`;
  }

  prompt += `=== ART DIRECTOR CRAFT (INTENT — must NOT override the chosen style above) ===
${DESIGNER_POLISH}

`;

  prompt += `=== OUTPUT SPECIFICATION ===\n`;
  prompt += `- Square 1:1 orientation, advertising poster optimized for Instagram / Meta feed (1080x1080, works across all feed placements)\n`;
  prompt += `- High resolution, sharp typography, professional commercial photography quality\n`;
  prompt += `- Change: background, environment, lighting, decorative graphics, typography, layout composition\n`;
  prompt += `- Preserve: product identity, product details, brand marks, all text printed on the product itself\n`;
  prompt += `- Constraints: no watermark, no random extra objects, no logo distortion, no product redesign\n`;

  return prompt;
}

// ═══════════════════════════════════════════════════════════════════════
// ★ 雙保險備案路 helper
// ═══════════════════════════════════════════════════════════════════════
async function pollDriveByReqid(brandId, reqid, maxMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await sleep(5000);
    try {
      const r = await callWorker({ action: 'query_ai_image', brandId, reqid });
      if (r && r.found && (r.imageBase64 || r.download_url)) {
        return { found: true, imageBase64: r.imageBase64 || null, download_url: r.download_url || null, filename: r.filename || null };
      }
    } catch (e) {
      console.warn('[雙保險] query_ai_image 單次失敗,繼續:', e.message);
    }
  }
  return { found: false };
}

async function firstTruthy(promises) {
  return new Promise((resolve) => {
    let remaining = promises.length;
    let settled = false;
    promises.forEach(p => {
      Promise.resolve(p).then(val => {
        if (settled) return;
        if (val) { settled = true; resolve(val); return; }
        remaining--;
        if (remaining === 0 && !settled) { settled = true; resolve(null); }
      }).catch(() => {
        if (settled) return;
        remaining--;
        if (remaining === 0 && !settled) { settled = true; resolve(null); }
      });
    });
    if (promises.length === 0) resolve(null);
  });
}

async function generateGptPoster() {
  const photo = window.S.selPhoto !== null ? window.S.photos[window.S.selPhoto] : null;
  if (!photo) { setPrStatus('⚠️ 請先選擇商品照片!', 'var(--red)'); return; }
  setPrStatus('⏳ 載入原圖...', 'var(--t3)');
  await ensureFullRes(photo, true);   // 🆕 改抓 s1600 縮圖:小回應不斷線,1600px 對 1080 海報綽綽有餘(治大 base64 回應斷線)
  const imgSrc = photo.canvasRes || photo.full || photo.hiRes || photo.src || photo.thumb;
  if (!imgSrc) { setPrStatus('⚠️ 商品照尚未載入', 'var(--red)'); return; }

  const headline = document.getElementById('gptHeadline')?.value?.trim();
  if (!headline) {
    setPrStatus('⚠️ 請至少填主標(大字)', 'var(--red)');
    document.getElementById('prApplyBtn').disabled = false;
    document.getElementById('prApplyBtn').textContent = '套用 AI 效果';
    return;
  }

  const brandId = window.S?.brandId || '';
  const reqid = String(Date.now());

  const t0 = Date.now();   // 🆕 量真實出圖時間
  const interval = startProgress(150000);   // 🆕 貼近真實出圖時間(約 2-2.5 分),進度條更順、不會早早卡 90%
  try {
    updateBrandPackBadge();

    setPrStatus('上傳商品照處理中...', 'var(--t3)');
    const blob = await urlToBlob(imgSrc);
    const base64 = await blobToBase64(blob);
    const paddedBase64 = await padImageTo1080(base64);
    const imageUrl = await uploadToFal(paddedBase64);

    const prompt = buildPosterPrompt();
    console.log('[v11.2] 懶人廣告圖 prompt 長度:', prompt.length, '字元 · reqid:', reqid);

    setPrStatus('廣告圖生成中(品牌包+版式合成,約 60-90 秒)...', 'var(--t3)');
    const submitData = await callWorker({
      action: 'gpt_poster_edit_submit',
      prompt,
      imageUrls: [imageUrl],
      image_size: 'square_hd',
      quality: 'high',
      num_images: 1,
      brandId,
      reqid
    });
    if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

    setPrStatus('⏳ 出圖中(熱點不穩也沒關係,雲端會自動補)...', 'var(--t3)');

    const FAILSAFE_MS = 240000;
    const racePromises = [
      (async () => {
        const r = await pollUntilDone(
          submitData.requestId, submitData.endpoint,
          FAILSAFE_MS, submitData.responseUrl, submitData.statusUrl
        );
        if (r.status === 'COMPLETED' && r.imageUrl) {
          return { from: 'fal', imageUrl: r.imageUrl };
        }
        if (r.status === 'FAILED') {
          console.warn('[雙保險] 影像輪詢失敗,改等 Drive:', r.error);
        }
        return null;
      })(),
      (async () => {
        const d = await pollDriveByReqid(brandId, reqid, FAILSAFE_MS);
        if (d.found) {
          return { from: 'drive', imageBase64: d.imageBase64, download_url: d.download_url };
        }
        return null;
      })(),
    ];

    let winner = await firstTruthy(racePromises);

    if (!winner) {
      throw new Error(`生成逾時(4分鐘)。圖可能仍在雲端處理,稍後可在「AI生成完成區」找代碼 ${reqid} 的圖`);
    }

    const finalImg = winner.imageUrl || winner.imageBase64 || winner.download_url;
    if (!finalImg) throw new Error('未取得廣告圖片');

    PR_BG_IMG = finalImg;
    LAST_POSTER_URL = winner.imageUrl || winner.download_url || finalImg;
    CANVAS_TAINTED = false;

    if (winner.from === 'fal') {
      saveImageToDriveSilently(winner.imageUrl, 'poster', reqid);
    }

    AM.w = 1080;
    AM.h = 1080;
    await renderGptPosterCanvas();
    finishProgress(interval);

    const brandPack = detectBrandPack();
    const layoutLabel = LAYOUT_TEMPLATES[SELECTED_LAYOUT]?.label || '';
    const srcTag = winner.from === 'drive' ? ' · 雲端補圖' : '';
    const usedSec = Math.round((Date.now() - t0) / 1000);   // 🆕 真實用時
    console.log('[計時] 懶人廣告圖真實出圖時間:', usedSec, '秒 · reqid:', reqid);
    setPrStatus(`✅ 完成![${brandPack.label} × ${layoutLabel}]${srcTag} · ⏱${usedSec}秒 · 可點「變影片」`, 'var(--mint)');

    const videoBtn = document.getElementById('posterToVideoBtn');
    if (videoBtn) {
      videoBtn.style.display = 'block';
      videoBtn.disabled = false;
      videoBtn.textContent = '變 5 秒影片';
    }
  } catch(e) {
    failProgress(interval, e.message);
  }
}

async function renderGptPosterCanvas() {
  const canvas = document.getElementById('adCanvas');
  if (!canvas) return;

  // 🆕 先把結果圖載好(舊預覽先留著、不清),載好才一次清+畫 → 中間不留黑畫面
  let img, tainted;
  try {
    ({ img, tainted } = await loadImageSmart(PR_BG_IMG));
  } catch(e) {
    console.error('[v10.2] 廣告圖渲染失敗:', e.message);
    canvas.width = AM.w; canvas.height = AM.h;
    const ectx = canvas.getContext('2d', { willReadFrequently: true });
    drawBgFallback(ectx);
    ectx.fillStyle = '#FFA060';
    ectx.font = '900 36px "Noto Sans TC",sans-serif';
    ectx.textAlign = 'center';
    ectx.fillText('⚠️ 廣告圖載入失敗', AM.w/2, AM.h/2);
    ectx.font = '400 20px "Noto Sans TC",sans-serif';
    ectx.fillText(e.message.substring(0, 40), AM.w/2, AM.h/2 + 40);
    return;
  }

  // 圖已在手 → 以下全同步,瀏覽器一次重繪,看不到中間的黑
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = AM.w; canvas.height = AM.h;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (tainted) CANVAS_TAINTED = true;
  ctx.fillStyle = '#0A0A0B';
  ctx.fillRect(0, 0, AM.w, AM.h);
  const scale = Math.min(AM.w / img.width, AM.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, Math.round((AM.w - w) / 2), Math.round((AM.h - h) / 2), w, h);
}

async function posterToVideo() {
  if (!LAST_POSTER_URL) {
    setPrStatus('⚠️ 請先生成廣告圖', 'var(--red)');
    return;
  }

  const videoBtn = document.getElementById('posterToVideoBtn');
  videoBtn.disabled = true;
  videoBtn.textContent = '⏳ 影片生成中...';

  const interval = startProgress(120000);

  try {
    setPrStatus('送出影片任務...', 'var(--t3)');
    const submitData = await callWorker({
      action: 'kling_poster_video_submit',
      imageUrl: LAST_POSTER_URL,
      duration: 5,
      aspect_ratio: '1:1'   // 跟 1:1 海報一致 → kling 不重裁,影片=海報動起來
    });
    if (!submitData.ok) throw new Error(submitData.error || '提交失敗');

    setPrStatus('⏳ 影片生成中(約 90-120 秒)...', 'var(--t3)');
    let result = await pollUntilDone(
      submitData.requestId,
      submitData.endpoint,
      300000,
      submitData.responseUrl,
      submitData.statusUrl
    );

    if (result.status === 'TIMEOUT') {
      setPrStatus('最後查詢一次...', 'var(--t3)');
      for (let i = 0; i < 3; i++) {
        await sleep(5000);
        result = await callWorker({
          action: 'fal_poll',
          requestId: submitData.requestId,
          endpoint: submitData.endpoint,
          responseUrl: submitData.responseUrl,
          statusUrl: submitData.statusUrl
        });
        if (result.status === 'COMPLETED' && result.videoUrl) break;
      }
    }

    if (result.status === 'FAILED') throw new Error(result.error || '影片生成失敗');
    if (!result.videoUrl) {
      console.error('[影片診斷] poll 回傳無 videoUrl,原始回應:', JSON.stringify(result).slice(0, 500));
      throw new Error('未取得影片 URL');
    }

    showVideoInCanvas(result.videoUrl);
    finishProgress(interval);
    setPrStatus('✅ 影片生成完成!可右鍵下載', 'var(--mint)');
    videoBtn.textContent = '✅ 已生成影片';
    saveVideoToDriveSilently(result.videoUrl);  // 🆕 影片也背景存進 Drive(照抄海報存檔;不扣點、失敗不影響)
    videoBtn.disabled = true;

  } catch(e) {
    failProgress(interval, e.message);
    videoBtn.disabled = false;
    videoBtn.textContent = '變 5 秒影片 — 失敗,重試';
  }
}

function showVideoInCanvas(videoUrl) {
  const canvas = document.getElementById('adCanvas');
  const container = canvas?.parentElement;
  if (!container) return;

  const oldVideo = document.getElementById('adVideoPreview');
  if (oldVideo) oldVideo.remove();

  canvas.style.display = 'none';

  const video = document.createElement('video');
  video.id = 'adVideoPreview';
  video.src = videoUrl;
  video.controls = true;
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = 'border-radius:12px;width:100%;max-width:560px;height:auto;box-shadow:0 16px 60px rgba(0,0,0,0.7);display:block;';
  container.appendChild(video);

  const lbl = document.getElementById('previewLabel');
  if (lbl) lbl.textContent = '影片預覽 5 秒循環播放';
}

// ═══════════════════════════════════════════════════════════════════════
// ★ 背景靜默存檔
// ═══════════════════════════════════════════════════════════════════════
async function saveImageToDriveSilently(imageUrl, kind, reqId) {
  try {
    const brandId = window.S?.brandId;
    if (!brandId) { console.warn('[存檔] 無 brandId,跳過'); return; }
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      console.warn('[存檔] imageUrl 不是可存的網址,跳過');
      return;
    }

    const finalReqId = reqId || ((kind || 'poster') + '_' + Date.now());
    const brand = window.BRANDS?.find(b => b.id === brandId);
    const prod  = window.S?.prod;

    const res = await callWorker({
      action: 'save_ai_image_to_drive',
      brandId,
      imageUrl,
      requestId: finalReqId,
      metadata: {
        source: 'admaker_' + (kind || 'poster'),
        brand: brand?.name || '',
        product: prod?.name || '',
        generated_at: new Date().toISOString(),
      },
    });

    if (res.ok) {
      console.log('[存檔] ✅ 已存進 Drive:', res.drive_url);
      const el = document.getElementById('prStatus');
      if (el && el.textContent.includes('完成')) {
        el.textContent += ' · 已存雲端';
      }
    } else {
      console.warn('[存檔] ⚠️ Drive 存檔失敗(不影響海報):', res.error);
    }
  } catch (e) {
    console.warn('[存檔] ⚠️ 存檔錯誤(不影響海報):', e.message);
  }
}

// ★ 🆕 影片背景靜默存檔(照抄海報版,走 photoroom-proxy save_ai_video_to_drive → GAS saveVideoToDrive)
async function saveVideoToDriveSilently(videoUrl) {
  try {
    const brandId = window.S?.brandId;
    if (!brandId) { console.warn('[影片存檔] 無 brandId,跳過'); return; }
    if (!videoUrl || videoUrl.startsWith('data:') || videoUrl.startsWith('blob:')) {
      console.warn('[影片存檔] videoUrl 不是可存的網址,跳過'); return;
    }
    const brand = window.BRANDS?.find(b => b.id === brandId);
    const prod  = window.S?.prod;
    const res = await callWorker({
      action: 'save_ai_video_to_drive',
      brandId,
      videoUrl,
      nameHint: (brand?.name || '廣告') + '_' + (prod?.name || '影片') + '_' + Date.now(),
    });
    if (res.ok) {
      console.log('[影片存檔] ✅ 已存進 Drive:', res.drive_url);
      const el = document.getElementById('prStatus');
      if (el && el.textContent.includes('完成')) el.textContent += ' · 影片已存雲端';
    } else {
      console.warn('[影片存檔] ⚠️ Drive 存檔失敗(不影響影片):', res.error);
    }
  } catch (e) {
    console.warn('[影片存檔] ⚠️ 存檔錯誤(不影響影片):', e.message);
  }
}
