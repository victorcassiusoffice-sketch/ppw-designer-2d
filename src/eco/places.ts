/** Public reference points for map navigation; not district boundaries or parcel measurements. */
export const places = [
  {
    name: 'Black River',
    lat: -20.33,
    lon: 57.37,
    region: 'West',
    yieldKwh: 1458.06,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.33&lon=57.37&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Flacq',
    lat: -20.19,
    lon: 57.71,
    region: 'East',
    yieldKwh: 1557.05,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.19&lon=57.71&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Grand Port',
    lat: -20.41,
    lon: 57.7,
    region: 'South',
    yieldKwh: 1569.2,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.41&lon=57.7&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Moka',
    lat: -20.22,
    lon: 57.5,
    region: 'Centre',
    yieldKwh: 1387.81,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.22&lon=57.5&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Pamplemousses',
    lat: -20.1,
    lon: 57.58,
    region: 'North',
    yieldKwh: 1538.27,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.1&lon=57.58&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Plaines Wilhems',
    lat: -20.31,
    lon: 57.51,
    region: 'Centre',
    yieldKwh: 1324.6,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.31&lon=57.51&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Port Louis',
    lat: -20.16,
    lon: 57.51,
    region: 'West',
    yieldKwh: 1417.48,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.16&lon=57.51&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Rivière du Rempart',
    lat: -20.1,
    lon: 57.69,
    region: 'North',
    yieldKwh: 1573.86,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.1&lon=57.69&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Savanne',
    lat: -20.49,
    lon: 57.55,
    region: 'South',
    yieldKwh: 1376.19,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-20.49&lon=57.55&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
  {
    name: 'Rodrigues',
    lat: -19.68,
    lon: 63.42,
    region: 'Rodrigues',
    yieldKwh: 1629.4,
    source:
      'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=-19.68&lon=63.42&peakpower=1&loss=14&angle=15&aspect=180&pvtechchoice=crystSi&raddatabase=PVGIS-SARAH3&outputformat=json',
  },
] as const;
