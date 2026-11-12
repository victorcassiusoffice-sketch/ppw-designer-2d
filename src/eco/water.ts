import type { WaterStudy } from '../designer/ecoContract';

export const rainSource = 'https://data.govmu.org/dataset/3690f341-b8dd-47b3-b73c-fa2055cc961c/resource/b27f5eaf-e15b-4cb5-a28b-515b2adeda80/download/mean-rainfall-by-region-and-by-month-2017-2021.pdf';
/** Mauritius Meteorological Services, 1991–2020 monthly long-term means in mm, Jan–Dec. */
export const rain = {
  North:[191,218,206,127,90,67,65,56,45,39,48,102],
  South:[324,374,352,269,195,159,188,149,114,101,114,227],
  East:[344,400,382,284,207,161,179,150,116,97,109,211],
  West:[195,202,155,80,42,27,20,20,24,23,38,96],
  Centre:[359,420,377,269,204,172,211,165,126,106,116,216],
} as const;
export const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const days = [31,28,31,30,31,30,31,31,30,31,30,31];
export const defaults: WaterStudy = {region:'Centre',people:2,runoff:.8,tankL:null,homeLDay:45,greyLDay:15,gardenLDay:2,infiltration:.5,recycledPct:0,aggregateTM3:1.5,mossRoom:null,blockRoom:null,pavingId:null,coolRoof:false};
export function balance(s: WaterStudy, roofM2: number, greenM2: number, pavingM2:number, tankL:number, rainfall:readonly number[]=rain[s.region]) {
  let stored=0;
  const rows=days.map((n,i)=>{
    const captured=rainfall[i]*roofM2*s.runoff, home=n*s.people*s.homeLDay, garden=n*greenM2*s.gardenLDay;
    const grey=n*s.people*s.greyLDay, greyUsed=Math.min(garden,grey), infiltrated=pavingM2*rainfall[i]*s.infiltration;
    // Spread the monthly mean evenly across days. Household non-potable demand takes priority.
    let homeRain=0,gardenRain=0,spill=0;
    for(let d=0;d<n;d++){
      const filled=stored+captured/n;
      spill+=Math.max(0,filled-tankL); stored=Math.min(tankL,filled);
      const indoor=Math.min(stored,home/n);stored-=indoor;homeRain+=indoor;
      const outdoor=Math.min(stored,(garden-greyUsed)/n);stored-=outdoor;gardenRain+=outdoor;
    }
    return {captured,home,garden,grey,greyUsed,homeRain,gardenRain,saved:homeRain+gardenRain+greyUsed,stored,spill,infiltrated,gardenMains:Math.max(0,garden-greyUsed-gardenRain)};
  });
  const sum=(key:keyof typeof rows[number])=>rows.reduce((a,b)=>a+b[key],0);
  return {rows,captured:sum('captured'),saved:sum('saved'),grey:sum('grey'),infiltrated:sum('infiltrated'),gardenMains:sum('gardenMains'),homeCoverage:sum('home')?100*sum('homeRain')/sum('home'):null};
}
