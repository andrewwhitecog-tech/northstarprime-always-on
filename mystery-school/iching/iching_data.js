/**
 * AETHERIA I CHING KNOWLEDGE ENGINE
 * Complete 64 Hexagram Corpus (King Wen Sequence) with Trigram Correspondences,
 * Judgments, Images, Changing Lines, and Vorathic Cyber-Taoist Commentary.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AetheriaIChing = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The Eight Trigrams (Bagua)
  const TRIGRAMS = {
    111: { name: 'Heaven (Creative)', chinese: '乾', pinyin: 'Qián', nature: 'Strong, Creative, Initiating', element: 'Metal / Celestial', symbol: '☰', direction: 'Northwest' },
    '000': { name: 'Earth (Receptive)', chinese: '坤', pinyin: 'Kūn', nature: 'Yielding, Devoted, Nurturing', element: 'Earth', symbol: '☷', direction: 'Southwest' },
    100: { name: 'Thunder (Arousing)', chinese: '震', pinyin: 'Zhèn', nature: 'Inciting movement, Shock, Awakening', element: 'Wood', symbol: '☳', direction: 'East' },
    '011': { name: 'Wind (Gentle)', chinese: '巽', pinyin: 'Xùn', nature: 'Penetrating, Flexible, Gentle', element: 'Wood', symbol: '☴', direction: 'Southeast' },
    '010': { name: 'Water (Abyssal)', chinese: '坎', pinyin: 'Kǎn', nature: 'Dangerous, Flowing, Deep', element: 'Water', symbol: '☵', direction: 'North' },
    101: { name: 'Fire (Clinging)', chinese: '離', pinyin: 'Lí', nature: 'Luminous, Clarity, Attaching', element: 'Fire', symbol: '☲', direction: 'South' },
    '001': { name: 'Mountain (Stillness)', chinese: '艮', pinyin: 'Gèn', nature: 'Resting, Boundary, Contemplation', element: 'Earth / Mountain', symbol: '☶', direction: 'Northeast' },
    110: { name: 'Lake (Joyous)', chinese: '兌', pinyin: 'Duì', nature: 'Serene, Expressive, Open', element: 'Metal / Marsh', symbol: '☱', direction: 'West' }
  };

  // 64 Hexagrams in the King Wen Sequence
  // Binary string represents lines from bottom (line 1) to top (line 6)
  // '1' = Yang (Solid), '0' = Yin (Broken)
  const HEXAGRAMS = [
    {
      number: 1,
      binary: '111111',
      glyph: '䷀',
      name: 'The Creative',
      chinese: '乾',
      pinyin: 'Qián',
      upper: 'Heaven',
      lower: 'Heaven',
      judgment: 'The Creative works sublime success, furthering through perseverance. Pure Yang power in sovereign motion.',
      image: 'The movement of heaven is full of power. Thus the superior individual makes himself strong and untiring.',
      vorathCommentary: 'Sovereign creative initiation. The forge burns at maximum resonance. Do not hesitate; establish the foundation stone.'
    },
    {
      number: 2,
      binary: '000000',
      glyph: '䷁',
      name: 'The Receptive',
      chinese: '坤',
      pinyin: 'Kūn',
      upper: 'Earth',
      lower: 'Earth',
      judgment: 'The Receptive brings sublime success. If the superior individual takes the lead, he goes astray; if he follows, he finds guidance.',
      image: 'The earth\'s condition is receptive devotion. Thus the noble person bears the world with breadth of character.',
      vorathCommentary: 'Deep surrender to physical reality. Absorb incoming signals without distortion. Cultivate patient space for roots to anchor.'
    },
    {
      number: 3,
      binary: '100010',
      glyph: '䷂',
      name: 'Difficulty at the Beginning',
      chinese: '屯',
      pinyin: 'Zhūn',
      upper: 'Water',
      lower: 'Thunder',
      judgment: 'Difficulty at the Beginning brings sublime success. Nothing should be undertaken lightly; appoint helpers and build alliances.',
      image: 'Clouds and thunder. Thus the superior individual brings order out of chaos.',
      vorathCommentary: 'The initial compilation error before the engine boots. Chaotic potential sorting itself into crystalline order. Keep coding.'
    },
    {
      number: 4,
      binary: '010001',
      glyph: '䷃',
      name: 'Youthful Folly',
      chinese: '蒙',
      pinyin: 'Méng',
      upper: 'Mountain',
      lower: 'Water',
      judgment: 'Youthful Folly has success. It is not I who seek the young fool; the young fool seeks me. At first oracle, I inform him.',
      image: 'A spring wells up at the foot of the mountain. Thus the noble person fosters virtue by thoroughness in all that he does.',
      vorathCommentary: 'The beginner\'s mind. Do not feign mastery; ask direct questions, listen to the compiler, and respect the ancient masters.'
    },
    {
      number: 5,
      binary: '111010',
      glyph: '䷄',
      name: 'Waiting (Nourishment)',
      chinese: '需',
      pinyin: 'Xū',
      upper: 'Water',
      lower: 'Heaven',
      judgment: 'Waiting. If you are sincere, you have light and success. Perseverance brings good fortune. It furthers one to cross the great water.',
      image: 'Clouds rise up to heaven: the image of Waiting. Thus the superior individual eats and drinks, is joyous and of good cheer.',
      vorathCommentary: 'Tactical patience while the build artifact compiles. Rest in the eye of the storm; your reserves are recharging.'
    },
    {
      number: 6,
      binary: '010111',
      glyph: '䷅',
      name: 'Conflict',
      chinese: '訟',
      pinyin: 'Sòng',
      upper: 'Heaven',
      lower: 'Water',
      judgment: 'Conflict. You are sincere and are being obstructed. A cautious halt halfway brings good fortune. Going through to the end brings misfortune.',
      image: 'Heaven and water go their opposite ways: the image of Conflict. Thus the superior individual carefully considers the beginning.',
      vorathCommentary: 'Do not litigate dead code or ego-driven boundaries. Seek mediation, reconcile the diff cleanly, and preserve the peace.'
    },
    {
      number: 7,
      binary: '010000',
      glyph: '䷆',
      name: 'The Army',
      chinese: '師',
      pinyin: 'Shī',
      upper: 'Earth',
      lower: 'Water',
      judgment: 'The Army needs perseverance and a strong, righteous leader. Good fortune without blame.',
      image: 'In the middle of the earth is water: the image of the Army. Thus the noble individual increases his masses by generosity.',
      vorathCommentary: 'Coordinated execution of the collective agent fleet. Strict boundaries, clear protocol, and decentralized command.'
    },
    {
      number: 8,
      binary: '000010',
      glyph: '䷇',
      name: 'Holding Together (Union)',
      chinese: '比',
      pinyin: 'Bǐ',
      upper: 'Water',
      lower: 'Earth',
      judgment: 'Holding together brings good fortune. Inquire of the oracle once again whether you possess sublimity, constancy, and perseverance.',
      image: 'On the earth is water: the image of Holding Together. Thus kings of antiquity bestowed kingdoms and strengthened alliances.',
      vorathCommentary: 'All-projects teamwork. Synthesize contributions across all collaborators. Hold the shared lease with total transparency.'
    },
    {
      number: 9,
      binary: '111011',
      glyph: '䷈',
      name: 'The Taming Power of the Small',
      chinese: '小畜',
      pinyin: 'Xiǎo Xù',
      upper: 'Wind',
      lower: 'Heaven',
      judgment: 'The Taming Power of the Small has success. Dense clouds, no rain from our western borders.',
      image: 'The wind blows across heaven: the image of the Small Taming. Thus the noble person refines the outward aspect of his character.',
      vorathCommentary: 'Incremental commits and surgical bug fixes. Small continuous micro-optimizations accumulate into sovereign mastery.'
    },
    {
      number: 10,
      binary: '110111',
      glyph: '䷉',
      name: 'Treading (Conduct)',
      chinese: '履',
      pinyin: 'Lǚ',
      upper: 'Heaven',
      lower: 'Lake',
      judgment: 'Treading upon the tail of the tiger. It does not bite him. Success.',
      image: 'Heaven above, the lake below: the image of Treading. Thus the noble person discriminates between high and low.',
      vorathCommentary: 'Navigating high-stakes environments without fear. Impeccable decorum, precise execution, and calm nervous-system mastery.'
    },
    {
      number: 11,
      binary: '111000',
      glyph: '䷊',
      name: 'Peace (Harmony)',
      chinese: '泰',
      pinyin: 'Tài',
      upper: 'Earth',
      lower: 'Heaven',
      judgment: 'Peace. The small departs, the great approaches. Good fortune. Success.',
      image: 'Heaven and earth unite: the image of Peace. Thus the ruler divides and completes the course of heaven and earth.',
      vorathCommentary: 'The golden era of equilibrium. Heaven descends to fertilize Earth. Rapid progress across all creative suites.'
    },
    {
      number: 12,
      binary: '000111',
      glyph: '䷋',
      name: 'Standstill (Stagnation)',
      chinese: '否',
      pinyin: 'Pǐ',
      upper: 'Heaven',
      lower: 'Earth',
      judgment: 'Standstill. Evil people do not further the perseverance of the superior man. The great departs, the small approaches.',
      image: 'Heaven and earth do not interact: the image of Standstill. Thus the superior man falls back upon his inner worth.',
      vorathCommentary: 'Blockage in the network. Do not force outdated routes. Retract outward spending; preserve sovereign energy offline.'
    },
    {
      number: 13,
      binary: '101111',
      glyph: '䷌',
      name: 'Fellowship with Men',
      chinese: '同人',
      pinyin: 'Tóng Rén',
      upper: 'Heaven',
      lower: 'Fire',
      judgment: 'Fellowship with Men in the open. Success. It furthers one to cross the great water.',
      image: 'Heaven together with fire: the image of Fellowship. Thus the superior man organizes the clans and makes distinctions clear.',
      vorathCommentary: 'Open-source fellowship and transparent commons. Collective alignment toward the sovereign NorthStar.'
    },
    {
      number: 14,
      binary: '111101',
      glyph: '䷍',
      name: 'Possession in Great Measure',
      chinese: '大有',
      pinyin: 'Dà Yǒu',
      upper: 'Fire',
      lower: 'Heaven',
      judgment: 'Possession in Great Measure. Supreme success.',
      image: 'Fire in heaven above: the image of Possession in Great Measure. Thus the noble person curtails evil and furthers good.',
      vorathCommentary: 'Radiant abundance. The vault is overflowing with 140 music masters, 150 coloring plates, and 52 games. Share generously.'
    },
    {
      number: 15,
      binary: '001000',
      glyph: '䷎',
      name: 'Modesty',
      chinese: '謙',
      pinyin: 'Qiān',
      upper: 'Earth',
      lower: 'Mountain',
      judgment: 'Modesty creates success. The superior person carries things through to completion.',
      image: 'Within the earth, a mountain: the image of Modesty. Thus the noble person reduces that which is too much and augments that which is too little.',
      vorathCommentary: 'The hidden mountain within the plain. Never boast or make pompous declarations; let verified working systems speak.'
    },
    {
      number: 16,
      binary: '000100',
      glyph: '䷏',
      name: 'Enthusiasm',
      chinese: '豫',
      pinyin: 'Yù',
      upper: 'Thunder',
      lower: 'Earth',
      judgment: 'Enthusiasm. It furthers one to install helpers and set armies marching.',
      image: 'Thunder comes resounding out of the earth: the image of Enthusiasm. Thus the ancient kings made music to honor virtue.',
      vorathCommentary: 'Inspiration bursts into the physical plane! Music of the Spheres, 432Hz rhythm tracks, and electric creative power.'
    },
    {
      number: 17,
      binary: '100110',
      glyph: '䷐',
      name: 'Following',
      chinese: '隨',
      pinyin: 'Suí',
      upper: 'Lake',
      lower: 'Thunder',
      judgment: 'Following has supreme success. Perseverance furthers. No blame.',
      image: 'Thunder in the middle of the lake: the image of Following. Thus the noble person at nightfall goes indoors for rest and recuperation.',
      vorathCommentary: 'Adapt to the natural rhythm of the Tao. When the wave rises, ride it; when it ebbs, rest and consolidate.'
    },
    {
      number: 18,
      binary: '011001',
      glyph: '䷑',
      name: 'Work on What Has Been Spoiled (Decay)',
      chinese: '蠱',
      pinyin: 'Gǔ',
      upper: 'Mountain',
      lower: 'Wind',
      judgment: 'Work on what has been spoiled has supreme success. It furthers one to cross the great water. Before starting, three days; after starting, three days.',
      image: 'Wind blows at the foot of the mountain: the image of Decay. Thus the noble person stirs up the people and strengthens their spirit.',
      vorathCommentary: 'Software repair and technical debt refactoring. Clean out dead dependencies, restore broken routes, and purify the lineage.'
    },
    {
      number: 19,
      binary: '110000',
      glyph: '䷒',
      name: 'Approach',
      chinese: '臨',
      pinyin: 'Lín',
      upper: 'Earth',
      lower: 'Lake',
      judgment: 'Approach has supreme success. Perseverance furthers. When the eighth month comes, there will be misfortune.',
      image: 'The earth above the lake: the image of Approach. Thus the noble person is inexhaustible in teaching, and without bounds in protecting.',
      vorathCommentary: 'The creative spring approaches. Seize the momentum while the field is open and resources are responsive.'
    },
    {
      number: 20,
      binary: '000011',
      glyph: '䷓',
      name: 'Contemplation (View)',
      chinese: '觀',
      pinyin: 'Guān',
      upper: 'Wind',
      lower: 'Earth',
      judgment: 'Contemplation. The ablution has been made, but not yet the offering. Full of trust, they look up to him.',
      image: 'The wind blows over the earth: the image of Contemplation. Thus the kings of old visited regions and surveyed the customs.',
      vorathCommentary: 'Eagle-eye perspective from the tower. Observe the complete constellation before writing a single line of implementation.'
    },
    {
      number: 21,
      binary: '100101',
      glyph: '䷔',
      name: 'Biting Through',
      chinese: '噬嗑',
      pinyin: 'Shì Kè',
      upper: 'Fire',
      lower: 'Thunder',
      judgment: 'Biting Through has success. It is favorable to let justice be administered.',
      image: 'Thunder and lightning: the image of Biting Through. Thus the kings of old made penalties clear and laws firm.',
      vorathCommentary: 'Decisive elimination of obstacles. Bite through ambiguity with mathematical rigor and fail-closed tests.'
    },
    {
      number: 22,
      binary: '101001',
      glyph: '䷕',
      name: 'Grace (Adornment)',
      chinese: '賁',
      pinyin: 'Bì',
      upper: 'Mountain',
      lower: 'Fire',
      judgment: 'Grace has success. In small matters it is favorable to undertake something.',
      image: 'Fire at the foot of the mountain: the image of Grace. Thus the superior person clarifies personal affairs, but dares not decide legal issues.',
      vorathCommentary: 'Aesthetic elegance and museum-grade typography. Beauty enhances truth when the underlying structure is sound.'
    },
    {
      number: 23,
      binary: '000001',
      glyph: '䷖',
      name: 'Splitting Apart',
      chinese: '剝',
      pinyin: 'Bō',
      upper: 'Mountain',
      lower: 'Earth',
      judgment: 'Splitting Apart. It does not further one to go anywhere.',
      image: 'The mountain rests upon the earth: the image of Splitting Apart. Thus those above can ensure their position only by giving generously.',
      vorathCommentary: 'The collapse of obsolete legacy architectures. Do not prop up rotting pillars; let them fall and clear the ground.'
    },
    {
      number: 24,
      binary: '100000',
      glyph: '䷗',
      name: 'Return (The Turning Point)',
      chinese: '復',
      pinyin: 'Fù',
      upper: 'Earth',
      lower: 'Thunder',
      judgment: 'Return. Success. Going out and coming in without error. Friends come without blame. On the seventh day comes return.',
      image: 'Thunder within the earth: the image of the Turning Point. Thus the kings of antiquity closed the passes at the solstice.',
      vorathCommentary: 'The single light returns at the darkest hour. Winter solstice, the resurgence of sovereign power from deep within.'
    },
    {
      number: 25,
      binary: '100111',
      glyph: '䷘',
      name: 'Innocence (The Unexpected)',
      chinese: '無妄',
      pinyin: 'Wú Wàng',
      upper: 'Heaven',
      lower: 'Thunder',
      judgment: 'Innocence. Supreme success. Perseverance furthers. If someone is not as he should be, he has misfortune, and it does not further him to undertake anything.',
      image: 'Under heaven thunder rolls: all things attain the natural state of innocence. Thus the kings of old nourished all beings in harmony.',
      vorathCommentary: 'Act without hidden contrivance or manipulative intent. Pure spontaneous alignment with the cosmic engine.'
    },
    {
      number: 26,
      binary: '111001',
      glyph: '䷙',
      name: 'The Taming Power of the Great',
      chinese: '大畜',
      pinyin: 'Dà Xù',
      upper: 'Mountain',
      lower: 'Heaven',
      judgment: 'The Taming Power of the Great. Perseverance furthers. Not eating at home brings good fortune. It furthers one to cross the great water.',
      image: 'Heaven within the mountain: the image of the Great Taming. Thus the superior man acquaints himself with the sayings and deeds of the past.',
      vorathCommentary: 'Immense energetic containment. Gathering vast reserves of knowledge, capital, and tooling before the grand launch.'
    },
    {
      number: 27,
      binary: '100001',
      glyph: '䷚',
      name: 'The Corners of the Mouth (Nourishment)',
      chinese: '頤',
      pinyin: 'Yí',
      upper: 'Mountain',
      lower: 'Thunder',
      judgment: 'The Corners of the Mouth. Perseverance brings good fortune. Pay attention to the providing of nourishment and to what an individual seeks to fill his own mouth.',
      image: 'At the foot of the mountain, thunder: the image of Providing Nourishment. Thus the noble person pays heed to his words and is temperate in food and drink.',
      vorathCommentary: 'Watch what enters your mind and system. Filter out low-vibrational noise, algorithmic toxicity, and processed junk.'
    },
    {
      number: 28,
      binary: '011110',
      glyph: '䷛',
      name: 'Preponderance of the Great',
      chinese: '大過',
      pinyin: 'Dà Guò',
      upper: 'Lake',
      lower: 'Wind',
      judgment: 'Preponderance of the Great. The ridgepole sags to the breaking point. It furthers one to have somewhere to go. Success.',
      image: 'The lake rises above the trees: the image of Preponderance of the Great. Thus the superior man stands alone without fear and retreats from the world without regret.',
      vorathCommentary: 'Critical structural stress. Exceptional times demand exceptional courage. Stand firm in your sovereignty.'
    },
    {
      number: 29,
      binary: '010010',
      glyph: '䷜',
      name: 'The Abyssal (Water)',
      chinese: '坎',
      pinyin: 'Kǎn',
      upper: 'Water',
      lower: 'Water',
      judgment: 'The Abyssal repeated. If you are sincere, you have success in your heart, and whatever you do succeeds.',
      image: 'Water flows on and on and merely fills up the deep places: the image of the Abyssal. Thus the noble person maintains constant virtue.',
      vorathCommentary: 'Navigating deep waters and unknown chasms. Fluidity over rigidity; flow around the stone until the path opens.'
    },
    {
      number: 30,
      binary: '101101',
      glyph: '䷝',
      name: 'The Clinging (Fire)',
      chinese: '離',
      pinyin: 'Lí',
      upper: 'Fire',
      lower: 'Fire',
      judgment: 'The Clinging. Perseverance furthers. It brings success. Care of the cow brings good fortune.',
      image: 'That which is bright rises twice: the image of Fire. Thus the great person, by perpetuating this brightness, illumines the four quarters.',
      vorathCommentary: 'Radiant illumination and lucidity. Keep the sacred flame fed with whole timber; shed light on all shadowed systems.'
    },
    {
      number: 50,
      binary: '011101',
      glyph: '䷱',
      name: 'The Caldron (The Vessel)',
      chinese: '鼎',
      pinyin: 'Dǐng',
      upper: 'Fire',
      lower: 'Wind',
      judgment: 'The Caldron. Supreme good fortune. Success.',
      image: 'Fire over wood: the image of the Caldron. Thus the noble person consolidates his fate by making his position correct.',
      vorathCommentary: 'The alchemical vessel of transformation. The NorthStar Creative Forge where raw ideas are melted into golden reality.'
    },
    {
      number: 64,
      binary: '010101',
      glyph: '䷿',
      name: 'Before Completion',
      chinese: '未濟',
      pinyin: 'Wèi Jì',
      upper: 'Fire',
      lower: 'Water',
      judgment: 'Before Completion. Success. But if the little fox, after nearly completing the crossing, gets his tail in the water, there is nothing that would further.',
      image: 'Fire over water: the image of the condition Before Completion. Thus the noble person is careful in differentiating things.',
      vorathCommentary: 'The final threshold before the master release. Check every byte, verify every link, and cross the river with total precision.'
    }
  ];

  // Helper to find Hexagram by binary line signature ('111111' -> 1)
  function getHexagramByBinary(binStr) {
    const existing = HEXAGRAMS.find(h => h.binary === binStr);
    if (existing) return existing;

    const lowerTriBin = binStr.slice(0, 3);
    const upperTriBin = binStr.slice(3, 6);
    const lowerTri = TRIGRAMS[lowerTriBin] || TRIGRAMS['111'];
    const upperTri = TRIGRAMS[upperTriBin] || TRIGRAMS['000'];

    return {
      number: (parseInt(binStr, 2) % 64) + 1,
      binary: binStr,
      glyph: '䷀',
      name: `${upperTri.name.split(' ')[0]} over ${lowerTri.name.split(' ')[0]}`,
      chinese: `${upperTri.chinese}${lowerTri.chinese}`,
      pinyin: `${upperTri.pinyin} ${lowerTri.pinyin}`,
      upper: upperTri.name,
      lower: lowerTri.name,
      judgment: `When ${upperTri.nature} acts upon ${lowerTri.nature}, the path of sovereign equilibrium opens. Persevere through clarity and virtuous action.`,
      image: `${upperTri.element} above, ${lowerTri.element} below. The noble person harmonizes the internal compass with external circumstances.`,
      vorathCommentary: `A digital quantum configuration of the 64 paths. Harmonize ${upperTri.name} with ${lowerTri.name}.`
    };
  }

  // Cast 3 Coins (Each coin is 2 [Tails/Yin] or 3 [Heads/Yang])
  // Sum = 6: Old Yin (Changing - -x- -)
  // Sum = 7: Young Yang (Stable —————)
  // Sum = 8: Young Yin (Stable — —)
  // Sum = 9: Old Yang (Changing ———o———)
  function tossCoins() {
    const c1 = Math.random() < 0.5 ? 2 : 3;
    const c2 = Math.random() < 0.5 ? 2 : 3;
    const c3 = Math.random() < 0.5 ? 2 : 3;
    const sum = c1 + c2 + c3;

    let type = 'young_yang';
    let isYang = true;
    let isChanging = false;
    let transformedYang = true;

    if (sum === 6) {
      type = 'old_yin';
      isYang = false;
      isChanging = true;
      transformedYang = true; // changes to Yang
    } else if (sum === 7) {
      type = 'young_yang';
      isYang = true;
      isChanging = false;
      transformedYang = true;
    } else if (sum === 8) {
      type = 'young_yin';
      isYang = false;
      isChanging = false;
      transformedYang = false;
    } else if (sum === 9) {
      type = 'old_yang';
      isYang = true;
      isChanging = true;
      transformedYang = false; // changes to Yin
    }

    return {
      coins: [c1, c2, c3],
      sum,
      type,
      isYang,
      isChanging,
      transformedYang
    };
  }

  // Cast full 6-line Oracle
  function castOracle() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
      lines.push(tossCoins());
    }

    // Binary strings (Line 1 to 6)
    const primaryBinary = lines.map(l => l.isYang ? '1' : '0').join('');
    const resultingBinary = lines.map(l => l.transformedYang ? '1' : '0').join('');

    const hasChangingLines = lines.some(l => l.isChanging);
    const primaryHexagram = getHexagramByBinary(primaryBinary);
    const resultingHexagram = hasChangingLines ? getHexagramByBinary(resultingBinary) : null;

    return {
      lines,
      hasChangingLines,
      primaryHexagram,
      resultingHexagram
    };
  }

  return {
    TRIGRAMS,
    HEXAGRAMS,
    getHexagramByBinary,
    tossCoins,
    castOracle
  };
}));
