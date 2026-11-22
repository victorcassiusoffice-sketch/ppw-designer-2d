import { describe, expect, it } from 'vitest';
import {
  parsePlanFile,
  reviewPlanImport,
  suggestPlanLayers,
  type PlanImportOptions,
  type PlanImportSource,
} from '../planImport';
import { normaliseLoadedProperty } from '../../store/propertyStore';

/**
 * A small building written by hand to the IFC rules (ISO 10303-21, schema IFC2X3), in millimetres:
 * - a ground storey with two spaces: a living room of 6 by 4 m given as a closed line, and a bath of 2 by 3 m
 *   given as a rectangle that is placed at (8000, 1500) and turned a quarter;
 * - an upper storey at 3000 with no space and two walls: one by its axis line, one by its rectangular body;
 * - a door and a slab, which the reader names and does not read; a wall that is tilted, which it skips.
 */
const BUILDING = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('test.ifc','2026-11-22T00:00:00',(''),(''),'by hand','by hand','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#2=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#3=IFCUNITASSIGNMENT((#1,#2));
#10=IFCCARTESIANPOINT((0.,0.,0.));
#11=IFCDIRECTION((0.,0.,1.));
#12=IFCDIRECTION((1.,0.,0.));
#13=IFCAXIS2PLACEMENT3D(#10,#11,#12);
#14=IFCLOCALPLACEMENT($,#13);
#15=IFCCARTESIANPOINT((0.,0.,3000.));
#16=IFCAXIS2PLACEMENT3D(#15,#11,#12);
#17=IFCLOCALPLACEMENT(#14,#16);
#20=IFCBUILDINGSTOREY('0001',$,'Ground',$,$,#14,$,$,.ELEMENT.,0.);
#21=IFCBUILDINGSTOREY('0002',$,'Upper',$,$,#17,$,$,.ELEMENT.,3000.);
/* the living room: a closed line, the last point is the first again */
#30=IFCCARTESIANPOINT((0.,0.));
#31=IFCCARTESIANPOINT((6000.,0.));
#32=IFCCARTESIANPOINT((6000.,4000.));
#33=IFCCARTESIANPOINT((0.,4000.));
#34=IFCPOLYLINE((#30,#31,#32,#33,#30));
#35=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#34);
#36=IFCEXTRUDEDAREASOLID(#35,#13,#11,2700.);
#37=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#36));
#38=IFCPRODUCTDEFINITIONSHAPE($,$,(#37));
#39=IFCSPACE('0003',$,'Living; room',$,$,#14,#38,'It''s large',.ELEMENT.,.INTERNAL.,$);
/* the bath: a rectangle of 3000 by 2000 about its middle, placed at (8000, 1500) and turned a quarter */
#40=IFCCARTESIANPOINT((0.,0.));
#41=IFCDIRECTION((1.,0.));
#42=IFCAXIS2PLACEMENT2D(#40,#41);
#43=IFCRECTANGLEPROFILEDEF(.AREA.,$,#42,3000.,2000.);
#44=IFCEXTRUDEDAREASOLID(#43,#13,#11,2700.);
#45=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#44));
#46=IFCPRODUCTDEFINITIONSHAPE($,$,(#45));
#47=IFCCARTESIANPOINT((8000.,1500.,0.));
#48=IFCDIRECTION((0.,1.,0.));
#49=IFCAXIS2PLACEMENT3D(#47,#11,#48);
#50=IFCLOCALPLACEMENT(#14,#49);
#51=IFCSPACE('0004',$,'Bath',$,$,#50,#46,$,.ELEMENT.,.INTERNAL.,$);
#52=IFCRELAGGREGATES('0005',$,$,$,#20,(#39,#51));
/* a wall of the upper storey by its axis line, 5 m along x, placed at (1000, 1000) on that storey */
#60=IFCCARTESIANPOINT((0.,0.));
#61=IFCCARTESIANPOINT((5000.,0.));
#62=IFCPOLYLINE((#60,#61));
#63=IFCSHAPEREPRESENTATION($,'Axis','Curve2D',(#62));
#64=IFCPRODUCTDEFINITIONSHAPE($,$,(#63));
#65=IFCCARTESIANPOINT((1000.,1000.,0.));
#66=IFCAXIS2PLACEMENT3D(#65,#11,#12);
#67=IFCLOCALPLACEMENT(#17,#66);
#68=IFCWALLSTANDARDCASE('0006',$,'Wall A',$,$,#67,#64,$);
/* a wall by its body only: a rectangle of 4000 by 200 about its middle, placed at (3000, 5000) */
#70=IFCRECTANGLEPROFILEDEF(.AREA.,$,#42,4000.,200.);
#71=IFCEXTRUDEDAREASOLID(#70,#13,#11,2700.);
#72=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#71));
#73=IFCPRODUCTDEFINITIONSHAPE($,$,(#72));
#74=IFCCARTESIANPOINT((3000.,5000.,0.));
#75=IFCAXIS2PLACEMENT3D(#74,#11,#12);
#76=IFCLOCALPLACEMENT(#17,#75);
#77=IFCWALL('0007',$,'Wall B',$,$,#76,#73,$);
/* a wall that leans: its upright axis points along x */
#80=IFCAXIS2PLACEMENT3D(#10,#12,#11);
#81=IFCLOCALPLACEMENT(#17,#80);
#82=IFCWALLSTANDARDCASE('0008',$,'Leaning',$,$,#81,#64,$);
#83=IFCRELCONTAINEDINSPATIALSTRUCTURE('0009',$,$,$,(#68,#77,#82),#21);
#90=IFCDOOR('0010',$,'Door',$,$,#14,$,$,2100.,900.);
#91=IFCSLAB('0011',$,'Slab',$,$,#14,$,$,.FLOOR.);
ENDSEC;
END-ISO-10303-21;
`;
const options = (
  source: PlanImportSource,
  more: Partial<PlanImportOptions> = {},
): PlanImportOptions => ({
  name: 'IFC house',
  metresPerUnit: 1,
  wallHeightM: 2.7,
  wallThicknessM: 0.2,
  layers: suggestPlanLayers(source),
  ...more,
});
const rounded = (points: { x: number; y: number }[]) =>
  points.map((p) => [Math.round(p.x * 1e6) / 1e6 + 0, Math.round(p.y * 1e6) / 1e6 + 0]);

describe('an IFC building file read as a plan', () => {
  const source = parsePlanFile('house.ifc', BUILDING);

  it('reads the unit, and gives everything in metres with the y turned over', () => {
    expect(source.format).toBe('ifc');
    expect(source.suggestedUnit).toBe('m');
    const living = source.shapes.find((s) => s.id === 'ifc-39')!;
    expect(living.closed).toBe(true);
    // The closing point of the line is kept here; the plan import takes a repeat out.
    expect(rounded(living.points)).toEqual([
      [0, 0],
      [6, 0],
      [6, -4],
      [0, -4],
      [0, 0],
    ]);
  });

  it('a rectangle that is placed and turned lands where its placement puts it', () => {
    const bath = source.shapes.find((s) => s.id === 'ifc-51')!;
    // 3000 along the turned x (the file's y) and 2000 across, about (8000, 1500): x from 7 to 9, y from 0 to 3.
    const xs = bath.points.map((p) => p.x);
    const ys = bath.points.map((p) => -p.y);
    expect([Math.min(...xs), Math.max(...xs)].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([
      7, 9,
    ]);
    expect([Math.min(...ys), Math.max(...ys)].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([
      0, 3,
    ]);
  });

  it('a wall comes by its axis line, or by the middle line of its body, on the storey that holds it', () => {
    const a = source.shapes.find((s) => s.id === 'ifc-68')!;
    expect(a.layer).toBe('Upper: walls');
    expect(rounded(a.points)).toEqual([
      [1, -1],
      [6, -1],
    ]);
    const b = source.shapes.find((s) => s.id === 'ifc-77')!;
    expect(rounded(b.points)).toEqual([
      [1, -5],
      [5, -5],
    ]);
  });

  it('says what it did not read, and what it skipped', () => {
    const words = source.warnings.join(' ');
    expect(words).toContain('Not read from the IFC file: 1 door, 1 slab.');
    expect(words).toContain('1 tilted walls skipped.');
    expect(words).toContain('one wall height applies to every floor');
    expect(source.shapes.some((s) => s.id === 'ifc-82')).toBe(false);
  });

  it('names its layers by storey, each with its role and its floor', () => {
    expect(suggestPlanLayers(source)).toEqual([
      { name: 'Ground: rooms', role: 'rooms', floor: 0 },
      { name: 'Upper: walls', role: 'walls', floor: 1 },
    ]);
  });

  it('becomes a design: two rooms on the ground floor, two free walls on the floor above', () => {
    const review = reviewPlanImport(source, options(source));
    expect(review.roomCount).toBe(2);
    expect(review.wallCount).toBe(2);
    expect(review.widthM).toBeCloseTo(9, 6);
    expect(review.depthM).toBeCloseTo(5, 6);
    expect(review.areaM2).toBeCloseTo(24 + 6, 6);
    const opened = normaliseLoadedProperty(review.property);
    const ground = opened.rooms.filter((r) => r.polygon.length >= 3 && !r.levelId);
    expect(ground.map((r) => r.polygon.length)).toEqual([4, 4]);
    expect(opened.walls).toHaveLength(2);
    expect(opened.walls!.every((w) => w.levelId === 'import-floor-1')).toBe(true);
    expect(opened.levels!.map((l) => l.name)).toContain('Floor 1');
  });
});

describe('the edges of what an IFC file may hold', () => {
  const wrap = (data: string) =>
    `ISO-10303-21;\nHEADER;\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${data}\nENDSEC;\nEND-ISO-10303-21;\n`;
  const SPACE = (unit: string) =>
    wrap(`${unit}
#10=IFCCARTESIANPOINT((0.,0.,0.));
#13=IFCAXIS2PLACEMENT3D(#10,$,$);
#14=IFCLOCALPLACEMENT($,#13);
#30=IFCCARTESIANPOINT((0.,0.));
#31=IFCCARTESIANPOINT((20.,0.));
#32=IFCCARTESIANPOINT((20.,10.));
#33=IFCCARTESIANPOINT((0.,10.));
#34=IFCPOLYLINE((#30,#31,#32,#33));
#35=IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,#34);
#36=IFCEXTRUDEDAREASOLID(#35,#13,$,9.);
#37=IFCSHAPEREPRESENTATION($,'Body','SweptSolid',(#36));
#38=IFCPRODUCTDEFINITIONSHAPE($,$,(#37));
#39=IFCSPACE('1',$,'Room',$,$,#14,#38,$,.ELEMENT.,$,$);`);

  it('a file in feet is brought to metres', () => {
    const feet = SPACE(`#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#2=IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.3048),#1);
#3=IFCCONVERSIONBASEDUNIT($,.LENGTHUNIT.,'FOOT',#2);
#4=IFCUNITASSIGNMENT((#3));`);
    const source = parsePlanFile('feet.ifc', feet);
    const xs = source.shapes[0].points.map((p) => p.x);
    expect(Math.max(...xs)).toBeCloseTo(20 * 0.3048, 9);
    expect(source.warnings.join(' ')).not.toContain('names no length unit');
  });

  it('a file that names no unit is read in metres, and says so; a file with no storey has one floor', () => {
    const source = parsePlanFile('plain.ifc', SPACE(''));
    expect(Math.max(...source.shapes[0].points.map((p) => p.x))).toBe(20);
    expect(source.warnings.join(' ')).toContain('names no length unit');
    expect(suggestPlanLayers(source)).toEqual([
      { name: 'Ground floor: rooms', role: 'rooms', floor: 0 },
    ]);
  });

  it('a storey that has spaces leaves its wall lines off, and says how to switch them on', () => {
    const both = SPACE(
      '#1=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);\n#4=IFCUNITASSIGNMENT((#1));',
    ).replace(
      'ENDSEC;\nEND-ISO',
      `#60=IFCCARTESIANPOINT((0.,0.));
#61=IFCCARTESIANPOINT((5.,0.));
#62=IFCPOLYLINE((#60,#61));
#63=IFCSHAPEREPRESENTATION($,'Axis','Curve2D',(#62));
#64=IFCPRODUCTDEFINITIONSHAPE($,$,(#63));
#68=IFCWALLSTANDARDCASE('2',$,'Wall',$,$,#14,#64,$);
ENDSEC;\nEND-ISO`,
    );
    const source = parsePlanFile('both.ifc', both);
    expect(suggestPlanLayers(source)).toEqual([
      { name: 'Ground floor: rooms', role: 'rooms', floor: 0 },
      { name: 'Ground floor: walls', role: 'skip', floor: 0 },
    ]);
    expect(source.warnings.join(' ')).toContain(
      'Wall lines of a storey that has spaces are left off',
    );
  });

  it('what is not an IFC file, or holds nothing to read, is refused in words', () => {
    expect(() => parsePlanFile('x.ifc', 'hello')).toThrow(/not an IFC file/);
    expect(() => parsePlanFile('x.ifc', wrap('#1=IFCDOOR($,$,$,$,$,$,$,$,$,$);'))).toThrow(
      /No space and no wall could be read/,
    );
  });

  it('a text with a semicolon or a doubled quote in it does not break the reading', () => {
    const source = parsePlanFile('house.ifc', BUILDING);
    expect(source.shapes).toHaveLength(4);
  });
});
