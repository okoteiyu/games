/** Shared visual layout for the ground-level map and exported 3D exterior. */
export const OUTDOOR_LAYOUT=Object.freeze({
  "revision": "R208",
  "units": "meters",
  "dimensionsAreArtProductionValues": true,
  "mapViewBox": [
    -800,
    -650,
    3600,
    2550
  ],
  "mapUnitsToMeters": 0.02,
  "mapOrigin": [
    1000,
    500
  ],
  "worldAxes": {
    "east": "+X",
    "up": "+Y",
    "south": "+Z"
  },
  "site": {
    "rect": [
      30,
      40,
      1940,
      844
    ],
    "wallHeight": 1.5
  },
  "house": {
    "rect": [
      1370,
      260,
      540,
      520
    ],
    "floorHeight": 3.2,
    "wallHeight": 6.4,
    "eastWindows": [
      {
        "floor": 1,
        "start": 447.8656,
        "end": 527.2604,
        "centerHeight": 1.66,
        "glassHeight": 1.11
      },
      {
        "floor": 2,
        "start": 438.88,
        "end": 532.48,
        "centerHeight": 1.6,
        "glassHeight": 1.25
      }
    ],
    "windowSide": "east",
    "frontDoor": [
      1490,
      780,
      100
    ],
    "frontDoorHeight": 2.35
  },
  "warehouse": {
    "rect": [
      540,
      200,
      740,
      460
    ],
    "wallHeight": 3.65,
    "westDoor": [
      540,
      234,
      164
    ],
    "southDoor": [
      799,
      660,
      222
    ]
  },
  "freight": {
    "rect": [
      110,
      350,
      300,
      430
    ],
    "wallHeight": 6.2,
    "northDoor": [
      224,
      350,
      72
    ],
    "southShutter": [
      138,
      780,
      188
    ],
    "shutterHeight": 5.2,
    "southHumanDoor": [
      343,
      780,
      50
    ],
    "humanDoorHeight": 2.25
  },
  "corridor": {
    "points": [
      [
        540,
        300
      ],
      [
        260,
        300
      ],
      [
        260,
        350
      ]
    ],
    "width": 72,
    "wallHeight": 2.9,
    "wallThickness": 0.18,
    "enclosed": true,
    "windows": false
  },
  "paved": {
    "rect": [
      470,
      660,
      840,
      224
    ]
  },
  "walkways": [
    {
      "id": "front-entry",
      "points": [
        [
          1540,
          960
        ],
        [
          1540,
          780
        ]
      ],
      "width": 92
    },
    {
      "id": "large-entry",
      "points": [
        [
          260,
          960
        ],
        [
          260,
          780
        ]
      ],
      "width": 230
    },
    {
      "id": "warehouse-street",
      "points": [
        [
          910,
          960
        ],
        [
          910,
          660
        ]
      ],
      "width": 180
    }
  ],
  "street": {
    "rect": [
      -800,
      960,
      3600,
      160
    ],
    "sidewalk": [
      -800,
      884,
      3600,
      76
    ]
  },
  "entry": {
    "mainGate": [
      1475,
      884,
      130
    ],
    "warehouseGate": [
      799,
      884,
      222
    ],
    "freightGate": [
      130,
      884,
      260
    ],
    "mailbox": {
      "rect": [
        1630,
        805,
        45,
        38
      ]
    },
    "parcelBox": {
      "rect": [
        1690,
        802,
        65,
        48
      ]
    }
  },
  "groundsZone": {
    "rect": [
      1410,
      100,
      470,
      115
    ]
  },
  "neighbors": [
    {
      "id": "neighbor-north-1",
      "direction": "north",
      "rect": [
        100,
        -575,
        400,
        350
      ],
      "roofColor": "#59616a"
    },
    {
      "id": "neighbor-north-2",
      "direction": "north",
      "rect": [
        800,
        -575,
        400,
        350
      ],
      "roofColor": "#6f6359"
    },
    {
      "id": "neighbor-north-3",
      "direction": "north",
      "rect": [
        1500,
        -575,
        400,
        350
      ],
      "roofColor": "#626a60"
    },
    {
      "id": "neighbor-south-1",
      "direction": "south",
      "rect": [
        100,
        1475,
        400,
        350
      ],
      "roofColor": "#59616a"
    },
    {
      "id": "neighbor-south-2",
      "direction": "south",
      "rect": [
        800,
        1475,
        400,
        350
      ],
      "roofColor": "#6f6359"
    },
    {
      "id": "neighbor-south-3",
      "direction": "south",
      "rect": [
        1500,
        1475,
        400,
        350
      ],
      "roofColor": "#626a60"
    },
    {
      "id": "neighbor-east-1",
      "direction": "east",
      "rect": [
        2350,
        -25,
        400,
        350
      ],
      "roofColor": "#59616a"
    },
    {
      "id": "neighbor-east-2",
      "direction": "east",
      "rect": [
        2350,
        475,
        400,
        350
      ],
      "roofColor": "#6f6359"
    },
    {
      "id": "neighbor-east-3",
      "direction": "east",
      "rect": [
        2350,
        1225,
        400,
        350
      ],
      "roofColor": "#626a60"
    },
    {
      "id": "neighbor-west-1",
      "direction": "west",
      "rect": [
        -750,
        -25,
        400,
        350
      ],
      "roofColor": "#59616a"
    },
    {
      "id": "neighbor-west-2",
      "direction": "west",
      "rect": [
        -750,
        475,
        400,
        350
      ],
      "roofColor": "#6f6359"
    },
    {
      "id": "neighbor-west-3",
      "direction": "west",
      "rect": [
        -750,
        1225,
        400,
        350
      ],
      "roofColor": "#626a60"
    }
  ],
  "camera": {
    "position": [
      26,
      16,
      29
    ],
    "target": [
      0,
      1,
      -0.5
    ],
    "fov": 76,
    "far": 180
  },
  "windowAlignmentReference": {
    "f1": "house3d/house.glb right_window centre [2.55,1.66,-1.68]",
    "f2": "player-room apartmentPlan.window [559,197,90]; outer building map rect [100,25,520,500]",
    "method": "Exterior map y = 260 + (apartment map y - 25) / 500 * 520; frontage only on east side."
  }
});
