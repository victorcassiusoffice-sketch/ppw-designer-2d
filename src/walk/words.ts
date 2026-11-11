import type { AppLocale } from '../i18n/messages';

// Loaded with Walk, after the first 3D picture.
const translations: Record<string, readonly [string, string, string]> = {
  "Generated character": ["Personnage généré", "生成角色", "Personaje generado"],
  "Place a person": ["Placer une personne", "放置人物", "Colocar una persona"],
  "Drag a person onto the land or a floor": ["Faites glisser une personne sur le terrain ou un étage", "将人物拖到地面或楼层上", "Arrastra una persona al terreno o a un piso"],
  "Placement level": ["Niveau de placement", "放置楼层", "Nivel de colocación"],
  "Drag the person or tap a clear spot.": ["Faites glisser la personne ou touchez un espace libre.", "拖动人物或轻点空地。", "Arrastra la persona o toca un espacio libre."],
  "Choose clear ground on this level.": ["Choisissez une surface libre à ce niveau.", "请在这一层选择空旷处。", "Elige un espacio libre en este nivel."],
  "Walk level": ["Niveau de visite", "行走楼层", "Nivel del recorrido"],
  "Level": ["Niveau", "楼层", "Nivel"],
  "Cutaway": ["Coupe", "剖切", "Vista en corte"],
  "Whole build": ["Vue d’ensemble", "建筑全景", "Vista general"],
  "Mouse look": ["Regarder à la souris", "鼠标环视", "Mirar con el ratón"],
  "Look around": ["Regarder autour", "环顾四周", "Mirar alrededor"],
  "Look": ["Regarder", "环视", "Mirar"],
  "Choose a level to start there, even without stairs.": ["Choisissez votre étage de départ, même sans escalier.", "即使没有楼梯，也可以选择起始楼层。", "Elige el piso donde empezar, incluso sin escaleras."],
  "Choose another starting point": ["Choisir un autre départ", "选择其他起点", "Elegir otro punto de inicio"],
  "Go to top floor": ["Aller au dernier étage", "前往顶层", "Ir al último piso"],
  "No clear standing surface on this level.": ["Aucune surface libre pour se tenir debout à ce niveau.", "此楼层没有可站立的空地。", "No hay espacio para estar de pie en este nivel."],
  "No clear standing space on this surface. Choose a floor or another spot on the land.": ["Aucun espace libre sur cette surface. Choisissez un étage ou un autre endroit sur le terrain.", "此处无法站立。请选择楼层或另一块空地。", "Aquí no hay espacio. Elige otro piso u otro lugar del terreno."],
  "A stair no longer fits its floors. It is unavailable in this visit.": ["Un escalier ne correspond plus à ses étages. Il est indisponible pendant la visite.", "有一段楼梯与楼层不再相符，本次参观无法使用。", "Una escalera ya no encaja entre sus pisos y queda fuera del recorrido."],
  "No clear route. Open a door or choose a nearer spot.": ["Aucun passage libre. Ouvrez une porte ou choisissez un point plus proche.", "没有畅通的路线。请开门或选择较近的位置。", "No hay paso libre. Abre una puerta o elige un lugar más cercano."],
  "The route is blocked.": ["Le passage est bloqué.", "路线被阻挡。", "El paso está bloqueado."],
  "Click or drag · Click to walk · Drag to look · E doors · V view · B whole build · Esc exits": ["Cliquez pour marcher · Faites glisser pour regarder · E portes · V vue · B ensemble · Échap quitte", "点击行走 · 拖动环视 · E 门 · V 视角 · B 全景 · Esc 退出", "Haz clic para caminar · Arrastra para mirar · E puertas · V vista · B conjunto · Esc salir"],
};

export function walkWords(locale: AppLocale, fallback: (text: string) => string) {
  return (text: string): string => {
    const row = translations[text];
    if (!row || locale === 'en') return fallback(text);
    return row[locale === 'fr' ? 0 : locale === 'zh-CN' ? 1 : 2];
  };
}
