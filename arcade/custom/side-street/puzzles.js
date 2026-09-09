// Original Side Street study pack. No NYT boards, words or artwork.
(function(root){const puzzles=[
  {
    "id": "SS01",
    "revision": 1,
    "title": "First corner",
    "size": 4,
    "start": 0,
    "end": 15,
    "stops": [
      3,
      11
    ],
    "turns": 1,
    "blocked": [],
    "lesson": "A turn is a change of direction. Going straight does not spend one.",
    "solution": [
      0,
      1,
      2,
      3,
      7,
      11,
      15
    ]
  },
  {
    "id": "SS02",
    "revision": 1,
    "title": "The long way",
    "size": 4,
    "start": 12,
    "end": 15,
    "stops": [
      1,
      10
    ],
    "turns": 3,
    "blocked": [],
    "lesson": "A direct route to home skips a stop. Look at the whole walk first.",
    "solution": [
      12,
      8,
      4,
      0,
      1,
      2,
      6,
      10,
      14,
      15
    ]
  },
  {
    "id": "SS03",
    "revision": 1,
    "title": "Around the garden",
    "size": 4,
    "start": 0,
    "end": 15,
    "stops": [
      8,
      2
    ],
    "turns": 4,
    "blocked": [
      1,
      12
    ],
    "lesson": "Count a corner when you change from a row to a column, or back.",
    "solution": [
      0,
      4,
      8,
      9,
      10,
      6,
      2,
      3,
      7,
      11,
      15
    ]
  },
  {
    "id": "SS04",
    "revision": 1,
    "title": "Across town",
    "size": 5,
    "start": 20,
    "end": 24,
    "stops": [
      2,
      14
    ],
    "turns": 4,
    "blocked": [
      3,
      8
    ],
    "lesson": "Work backwards from home to see where your final turn must happen.",
    "solution": [
      20,
      15,
      10,
      5,
      0,
      1,
      2,
      7,
      12,
      13,
      14,
      19,
      24
    ]
  },
  {
    "id": "SS05",
    "revision": 1,
    "title": "The inner lane",
    "size": 5,
    "start": 0,
    "end": 24,
    "stops": [
      14,
      6
    ],
    "turns": 6,
    "blocked": [
      5,
      8,
      17
    ],
    "lesson": "The route can approach a stop from a side you did not first expect.",
    "solution": [
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      13,
      12,
      7,
      6,
      11,
      16,
      21,
      22,
      23,
      24
    ]
  },
  {
    "id": "SS06",
    "revision": 1,
    "title": "Two courtyards",
    "size": 5,
    "start": 20,
    "end": 24,
    "stops": [
      12,
      0
    ],
    "turns": 5,
    "blocked": [
      6,
      13
    ],
    "lesson": "Visiting a stop can leave several ways out. Save enough turns for both.",
    "solution": [
      20,
      21,
      22,
      17,
      12,
      11,
      10,
      5,
      0,
      1,
      2,
      3,
      4,
      9,
      14,
      19,
      24
    ]
  },
  {
    "id": "SS07",
    "revision": 1,
    "title": "Quiet crossing",
    "size": 5,
    "start": 4,
    "end": 24,
    "stops": [
      10,
      8
    ],
    "turns": 6,
    "blocked": [
      6,
      15
    ],
    "lesson": "A closed block can tell you where a straight stretch must end.",
    "solution": [
      4,
      3,
      2,
      1,
      0,
      5,
      10,
      11,
      12,
      7,
      8,
      13,
      18,
      23,
      24
    ]
  },
  {
    "id": "SS08",
    "revision": 1,
    "title": "A little detour",
    "size": 5,
    "start": 0,
    "end": 24,
    "stops": [
      20,
      7
    ],
    "turns": 4,
    "blocked": [
      2,
      6
    ],
    "lesson": "A route with fewer steps is not always a route with the right number of turns.",
    "solution": [
      0,
      5,
      10,
      15,
      20,
      21,
      22,
      17,
      12,
      7,
      8,
      9,
      14,
      19,
      24
    ]
  },
  {
    "id": "SS09",
    "revision": 1,
    "title": "Inside out",
    "size": 5,
    "start": 20,
    "end": 24,
    "stops": [
      12,
      1
    ],
    "turns": 8,
    "blocked": [
      0,
      14,
      16,
      17
    ],
    "lesson": "Find the tightest part of the walk before spending turns near the start.",
    "solution": [
      20,
      15,
      10,
      11,
      12,
      7,
      6,
      1,
      2,
      3,
      8,
      13,
      18,
      19,
      24
    ]
  },
  {
    "id": "SS10",
    "revision": 1,
    "title": "Side by side",
    "size": 5,
    "start": 0,
    "end": 4,
    "stops": [
      10,
      23
    ],
    "turns": 7,
    "blocked": [
      2,
      5,
      14
    ],
    "lesson": "Home can be near where you started. The two stops decide the way around.",
    "solution": [
      0,
      1,
      6,
      11,
      10,
      15,
      20,
      21,
      22,
      23,
      18,
      13,
      8,
      9,
      4
    ]
  },
  {
    "id": "SS11",
    "revision": 1,
    "title": "Last light",
    "size": 5,
    "start": 4,
    "end": 20,
    "stops": [
      22,
      1
    ],
    "turns": 6,
    "blocked": [
      2,
      7,
      16
    ],
    "lesson": "When two possible routes reach the same stop, compare their turn counts.",
    "solution": [
      4,
      9,
      14,
      19,
      24,
      23,
      22,
      17,
      12,
      11,
      6,
      1,
      0,
      5,
      10,
      15,
      20
    ]
  },
  {
    "id": "SS12",
    "revision": 1,
    "title": "Home again",
    "size": 5,
    "start": 0,
    "end": 24,
    "stops": [
      20,
      16
    ],
    "turns": 7,
    "blocked": [
      7,
      14,
      18
    ],
    "lesson": "Leave the straight sections long enough to make every turn count.",
    "solution": [
      0,
      5,
      10,
      15,
      20,
      21,
      16,
      11,
      6,
      1,
      2,
      3,
      8,
      13,
      12,
      17,
      22,
      23,
      24
    ]
  }
];if(typeof module==='object'&&module.exports)module.exports=puzzles;else root.SideStreetPuzzles=puzzles;})(typeof globalThis!=='undefined'?globalThis:this);
