// 13-0: made by tools/make-sounds.mjs (do not edit by hand). Where each recording came from: docs/assets.md
// LOOP: every bed loops from pad to pad + len (s). SHOTS: name -> [its group's file, [[from, length] s, ...] one per take]
export const LOOP = { pad: 0.5, len: 20 };
export const BEDS = { "birdsFar": "assets/sounds/birdsFar.m4a", "grassWind": "assets/sounds/grassWind.m4a", "nightField": "assets/sounds/nightField.m4a", "insects": "assets/sounds/insects.m4a", "stream": "assets/sounds/stream.m4a", "frogs": "assets/sounds/frogs.m4a", "pond": "assets/sounds/pond.m4a", "snowWind": "assets/sounds/snowWind.m4a", "hush": "assets/sounds/hush.m4a", "rainLight": "assets/sounds/rainLight.m4a", "rainHeavy": "assets/sounds/rainHeavy.m4a", "rainLeaves": "assets/sounds/rainLeaves.m4a", "rainWater": "assets/sounds/rainWater.m4a" };
export const SPRITES = { "common": "assets/sounds/fx-common.m4a", "rain": "assets/sounds/fx-rain.m4a", "meadow": "assets/sounds/fx-meadow.m4a", "pond": "assets/sounds/fx-pond.m4a", "snow": "assets/sounds/fx-snow.m4a" };
export const SHOTS = {
  step_grass: ["common",[[0,0.36],[0.43,0.36],[0.86,0.36]]],
  step_dirt: ["common",[[1.29,0.33],[1.69,0.33],[2.09,0.33]]],
  step_wood: ["common",[[2.49,0.35],[2.91,0.38],[3.36,0.31]]],
  step_snow: ["common",[[3.74,0.38],[4.19,0.38],[4.64,0.38]]],
  step_water: ["common",[[5.09,0.43],[5.59,0.43],[6.09,0.43]]],
  toy: ["common",[[6.59,0.31],[6.97,0.196]]],
  knock: ["common",[[7.236,0.4]]],
  creak: ["common",[[7.706,0.98],[8.756,0.98]]],
  bounce: ["common",[[9.806,0.38]]],
  whoosh: ["common",[[10.256,0.64]]],
  breath: ["common",[[10.966,0.72],[11.756,0.869],[12.696,0.77]]],
  eat: ["common",[[13.536,0.98],[14.586,0.98],[15.636,1.38]]],
  chick: ["common",[[17.086,0.43],[17.586,0.43],[18.086,0.43]]],
  leaf: ["common",[[18.586,2.07],[20.726,1.43]]],
  robin: ["common",[[22.226,2.36],[24.656,3.04]]],
  blackbird: ["common",[[27.766,2.68],[30.516,1.7]]],
  blackcap: ["common",[[32.286,3.22]]],
  owl: ["common",[[35.576,1.18],[36.826,1.38],[38.276,1.24]]],
  thunder: ["rain",[[0,11.77],[11.84,10.58]]],
  nightingale: ["meadow",[[0,3.68],[3.75,2.95]]],
  bee: ["meadow",[[6.77,3.08],[9.92,3.08]]],
  cricket: ["meadow",[[13.07,3.457]]],
  horse: ["meadow",[[16.597,1.44],[18.107,1.91],[20.087,1.41]]],
  sheep: ["meadow",[[21.567,0.93],[22.567,0.96],[23.597,0.88]]],
  cow: ["meadow",[[24.547,2.44],[27.057,2.18],[29.307,2.25]]],
  hen: ["meadow",[[31.627,1],[32.697,0.83],[33.597,0.78],[34.447,0.78],[35.297,0.78]]],
  pig: ["meadow",[[36.147,1.68],[37.897,1.69]]],
  frog: ["pond",[[0,1.31],[1.38,1.18],[2.63,1.83]]],
  toad: ["pond",[[4.53,0.98],[5.58,0.98]]],
  splash: ["pond",[[6.63,1.26],[7.96,1.3]]],
  duck: ["pond",[[9.33,0.78],[10.18,0.78],[11.03,0.78]]],
  penguin: ["snow",[[0,0.54],[0.61,0.55]]],
};
