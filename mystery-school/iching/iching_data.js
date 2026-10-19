/**
 * AETHERIA I CHING KNOWLEDGE ENGINE
 * Complete sourced 64-identity King Wen lookup; coin-line transformations.
 * All64 main judgments and Great Image passages: James Legge (1882).
 * No changing-line translation corpus is supplied. See SOURCES.md.
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

  // Identity only: King Wen order/line signatures from Legge (1882),
  // Unicode names/code points from official UCD NamesList; see SOURCES.md.
  const KING_WEN_IDENTITIES = [
    [1, '111111', "HEXAGRAM FOR THE CREATIVE HEAVEN"],
    [2, '000000', "HEXAGRAM FOR THE RECEPTIVE EARTH"],
    [3, '100010', "HEXAGRAM FOR DIFFICULTY AT THE BEGINNING"],
    [4, '010001', "HEXAGRAM FOR YOUTHFUL FOLLY"],
    [5, '111010', "HEXAGRAM FOR WAITING"],
    [6, '010111', "HEXAGRAM FOR CONFLICT"],
    [7, '010000', "HEXAGRAM FOR THE ARMY"],
    [8, '000010', "HEXAGRAM FOR HOLDING TOGETHER"],
    [9, '111011', "HEXAGRAM FOR SMALL TAMING"],
    [10, '110111', "HEXAGRAM FOR TREADING"],
    [11, '111000', "HEXAGRAM FOR PEACE"],
    [12, '000111', "HEXAGRAM FOR STANDSTILL"],
    [13, '101111', "HEXAGRAM FOR FELLOWSHIP"],
    [14, '111101', "HEXAGRAM FOR GREAT POSSESSION"],
    [15, '001000', "HEXAGRAM FOR MODESTY"],
    [16, '000100', "HEXAGRAM FOR ENTHUSIASM"],
    [17, '100110', "HEXAGRAM FOR FOLLOWING"],
    [18, '011001', "HEXAGRAM FOR WORK ON THE DECAYED"],
    [19, '110000', "HEXAGRAM FOR APPROACH"],
    [20, '000011', "HEXAGRAM FOR CONTEMPLATION"],
    [21, '100101', "HEXAGRAM FOR BITING THROUGH"],
    [22, '101001', "HEXAGRAM FOR GRACE"],
    [23, '000001', "HEXAGRAM FOR SPLITTING APART"],
    [24, '100000', "HEXAGRAM FOR RETURN"],
    [25, '100111', "HEXAGRAM FOR INNOCENCE"],
    [26, '111001', "HEXAGRAM FOR GREAT TAMING"],
    [27, '100001', "HEXAGRAM FOR MOUTH CORNERS"],
    [28, '011110', "HEXAGRAM FOR GREAT PREPONDERANCE"],
    [29, '010010', "HEXAGRAM FOR THE ABYSMAL WATER"],
    [30, '101101', "HEXAGRAM FOR THE CLINGING FIRE"],
    [31, '001110', "HEXAGRAM FOR INFLUENCE"],
    [32, '011100', "HEXAGRAM FOR DURATION"],
    [33, '001111', "HEXAGRAM FOR RETREAT"],
    [34, '111100', "HEXAGRAM FOR GREAT POWER"],
    [35, '000101', "HEXAGRAM FOR PROGRESS"],
    [36, '101000', "HEXAGRAM FOR DARKENING OF THE LIGHT"],
    [37, '101011', "HEXAGRAM FOR THE FAMILY"],
    [38, '110101', "HEXAGRAM FOR OPPOSITION"],
    [39, '001010', "HEXAGRAM FOR OBSTRUCTION"],
    [40, '010100', "HEXAGRAM FOR DELIVERANCE"],
    [41, '110001', "HEXAGRAM FOR DECREASE"],
    [42, '100011', "HEXAGRAM FOR INCREASE"],
    [43, '111110', "HEXAGRAM FOR BREAKTHROUGH"],
    [44, '011111', "HEXAGRAM FOR COMING TO MEET"],
    [45, '000110', "HEXAGRAM FOR GATHERING TOGETHER"],
    [46, '011000', "HEXAGRAM FOR PUSHING UPWARD"],
    [47, '010110', "HEXAGRAM FOR OPPRESSION"],
    [48, '011010', "HEXAGRAM FOR THE WELL"],
    [49, '101110', "HEXAGRAM FOR REVOLUTION"],
    [50, '011101', "HEXAGRAM FOR THE CAULDRON"],
    [51, '100100', "HEXAGRAM FOR THE AROUSING THUNDER"],
    [52, '001001', "HEXAGRAM FOR THE KEEPING STILL MOUNTAIN"],
    [53, '001011', "HEXAGRAM FOR DEVELOPMENT"],
    [54, '110100', "HEXAGRAM FOR THE MARRYING MAIDEN"],
    [55, '101100', "HEXAGRAM FOR ABUNDANCE"],
    [56, '001101', "HEXAGRAM FOR THE WANDERER"],
    [57, '011011', "HEXAGRAM FOR THE GENTLE WIND"],
    [58, '110110', "HEXAGRAM FOR THE JOYOUS LAKE"],
    [59, '010011', "HEXAGRAM FOR DISPERSION"],
    [60, '110010', "HEXAGRAM FOR LIMITATION"],
    [61, '110011', "HEXAGRAM FOR INNER TRUTH"],
    [62, '001100', "HEXAGRAM FOR SMALL PREPONDERANCE"],
    [63, '101010', "HEXAGRAM FOR AFTER COMPLETION"],
    [64, '010101', "HEXAGRAM FOR BEFORE COMPLETION"]
  ];
  // Public-domain Legge (1882) transcription; exact anchors and corrections in tests/fixtures.
  const LEGGE_PASSAGES = [
    {
      "number": 1,
      "judgment": "Khien (represents) what is great and originating, penetrating, advantageous, correct and firm.",
      "image": "Heaven, in its motion, (gives the idea of) strength. The superior man, in accordance with this, nerves himself to ceaseless activity.",
      "sources": {
        "judgment": [
          {
            "page": 57,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n90/mode/1up"
          }
        ],
        "image": [
          {
            "page": 267,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n300/mode/1up"
          }
        ]
      }
    },
    {
      "number": 2,
      "judgment": "Khwan (represents) what is great and originating, penetrating, advantageous, correct and having the firmness of a mare. When the superior man (here intended) has to make any movement, if he take the initiative, he will go astray; if he follow, he will find his (proper) lord. The advantageousness will be seen in his getting friends in the south-west, and losing friends in the north-east. If he rest in correctness and firmness, there will be good fortune.",
      "image": "The (capacity and sustaining) power of the earth is what is denoted by Khwan. The superior man, in accordance with this, with his large virtue supports (men and) things.",
      "sources": {
        "judgment": [
          {
            "page": 59,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n92/mode/1up"
          },
          {
            "page": 60,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n93/mode/1up"
          }
        ],
        "image": [
          {
            "page": 268,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n301/mode/1up"
          }
        ]
      }
    },
    {
      "number": 3,
      "judgment": "Kun (indicates that in the case which it presupposes) there will be great progress and success, and the advantage will come from being correct and firm. (But) any movement in advance should not be (lightly) undertaken. There will be advantage in appointing feudal princes.",
      "image": "(The trigram representing) clouds and (that representing) thunder form Kun. The superior man, in accordance with this, (adjusts his measures of government) as in sorting the threads of the warp and woof.",
      "sources": {
        "judgment": [
          {
            "page": 62,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n95/mode/1up"
          }
        ],
        "image": [
          {
            "page": 270,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n303/mode/1up"
          }
        ]
      }
    },
    {
      "number": 4,
      "judgment": "Mang (indicates that in the case which it presupposes) there will be progress and success. I do not (go and) seek the youthful and inexperienced, but he comes and seeks me. When he shows (the sincerity that marks) the first recourse to divination, I instruct him. If he apply a second and third time, that is troublesome; and I do not instruct the troublesome. There will be advantage in being firm and correct.",
      "image": "(The trigram representing) a mountain, and beneath it that for a spring issuing forth form Mang. The superior man, in accordance with this, strives to be resolute in his conduct and nourishes his virtue.",
      "sources": {
        "judgment": [
          {
            "page": 64,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n97/mode/1up"
          },
          {
            "page": 65,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n98/mode/1up"
          }
        ],
        "image": [
          {
            "page": 271,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n304/mode/1up"
          }
        ]
      }
    },
    {
      "number": 5,
      "judgment": "Hsu intimates that, with the sincerity which is declared in it, there will be brilliant success. With firmness there will be good fortune; and it will be advantageous to cross the great stream.",
      "image": "(The trigram for) clouds ascending over that for the sky forms Hsu. The superior man, in accordance with this, eats and drinks, feasts and enjoys himself (as if there were nothing else to employ him).",
      "sources": {
        "judgment": [
          {
            "page": 67,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n100/mode/1up"
          }
        ],
        "image": [
          {
            "page": 272,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n305/mode/1up"
          },
          {
            "page": 273,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n306/mode/1up"
          }
        ]
      }
    },
    {
      "number": 6,
      "judgment": "Sung intimates how, though there is sincerity in one's contention, he will yet meet with opposition and obstruction; but if he cherish an apprehensive caution, there will be good fortune, while, if he must prosecute the contention to the (bitter) end, there will be evil. It will be advantageous to see the great man; it will not be advantageous to cross the great stream.",
      "image": "(The trigram representing) heaven and (that representing) water, moving away from each other, form Sung. The superior man, in accordance with this, in the transaction of affairs takes good counsel about his first steps.",
      "sources": {
        "judgment": [
          {
            "page": 69,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n102/mode/1up"
          }
        ],
        "image": [
          {
            "page": 274,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n307/mode/1up"
          }
        ]
      }
    },
    {
      "number": 7,
      "judgment": "Sze indicates how, in the case which it supposes, with firmness and correctness, and (a leader of) age and experience, there will be good fortune and no error.",
      "image": "(The trigram representing) the earth and in the midst of it that representing water, form Sze. The superior man, in accordance with this, nourishes and educates the people, and collects (from among them) the multitudes (of the hosts).",
      "sources": {
        "judgment": [
          {
            "page": 71,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n104/mode/1up"
          },
          {
            "page": 72,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n105/mode/1up"
          }
        ],
        "image": [
          {
            "page": 275,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n308/mode/1up"
          }
        ]
      }
    },
    {
      "number": 8,
      "judgment": "Pi indicates that (under the conditions which it supposes) there is good fortune. But let (the principal party intended in it) re-examine himself, (as if) by divination, whether his virtue be great, unintermitting, and firm. If it be so, there will be no error. Those who have not rest will then come to him; and with those who are (too) late in coming it will be ill.",
      "image": "(The trigram representing) the earth, and over it (that representing) water, form Pi. The ancient kings, in accordance with this, established the various states and maintained an affectionate relation to their princes.",
      "sources": {
        "judgment": [
          {
            "page": 73,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n106/mode/1up"
          },
          {
            "page": 74,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n107/mode/1up"
          }
        ],
        "image": [
          {
            "page": 277,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n310/mode/1up"
          }
        ]
      }
    },
    {
      "number": 9,
      "judgment": "Hsiao Khu indicates that (under its conditions) there will be progress and success. (We see) dense clouds, but no rain coming from our borders in the west.",
      "image": "(The trigram representing) the sky, and that representing wind moving above it, form Hsiao Khu. The superior man, in accordance with this, adorns the outward manifestation of his virtue.",
      "sources": {
        "judgment": [
          {
            "page": 76,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n109/mode/1up"
          }
        ],
        "image": [
          {
            "page": 278,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n311/mode/1up"
          }
        ]
      }
    },
    {
      "number": 10,
      "judgment": "(Li suggests the idea of) one treading on the tail of a tiger, which does not bite him. There will be progress and success.",
      "image": "(The trigram representing) the sky above, and below it (that representing the waters of) a marsh, form Li. The superior man, in accordance with this, discriminates between high and low, and gives settlement to the aims of the people.",
      "sources": {
        "judgment": [
          {
            "page": 78,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n111/mode/1up"
          }
        ],
        "image": [
          {
            "page": 280,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n313/mode/1up"
          }
        ]
      }
    },
    {
      "number": 11,
      "judgment": "In Thai (we see) the little gone and the great come. (It indicates that) there will be good fortune, with progress and success.",
      "image": "(The trigrams for) heaven and earth in communication together form Thai. The (sage) sovereign, in harmony with this, fashions and completes (his regulations) after the courses of heaven and earth, and assists the application of the adaptations furnished by them, — in order to benefit the people.",
      "sources": {
        "judgment": [
          {
            "page": 81,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n114/mode/1up"
          }
        ],
        "image": [
          {
            "page": 281,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n314/mode/1up"
          }
        ]
      }
    },
    {
      "number": 12,
      "judgment": "In Phi there is the want of good understanding between the (different classes of) men, and its indication is unfavourable to the firm and correct course of the superior man. We see in it the great gone and the little come.",
      "image": "(The trigrams of) heaven and earth, not in intercommunication, form Phi. The superior man, in accordance with this, restrains (the manifestation) of) his virtue, and avoids the calamities (that threaten him). There is no opportunity of conferring on him the glory of emolument.",
      "sources": {
        "judgment": [
          {
            "page": 83,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n116/mode/1up"
          },
          {
            "page": 84,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n117/mode/1up"
          }
        ],
        "image": [
          {
            "page": 282,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n315/mode/1up"
          }
        ]
      }
    },
    {
      "number": 13,
      "judgment": "Thung Zan (or 'Union of men') appears here (as we find it) in the (remote districts of the) country, indicating progress and success. It will be advantageous to cross the great stream. It will be adadvantageous to maintain the firm correctness of the superior man.",
      "image": "(The trigrams for) heaven and fire form Thung Zan. The superior man, in accordance with this), distinguishes things according to their kinds and classes.",
      "sources": {
        "judgment": [
          {
            "page": 86,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n119/mode/1up"
          }
        ],
        "image": [
          {
            "page": 284,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n317/mode/1up"
          }
        ]
      }
    },
    {
      "number": 14,
      "judgment": "Ta Yu indicates that, (under the circumstances which it implies), there will be great progress and success.",
      "image": "(The trigram for) heaven and (that of) fire above it form Ta Yu. The superior man, in accordance with this, represses what is evil and gives distinction to what is good, in sympathy with the excellent Heaven-conferred (nature).",
      "sources": {
        "judgment": [
          {
            "page": 88,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n121/mode/1up"
          }
        ],
        "image": [
          {
            "page": 285,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n318/mode/1up"
          }
        ]
      }
    },
    {
      "number": 15,
      "judgment": "Khien indicates progress and success. The superior man, (being humble as it implies), will have a (good) issue (to his undertakings).",
      "image": "(The trigram for) the earth and (that of) a mountain in the midst of it form Khien. The superior man, in accordance with this, diminishes what is excessive (in himself), and increases where there is any defect, bringing about an equality, according to the nature of the case, in his treatment (of himself and others).",
      "sources": {
        "judgment": [
          {
            "page": 89,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n122/mode/1up"
          }
        ],
        "image": [
          {
            "page": 286,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n319/mode/1up"
          }
        ]
      }
    },
    {
      "number": 16,
      "judgment": "Yu indicates that, (in the state which it implies), feudal princes may be set up, and the hosts put in motion, with advantage.",
      "image": "(The trigrams for) the earth and thunder issuing from it with its crashing noise form Yu. The ancient kings, in accordance with this, composed their music and did honour to virtue, presenting it especially and most grandly to God, when they associated with Him (at the service) their highest ancestor and their father.",
      "sources": {
        "judgment": [
          {
            "page": 91,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n124/mode/1up"
          }
        ],
        "image": [
          {
            "page": 287,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n320/mode/1up"
          },
          {
            "page": 288,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n321/mode/1up"
          }
        ]
      }
    },
    {
      "number": 17,
      "judgment": "Sui indicates that (under its conditions) there will be great progress and success. But it will be advantageous to be firm and correct. There will (then) be no error.",
      "image": "(The trigram for the waters of) a marsh and (that for) thunder (hidden) in the midst of it form Sui. The superior man in accordance with this, when it is getting towards dark, enters (his house) and rests.",
      "sources": {
        "judgment": [
          {
            "page": 93,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n126/mode/1up"
          }
        ],
        "image": [
          {
            "page": 289,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n322/mode/1up"
          }
        ]
      }
    },
    {
      "number": 18,
      "judgment": "Ku indicates great progress and success (to him who deals properly with the condition represented by it). There will be advantage in (efforts like that of) crossing the great stream. (He should weigh well, however, the events of) three days before the turning point, and those (to be done) three days after it.",
      "image": "(The trigram for) a mountain, and below it that for wind, form Ku. The superior man, in accordance with this, (addresses himself to) help the people and nourish his own virtue.",
      "sources": {
        "judgment": [
          {
            "page": 95,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n128/mode/1up"
          }
        ],
        "image": [
          {
            "page": 290,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n323/mode/1up"
          }
        ]
      }
    },
    {
      "number": 19,
      "judgment": "Lin (indicates that under the conditions supposed in it) there will be great progress and success, while it will be advantageous to be firmly correct. In the eighth month there will be evil.",
      "image": "(The trigram for) the waters of a marsh and that for the earth above it form Lin. The superior man, in accordance with this, has his purposes of instruction that are inexhaustible, and nourishes and supports the people without limit.",
      "sources": {
        "judgment": [
          {
            "page": 97,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n130/mode/1up"
          }
        ],
        "image": [
          {
            "page": 291,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n324/mode/1up"
          }
        ]
      }
    },
    {
      "number": 20,
      "judgment": "Kwan shows (how he whom it represents should be like) the worshipper who has washed his hands, but not (yet) presented his offerings; — with sincerity and an appearance of dignity (commanding reverent regard).",
      "image": "(The trigram representing) the earth, and that for wind moving above it, form Kwan. The ancient kings, in accordance with this, examined the (different) regions (of the kingdom), to see the (ways of the) people, and set forth their instructions.",
      "sources": {
        "judgment": [
          {
            "page": 99,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n132/mode/1up"
          },
          {
            "page": 100,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n133/mode/1up"
          }
        ],
        "image": [
          {
            "page": 292,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n325/mode/1up"
          }
        ]
      }
    },
    {
      "number": 21,
      "judgment": "Shih Ho indicates successful progress (in the condition of things which it supposes). It will be advantageous to use legal constraints.",
      "image": "(The trigrams representing) thunder and lightning form Shih Ho. The ancient kings, in accordance with this, framed their penalties with intelligence, and promulgated their laws.",
      "sources": {
        "judgment": [
          {
            "page": 101,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n134/mode/1up"
          }
        ],
        "image": [
          {
            "page": 293,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n326/mode/1up"
          }
        ]
      }
    },
    {
      "number": 22,
      "judgment": "Pi indicates that there should be free course (in what it denotes). There will be little advantage (however) if it be allowed to advance (and take the lead).",
      "image": "(The trigram representing) a mountain and that for fire under it form Pi. The superior man, in accordance with this, throws a brilliancy around his various processes of government, but does not dare (in a similar way) to decide cases of criminal litigation.",
      "sources": {
        "judgment": [
          {
            "page": 103,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n136/mode/1up"
          }
        ],
        "image": [
          {
            "page": 294,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n327/mode/1up"
          }
        ]
      }
    },
    {
      "number": 23,
      "judgment": "Po indicates that (in the state which it symbolises) it will not be advantageous to make a movement in any direction whatever.",
      "image": "(The trigrams representing) the earth, and (above it) that for a mountain, which adheres to the earth, form Po. Superiors, in accordance with this, seek to strengthen those below them, to secure the peace and stability of their own position.",
      "sources": {
        "judgment": [
          {
            "page": 105,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n138/mode/1up"
          }
        ],
        "image": [
          {
            "page": 296,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n329/mode/1up"
          }
        ]
      }
    },
    {
      "number": 24,
      "judgment": "Fu indicates that there will be free course and progress (in what it denotes). (The subject of it) finds no one to distress him in his exits and entrances; friends come to him, and no error is committed. He will return and repeat his (proper) course. In seven days comes his return. There will be advantage in whatever direction movement is made.",
      "image": "(The trigram representing) the earth and that for thunder in the midst of it form Fu. The ancient kings, in accordance with this, on the day of the (winter) solstice, shut the gates of the passes (from one state to another), so that the travelling merchants could not (then) pursue their journeys, nor the princes go on with the inspection of their states.",
      "sources": {
        "judgment": [
          {
            "page": 107,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n140/mode/1up"
          },
          {
            "page": 108,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n141/mode/1up"
          }
        ],
        "image": [
          {
            "page": 297,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n330/mode/1up"
          }
        ]
      }
    },
    {
      "number": 25,
      "judgment": "Wu Wang indicates great progress and success, while there will be advantage in being firm and correct. If (its subject and his action) be not correct, he will fall into errors, and it will not be advantageous for him to move in any direction.",
      "image": "The thunder rolls all under the sky, and to (every)thing there is given (its nature), free from all insincerity. The ancient kings, in accordance with this, (made their regulations) in complete accordance with the seasons, thereby nourishing all things.",
      "sources": {
        "judgment": [
          {
            "page": 109,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n142/mode/1up"
          },
          {
            "page": 110,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n143/mode/1up"
          }
        ],
        "image": [
          {
            "page": 299,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n332/mode/1up"
          }
        ]
      }
    },
    {
      "number": 26,
      "judgment": "Under the conditions of Ta Khu it will be advantageous to be firm and correct. (If its subject do not seek to) enjoy his revenues in his own family (without taking service at court), there will be good fortune. It will be advantageous for him to cross the great stream.",
      "image": "(The trigram representing) a mountain, and in the midst of it that (representing) heaven, form Ta Khu. The superior man, in accordance with this, stores largely in his memory the words and deeds of former men, to subserve the accumulation of his virtue.",
      "sources": {
        "judgment": [
          {
            "page": 112,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n145/mode/1up"
          }
        ],
        "image": [
          {
            "page": 300,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n333/mode/1up"
          }
        ]
      }
    },
    {
      "number": 27,
      "judgment": "I indicates that with firm correctness there will be good fortune (in what is denoted by it). We must look at what we are seeking to nourish, and by the exercise of our thoughts seek for the proper aliment.",
      "image": "(The trigram representing) a mountain and under it that for thunder form I. The superior man, in accordance with this, (enjoins) watchfulness over our words, and the temperate regulation of our eating and drinking.",
      "sources": {
        "judgment": [
          {
            "page": 114,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n147/mode/1up"
          }
        ],
        "image": [
          {
            "page": 301,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n334/mode/1up"
          }
        ]
      }
    },
    {
      "number": 28,
      "judgment": "Ta Kwo suggests to us a beam that is weak. There will be advantage in moving (under its conditions) in any direction whatever; there will be success.",
      "image": "(The trigram representing) trees hidden beneath that for the waters of a marsh forms Ta Kwo. The superior man, in accordance with this, stands up alone and has no fear, and keeps retired from the world without regret.",
      "sources": {
        "judgment": [
          {
            "page": 116,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n149/mode/1up"
          }
        ],
        "image": [
          {
            "page": 302,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n335/mode/1up"
          }
        ]
      }
    },
    {
      "number": 29,
      "judgment": "Khan, here repeated, shows the possession of sincerity, through which the mind is penetrating. Action (in accordance with this) will be of high value.",
      "image": "(The representation of) water flowing on continuously forms the repeated Khan. The superior man, in accordance with this, maintains constantly the virtue (of his heart) and (the integrity of) his conduct, and practises the business of instruction.",
      "sources": {
        "judgment": [
          {
            "page": 118,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n151/mode/1up"
          }
        ],
        "image": [
          {
            "page": 303,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n336/mode/1up"
          }
        ]
      }
    },
    {
      "number": 30,
      "judgment": "Li indicates that, (in regard to what it denotes), it will be advantageous to be firm and correct, and that thus there will be free course and success. Let (its subject) also nourish (a docility like that of) the cow, and there will be good fortune.",
      "image": "(The trigram for) brightness, repeated, forms Li. The great man, in accordance with this, cultivates more and more his brilliant (virtue), and diffuses its brightness over the four quarters (of the land).",
      "sources": {
        "judgment": [
          {
            "page": 120,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n153/mode/1up"
          },
          {
            "page": 121,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n154/mode/1up"
          }
        ],
        "image": [
          {
            "page": 304,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n337/mode/1up"
          }
        ]
      }
    },
    {
      "number": 31,
      "judgment": "Hsien indicates that, (on the fulfilment of the conditions implied in it), there will be free course and success. Its advantageousness will depend on the being firm and correct, (as) in marrying a young lady. There will be good fortune.",
      "image": "(The trigram representing) a mountain and above it that for (the waters of) a marsh form Hsien. The superior man, in accordance with this, keeps his mind free from pre-occupation, and open to receive (the influences of) others.",
      "sources": {
        "judgment": [
          {
            "page": 123,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n156/mode/1up"
          }
        ],
        "image": [
          {
            "page": 305,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n338/mode/1up"
          }
        ]
      }
    },
    {
      "number": 32,
      "judgment": "Hang indicates successful progress and no error (in what it denotes). But the advantage will come from being firm and correct; and movement in any direction whatever will be advantageous.",
      "image": "(The trigram representing) thunder and that for wind form Hang. The superior man, in accordance with this, stands firm, and does not change his method (of operation).",
      "sources": {
        "judgment": [
          {
            "page": 125,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n158/mode/1up"
          }
        ],
        "image": [
          {
            "page": 307,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n340/mode/1up"
          }
        ]
      }
    },
    {
      "number": 33,
      "judgment": "Thun indicates successful progress (in its circumstances). To a small extent it will (still) be advantageous to be firm and correct.",
      "image": "(The trigram representing) the sky and below it that for a mountain form Thun. The superior man, in accordance with this, keeps small men at a distance, not by showing that he hates them, but by his own dignified gravity.",
      "sources": {
        "judgment": [
          {
            "page": 127,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n160/mode/1up"
          }
        ],
        "image": [
          {
            "page": 308,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n341/mode/1up"
          }
        ]
      }
    },
    {
      "number": 34,
      "judgment": "Ta Kwang indicates that (under the conditions which it symbolises) it will be advantageous to be firm and correct.",
      "image": "(The trigram representing) heaven and above it that for thunder form Ta Kwang. The superior man, in accordance with this, does not take a step which is not according to propriety.",
      "sources": {
        "judgment": [
          {
            "page": 129,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n162/mode/1up"
          }
        ],
        "image": [
          {
            "page": 309,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n342/mode/1up"
          }
        ]
      }
    },
    {
      "number": 35,
      "judgment": "In Zin we see a prince who secures the tranquillity (of the people) presented on that account with numerous horses (by the king), and three times in a day received at interviews.",
      "image": "(The trigram representing) the earth and that for the bright (sun) coming forth above it form Zin. The superior man, according to this, gives himself to make more brilliant his bright virtue.",
      "sources": {
        "judgment": [
          {
            "page": 131,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n164/mode/1up"
          }
        ],
        "image": [
          {
            "page": 310,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n343/mode/1up"
          }
        ]
      }
    },
    {
      "number": 36,
      "judgment": "Ming I indicates that (in the circumstances which it denotes) it will be advantageous to realise the difficulty (of the position), and maintain firm correctness.",
      "image": "(The trigram representing) the earth and that for the bright (sun) entering within it form Ming I. The superior man, in accordance with this, conducts his management of men; — he shows his intelligence by keeping it obscured.",
      "sources": {
        "judgment": [
          {
            "page": 134,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n167/mode/1up"
          },
          {
            "page": 135,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n168/mode/1up"
          }
        ],
        "image": [
          {
            "page": 311,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n344/mode/1up"
          }
        ]
      }
    },
    {
      "number": 37,
      "judgment": "For (the realisation of what is taught in) Kia Zan, (or for the regulation of the family), what is most advantageous is that the wife be firm and correct.",
      "image": "(The trigram representing) fire, and that for wind coming forth from it, form Kia Zan. The superior man, in accordance with this, orders his words according to (the truth of) things, and his conduct so that it is uniformly consistent.",
      "sources": {
        "judgment": [
          {
            "page": 136,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n169/mode/1up"
          },
          {
            "page": 137,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n170/mode/1up"
          }
        ],
        "image": [
          {
            "page": 312,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n345/mode/1up"
          }
        ]
      }
    },
    {
      "number": 38,
      "judgment": "Khwei indicates that, (notwithstanding the condition of things which it denotes), in small matters there will (still) be good success.",
      "image": "(The trigram representing) fire above, and that for (the waters of) a marsh below, form Khwei. The superior man, in accordance with this, where there is a general agreement, yet admits diversity.",
      "sources": {
        "judgment": [
          {
            "page": 139,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n172/mode/1up"
          }
        ],
        "image": [
          {
            "page": 314,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n347/mode/1up"
          }
        ]
      }
    },
    {
      "number": 39,
      "judgment": "In (the state indicated by) Kien advantage will be found in the south-west, and the contrary in the north-east. It will be advantageous (also) to meet with the great man. (In these circumstances), with firmness and correctness, there will be good fortune.",
      "image": "(The trigram representing) a mountain, and above it that for water, form Kien. The superior man, in accordance with this, turns round (and examines) himself, and cultivates his virtue.",
      "sources": {
        "judgment": [
          {
            "page": 141,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n174/mode/1up"
          },
          {
            "page": 142,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n175/mode/1up"
          }
        ],
        "image": [
          {
            "page": 315,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n348/mode/1up"
          }
        ]
      }
    },
    {
      "number": 40,
      "judgment": "In (the state indicated by) Kieh advantage will be found in the south-west. If no (further) operations be called for, there will be good fortune in coming back (to the old conditions). If some operations be called for, there will be good fortune in the early conducting of them.",
      "image": "(The trigram representing) thunder and that for rain, with these phenomena in a state of manifestation, form Kieh. The superior man, in accordance with this, forgives errors, and deals gently with crimes.",
      "sources": {
        "judgment": [
          {
            "page": 144,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n177/mode/1up"
          }
        ],
        "image": [
          {
            "page": 316,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n349/mode/1up"
          }
        ]
      }
    },
    {
      "number": 41,
      "judgment": "In (what is denoted by) Sun, if there be sincerity (in him who employs it), there will be great good fortune: — freedom from error; firmness and correctness that can be maintained; and advantage in every movement that shall be made. In what shall this (sincerity in the exercise of Sun) be employed? (Even) in sacrifice two baskets of grain, (though there be nothing else), may be presented.",
      "image": "(The trigram representing) a mountain and beneath it that for the waters of a marsh form Sun. The superior man, in accordance with this, restrains his wrath and represses his desires.",
      "sources": {
        "judgment": [
          {
            "page": 146,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n179/mode/1up"
          },
          {
            "page": 147,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n180/mode/1up"
          }
        ],
        "image": [
          {
            "page": 317,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n350/mode/1up"
          }
        ]
      }
    },
    {
      "number": 42,
      "judgment": "Yi indicates that (in the state which it denotes) there will be advantage in every movement which shall be undertaken, that it will be advantageous (even) to cross the great stream.",
      "image": "(The trigram representing) wind and that for thunder form Yi. The superior man, in accordance with this, when he sees what is good, moves towards it; and when he sees his errors, he turns from them.",
      "sources": {
        "judgment": [
          {
            "page": 149,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n182/mode/1up"
          }
        ],
        "image": [
          {
            "page": 319,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n352/mode/1up"
          }
        ]
      }
    },
    {
      "number": 43,
      "judgment": "Kwai requires (in him who would fulfil its meaning) the exhibition (of the culprit's guilt) in the royal court, and a sincere and earnest appeal (for sympathy and support), with a consciousness of the peril (involved in cutting off the criminal). He should (also) make announcement in his own city, and show that it will not be well to have recourse at once to arms. (In this way) there will be advantage in whatever he shall go forward to.",
      "image": "(The trigram representing) heaven and that for the waters of a marsh mounting above it form Kwai. The superior man, in accordance with this, bestows emolument on those below him, and dislikes allowing his gifts to accumulate (undispensed).",
      "sources": {
        "judgment": [
          {
            "page": 151,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n184/mode/1up"
          },
          {
            "page": 152,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n185/mode/1up"
          }
        ],
        "image": [
          {
            "page": 320,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n353/mode/1up"
          }
        ]
      }
    },
    {
      "number": 44,
      "judgment": "Kau shows a female who is bold and strong. It will not be good to marry (such) a female.",
      "image": "(The trigram representing) wind and that for the sky above it form Kau. The sovereign, in accordance with this, delivers his charges, and promulgates his announcements throughout the four quarters (of the kingdom).",
      "sources": {
        "judgment": [
          {
            "page": 154,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n187/mode/1up"
          }
        ],
        "image": [
          {
            "page": 321,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n354/mode/1up"
          }
        ]
      }
    },
    {
      "number": 45,
      "judgment": "In (the state denoted by) Zhui, the king will repair to his ancestral temple. It will be advantageous (also) to meet with the great man; and then there will be progress and success, though the advantage must come through firm correctness. The use of great victims will conduce to good fortune; and in whatever direction movement is made, it will be advantageous.",
      "image": "(The trigram representing the) earth and that for the waters of a marsh raised above it form Zhui. The superior man, in accordance with this, has his weapons of war put in good repair, to be prepared against unforeseen contingencies.",
      "sources": {
        "judgment": [
          {
            "page": 156,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n189/mode/1up"
          },
          {
            "page": 157,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n190/mode/1up"
          }
        ],
        "image": [
          {
            "page": 323,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n356/mode/1up"
          }
        ]
      }
    },
    {
      "number": 46,
      "judgment": "Shang indicates that (under its conditions) there will be great progress and success. Seeking by (the qualities implied in it) to meet with the great man, its subject need have no anxiety. Advance to the south will be fortunate.",
      "image": "(The trigram representing) wood and that for the earth with the wood growing in the midst of it form Shang. The superior man, in accordance with this, pays careful attention to his virtue, and accumulates the small developments of it till it is high and great.",
      "sources": {
        "judgment": [
          {
            "page": 159,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n192/mode/1up"
          },
          {
            "page": 160,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n193/mode/1up"
          }
        ],
        "image": [
          {
            "page": 324,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n357/mode/1up"
          }
        ]
      }
    },
    {
      "number": 47,
      "judgment": "In (the condition denoted by) Khwan there may (yet be) progress and success. For the firm and correct, the (really) great man, there will be good fortune. He will fall into no error. If he make speeches, his words cannot be made good.",
      "image": "(The trigram representing) a marsh, and (below it that for a defile, which has drained the other dry so that there is) no water in it, form Khwan. The superior man, in accordance with this, will sacrifice his life in order to carry out his purpose.",
      "sources": {
        "judgment": [
          {
            "page": 161,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n194/mode/1up"
          },
          {
            "page": 162,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n195/mode/1up"
          }
        ],
        "image": [
          {
            "page": 325,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n358/mode/1up"
          }
        ]
      }
    },
    {
      "number": 48,
      "judgment": "(Looking at) Zing, (we think of) how (the site of) a town may be changed, while (the fashion of) its wells undergoes no change. (The water of a well) never disappears and never receives (any great) increase, and those who come and those who go can draw and enjoy the benefit. If (the drawing) have nearly been accomplished, but, before the rope has quite reached the water, the bucket is broken, this is evil.",
      "image": "(The trigram representing) wood and above it that for water form Zing. The superior man, in accordance with this, comforts the people, and stimulates them to mutual helpfulness.",
      "sources": {
        "judgment": [
          {
            "page": 164,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n197/mode/1up"
          },
          {
            "page": 165,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n198/mode/1up"
          }
        ],
        "image": [
          {
            "page": 327,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n360/mode/1up"
          }
        ]
      }
    },
    {
      "number": 49,
      "judgment": "(What takes place as indicated by) Ko is believed in only after it has been accomplished. There will be great progress and success. Advantage will come from being firm and correct. (In that case) occasion for repentance will disappear.",
      "image": "(The trigram representing the waters of) a marsh and that for fire in the midst of them form Ko. The superior man, in accordance with this, regulates his (astronomical) calculations, and makes clear the seasons and times.",
      "sources": {
        "judgment": [
          {
            "page": 167,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n200/mode/1up"
          }
        ],
        "image": [
          {
            "page": 328,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n361/mode/1up"
          }
        ]
      }
    },
    {
      "number": 50,
      "judgment": "Ting gives the intimation of great progress and success.",
      "image": "(The trigram representing) wood and above it that for fire form Ting. The superior man, in accordance with this, keeps his every position correct, and maintains secure the appointment (of Heaven).",
      "sources": {
        "judgment": [
          {
            "page": 169,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n202/mode/1up"
          }
        ],
        "image": [
          {
            "page": 329,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n362/mode/1up"
          }
        ]
      }
    },
    {
      "number": 51,
      "judgment": "Kan gives the intimation of ease and development. When (the time of) movement (which it indicates) comes, (the subject of the hexagram) will be found looking out with apprehension, and yet smiling and talking cheerfully. When the movement (like a crash of thunder) terrifies all within a hundred li, he will be (like the sincere worshipper) who is not (startled into) letting go his ladle and (cup of) sacrificial spirits.",
      "image": "(The trigram representing) thunder, being repeated, forms Kan. The superior man, in accordance with this, is fearful and apprehensive, cultivates (his virtue), and examines (his faults).",
      "sources": {
        "judgment": [
          {
            "page": 172,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n205/mode/1up"
          },
          {
            "page": 173,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n206/mode/1up"
          }
        ],
        "image": [
          {
            "page": 330,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n363/mode/1up"
          }
        ]
      }
    },
    {
      "number": 52,
      "judgment": "When one's resting is like that of the back, and he loses all consciousness of self; when he walks in his courtyard, and does not see any (of the persons) in it, — there will be no error.",
      "image": "(Two trigrams representing) a mountain, one over the other, form Kan. The superior man, in accordance with this, does not go in his thoughts beyond the (duties of the) position in which he is.",
      "sources": {
        "judgment": [
          {
            "page": 175,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n208/mode/1up"
          },
          {
            "page": 176,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n209/mode/1up"
          }
        ],
        "image": [
          {
            "page": 331,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n364/mode/1up"
          },
          {
            "page": 332,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n365/mode/1up"
          }
        ]
      }
    },
    {
      "number": 53,
      "judgment": "Kien suggests to us the marriage of a young lady, and the good fortune (attending it). There will be advantage in being firm and correct.",
      "image": "(The trigram representing) a mountain and above it that for a tree form Kien. The superior man, in accordance with this, attains to and maintains his extraordinary virtue, and makes the manners of the people good.",
      "sources": {
        "judgment": [
          {
            "page": 178,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n211/mode/1up"
          }
        ],
        "image": [
          {
            "page": 333,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n366/mode/1up"
          }
        ]
      }
    },
    {
      "number": 54,
      "judgment": "Kwei Mei indicates that (under the conditions which it denotes) action will be evil, and in no wise advantageous.",
      "image": "(The trigram representing the waters of) a marsh and over it that for thunder form Kwei Mei. The superior man, in accordance with this, having regard to the far-distant end, knows the mischief (that may be done at the beginning).",
      "sources": {
        "judgment": [
          {
            "page": 180,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n213/mode/1up"
          }
        ],
        "image": [
          {
            "page": 334,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n367/mode/1up"
          }
        ]
      }
    },
    {
      "number": 55,
      "judgment": "Fang intimates progress and development. When a king has reached the point (which the name denotes) there is no occasion to be anxious (through fear of a change). Let him be as the sun at noon.",
      "image": "(The trigrams representing) thunder and lightning combine to form Fang. The superior man, in accordance with this, decides cases of litigation, and apportions punishments with exactness.",
      "sources": {
        "judgment": [
          {
            "page": 183,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n216/mode/1up"
          },
          {
            "page": 184,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n217/mode/1up"
          }
        ],
        "image": [
          {
            "page": 335,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n368/mode/1up"
          }
        ]
      }
    },
    {
      "number": 56,
      "judgment": "Lu intimates that (in the condition which it denotes) there may be some little attainment and progress. If the stranger or traveller be firm and correct as he ought to be, there will be good fortune.",
      "image": "(The trigram representing) a mountain and above it that for fire form Lu. The superior man, in accordance with this, exerts his wisdom and caution in the use of punishments and not allowing litigations to continue.",
      "sources": {
        "judgment": [
          {
            "page": 187,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n220/mode/1up"
          }
        ],
        "image": [
          {
            "page": 337,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n370/mode/1up"
          }
        ]
      }
    },
    {
      "number": 57,
      "judgment": "Sun intimates that (under the conditions which it denotes) there will be some little attainment and progress. There will be advantage in movement onward in whatever direction. It will be advantageous (also) to see the great man.",
      "image": "(Two trigrams representing) wind, following each other, form Sun. The superior man, in accordance with this, reiterates his orders, and secures the practice of his affairs.",
      "sources": {
        "judgment": [
          {
            "page": 189,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n222/mode/1up"
          },
          {
            "page": 190,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n223/mode/1up"
          }
        ],
        "image": [
          {
            "page": 338,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n371/mode/1up"
          }
        ]
      }
    },
    {
      "number": 58,
      "judgment": "Tui intimates that (under its conditions) there will be progress and attainment. (But) it will be advantageous to be firm and correct.",
      "image": "(Two symbols representing) the waters of a marsh, one over the other, form Tui. The superior man, in accordance with this, (encourages) the conversation of friends and (the stimulus of) their (common) practice.",
      "sources": {
        "judgment": [
          {
            "page": 192,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n225/mode/1up"
          }
        ],
        "image": [
          {
            "page": 340,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n373/mode/1up"
          }
        ]
      }
    },
    {
      "number": 59,
      "judgment": "Hwan intimates that (under its conditions) there will be progress and success. The king goes to his ancestral temple; and it will be advantageous to cross the great stream. It will be advantageous to be firm and correct.",
      "image": "(The trigram representing) water and that for wind moving above the water form Hwan. The ancient kings, in accordance with this, presented offerings to God and established the ancestral temple.",
      "sources": {
        "judgment": [
          {
            "page": 194,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n227/mode/1up"
          },
          {
            "page": 195,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n228/mode/1up"
          }
        ],
        "image": [
          {
            "page": 341,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n374/mode/1up"
          }
        ]
      }
    },
    {
      "number": 60,
      "judgment": "Kieh intimates that (under its conditions) there will be progress and attainment. (But) if the regulations (which it prescribes) be severe and difficult, they cannot be permanent.",
      "image": "(The trigram representing) a lake, and above it that for water, form Kieh. The superior man, in accordance with this, constructs his (methods of) numbering and measurement, and discusses (points of) virtue and conduct.",
      "sources": {
        "judgment": [
          {
            "page": 197,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n230/mode/1up"
          }
        ],
        "image": [
          {
            "page": 342,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n375/mode/1up"
          }
        ]
      }
    },
    {
      "number": 61,
      "judgment": "Kung Fu (moves even) pigs and fish, and leads to good fortune. There will be advantage in crossing the great stream. There will be advantage in being firm and correct.",
      "image": "(The trigram representing the waters of) a marsh and that for wind above it form Kung Fu. The superior man, in accordance with this, deliberates about cases of litigation and delays (the infliction of) death.",
      "sources": {
        "judgment": [
          {
            "page": 199,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n232/mode/1up"
          },
          {
            "page": 200,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n233/mode/1up"
          }
        ],
        "image": [
          {
            "page": 343,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n376/mode/1up"
          }
        ]
      }
    },
    {
      "number": 62,
      "judgment": "Hsiao Kwo indicates that (in the circumstances which it implies) there will be progress and attainment. But it will be advantageous to be firm and correct. (What the name denotes) may be done in small affairs, but not in great affairs. (It is like) the notes that come down from a bird on the wing; — to descend is better than to ascend. There will (in this way) be great good fortune.",
      "image": "(The trigram representing) a hill and that for thunder above it form Hsiao Kwo. The superior man, in accordance with this, in his conduct exceeds in humility, in mourning exceeds in sorrow, and in his expenditure exceeds in economy.",
      "sources": {
        "judgment": [
          {
            "page": 201,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n234/mode/1up"
          },
          {
            "page": 202,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n235/mode/1up"
          }
        ],
        "image": [
          {
            "page": 344,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n377/mode/1up"
          }
        ]
      }
    },
    {
      "number": 63,
      "judgment": "Ki Zi intimates progress and success in small matters. There will be advantage in being firm and correct. There has been good fortune in the beginning; there may be disorder in the end.",
      "image": "(The trigram representing) fire and that for water above it form Ki Zi. The superior man, in accordance with this, thinks of evil (that may come), and beforehand guards against it.",
      "sources": {
        "judgment": [
          {
            "page": 204,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n237/mode/1up"
          },
          {
            "page": 205,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n238/mode/1up"
          }
        ],
        "image": [
          {
            "page": 345,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n378/mode/1up"
          },
          {
            "page": 346,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n379/mode/1up"
          }
        ]
      }
    },
    {
      "number": 64,
      "judgment": "Wei Zi intimates progress and success (in the circumstances which it implies). (We see) a young fox that has nearly crossed (the stream), when its tail gets immersed. There will be no advantage in any way.",
      "image": "(The trigram representing) water and that for fire above it form Wei Zi. The superior man, in accordance with this, carefully discriminates among (the qualities of) things, and the (different) positions they (naturally) occupy.",
      "sources": {
        "judgment": [
          {
            "page": 207,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n240/mode/1up"
          }
        ],
        "image": [
          {
            "page": 346,
            "url": "https://archive.org/details/sacredbooksofchi16conf/page/n379/mode/1up"
          }
        ]
      }
    }
  ];
  const passageByNumber = new Map(LEGGE_PASSAGES.map(p => [p.number, p]));
  const HEXAGRAMS = Object.freeze(KING_WEN_IDENTITIES.map(([number, binary, unicodeName]) => {
    const passage = passageByNumber.get(number);
    if (!passage) throw new Error('Missing sourced Legge passage for hexagram '+number);
    return Object.freeze({
      number, binary, glyph: String.fromCodePoint(0x4DC0 + number - 1),
      name: unicodeName.replace('HEXAGRAM FOR ', '').toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()),
      unicodeName, codepoint: (0x4DC0 + number - 1).toString(16).toUpperCase(),
      chinese: null, pinyin: null,
      upper: TRIGRAMS[binary.slice(3)].name, lower: TRIGRAMS[binary.slice(0, 3)].name,
      judgment: passage.judgment, image: passage.image, sources: passage.sources,
      translation: Object.freeze({translator:'James Legge',year:1882}),
      changingLineTextsAvailable: false
    });
  }));
  const byBinary = new Map(HEXAGRAMS.map(h => [h.binary, h]));

  // A malformed or unknown signature must never fabricate a King Wen identity.
  function getHexagramByBinary(binStr) {
    if (typeof binStr !== 'string' || binStr.length !== 6 || !/^[01]{6}$/.test(binStr)) {
      throw new TypeError('Hexagram signature must be exactly six binary digits, bottom to top.');
    }
    const hexagram = byBinary.get(binStr);
    if (!hexagram) throw new RangeError('No sourced hexagram identity for this signature.');
    return hexagram;
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
