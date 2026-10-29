import { ramp } from './pix';

/**
 * Every pixel in the forest comes from these ramps (dark → light).
 * The edge of the wood is hazy and warm, the inside gets deeper and greener, the cat's hollow is darkest.
 */
export const PAL = {
  edge: {
    leaf: ramp('#142217', '#1c2f1f', '#273f28', '#345231', '#46683b', '#62824b', '#93a96c'),
    bark: ramp('#1b1712', '#28231c', '#373027', '#4a4134', '#615645'),
    moss: ramp('#1c301b', '#28411f', '#365727', '#486d30', '#5e853a', '#7c9c4b', '#a3b866'),
    grass: ramp('#1b2c1b', '#253c22', '#324f2a', '#436433', '#5a7c40', '#7b9655', '#a9b97b'),
  },
  mid: {
    leaf: ramp('#15261a', '#1d3622', '#294a2a', '#3a6032', '#50793b', '#729649'),
    bark: ramp('#1c1915', '#2a2520', '#3a332a', '#4f4537', '#665a47'),
    moss: ramp('#18291a', '#22391e', '#2f4c25', '#3f612d', '#537837', '#6e9045'),
    grass: ramp('#18291b', '#223a23', '#2f4f2b', '#406834', '#588342', '#7aa055'),
  },
  deep: {
    leaf: ramp('#0e1a12', '#132518', '#1b321e', '#254426', '#33582e', '#466e37'),
    bark: ramp('#131210', '#1c1a16', '#28241e', '#363027', '#463e32'),
    moss: ramp('#22381d', '#304b24', '#42622c'),
    grass: ramp('#101d14', '#172919', '#203820', '#2c4a28', '#3b6032'),
  },
  clearing: {
    grass: ramp('#10301c', '#173f22', '#1f5128', '#2a652e', '#387b35', '#4b913b', '#64a640'),
    sun: ramp('#4f8a34', '#6c9e3c', '#8cb247', '#abc55a', '#c8d679', '#dfe3a3'),
    leaf: ramp('#0c1d13', '#122a18', '#1a3a1f', '#244c26', '#30602e', '#417436'),
    bark: ramp('#121310', '#1b1c17', '#272720', '#35342a', '#454333'),
    rock: ramp('#3d443f', '#59605a', '#7c837c', '#a3a8a0', '#c8cbc2'),
  },
  hollow: {
    wall: ramp('#0d150e', '#131d14', '#19271a', '#213322', '#2b422b', '#385536', '#4a6b44', '#63854f', '#7f9d62'),
    bark: ramp('#2c201c', '#432f27', '#5c4133', '#775641', '#8f6c51', '#a6825f'),
    rings: ramp('#6a4b38', '#87644a', '#a5805e', '#c09d77', '#d8bc94'),
    moss: ramp('#2f4824', '#43622d', '#5b7d38', '#789949', '#9bb662'),
    grass: ramp('#14231a', '#1c301f', '#273f26', '#355330', '#466a3a', '#5f8549', '#86a764'),
    cat: ramp('#0a0b0a', '#141614', '#20241e', '#2f352b'),
    eye: ramp('#a8831c', '#e2bd3a', '#f8e17c'),
    cap: ramp('#4a2a1f', '#6c3e2a', '#91593a', '#b47a50', '#d29c6c'),
    stem: ramp('#8f866d', '#b8ad8f', '#d9d0b4'),
  },
  computer: {
    shell: ramp('#3b372f', '#5e584b', '#857c68', '#a99f86', '#c8bea2', '#ddd4ba', '#ece5cf'),
    dark: ramp('#141712', '#1f241d', '#2c3229'),
    screen: ramp('#0b130e', '#0f1a13', '#16241a'),
    glass: ramp('#9fd18a', '#c9eab0'),
    key: ramp('#6f6857', '#9b927b', '#bdb49b', '#d7cfb6'),
  },
  disc: {
    metal: ramp('#585e60', '#82898a', '#aab0af', '#d0d4d0'),
    label: ramp('#bdb49c', '#ddd5bd', '#efe9d6'),
    ink: ramp('#3c3a35', '#5c584f'),
  },
} as const;
