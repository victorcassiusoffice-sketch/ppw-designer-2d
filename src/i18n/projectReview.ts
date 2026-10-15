import type { ProjectReviewFinding } from '../designer/projectReview';
import type { AppLocale } from './messages';

/** Presentation only: engineering rules, evidence, units and machine identifiers stay canonical.
 * Dynamic validation messages deliberately keep their full original detail. */
type Languages = readonly [fr: string, zh: string, es: string];
type ReviewCopy = { title: Languages; recommendation?: Languages; criticalTitle?: Languages };
export const PROJECT_REVIEW_COPY = {
  'calculation-budget': {
    title: [
      'Les quantités et le contrôle du projet sont indisponibles',
      '项目工程量与筛查不可用',
      'Las cantidades y la revisión del proyecto no están disponibles',
    ],
    recommendation: [
      'Corrigez la géométrie invalide ou examinez des sections coordonnées plus petites. Le projet est conservé ; aucune quantité partielle ou nulle n’est présentée comme un résultat complet.',
      '请修正无效几何，或分为较小且相互协调的项目区域审核。设计已保留；部分数量或零值不会被当作完整结果。',
      'Corrija la geometría no válida o revise secciones coordinadas más pequeñas. El diseño se conserva; ninguna cantidad parcial o nula se presenta como un resultado completo.',
    ],
  },
  'review-scope': {
    title: [
      'Contrôle des mesures ; statut technique non vérifié',
      '测量筛查；工程状态仍未核实',
      'Revisión de medidas; estado técnico sin verificar',
    ],
    recommendation: [
      'Faites vérifier par l’ingénieur les relevés du site, la transmission des charges, les actions du vent et des cyclones, la géotechnique, le drainage et les réseaux. Confirmez les autorisations et distances aux réseaux auprès des autorités mauriciennes.',
      '请项目工程师核实场地测量、荷载传递、风与气旋作用、岩土数据、排水及管线。向毛里求斯主管部门确认现行许可和公用设施间距。',
      'El ingeniero debe verificar levantamientos, transmisión de cargas, viento y ciclones, geotecnia, drenaje y servicios. Confirme permisos y separaciones con las autoridades de Mauricio.',
    ],
  },
  'engineering-input-invalid': {
    title: [
      'Les références techniques contiennent des données invalides',
      '工程参考资料包含无效数据',
      'Las referencias técnicas contienen datos no válidos',
    ],
    recommendation: [
      'Corrigez les références importées avant de les utiliser dans une revue.',
      '请先修正导入的参考资料，再用于审核。',
      'Corrija las referencias importadas antes de usarlas en una revisión.',
    ],
  },
  'foundation-design-inputs': {
    title: [
      'Les quantités de fondations ne prouvent pas leur capacité',
      '基础工程量不能证明承载能力',
      'Las cantidades de cimentación no demuestran su capacidad',
    ],
    recommendation: [
      'Joignez les spécifications de sol, charges, béton et armatures de l’ingénieur. Les références saisies ne sont pas vérifiées indépendamment.',
      '请附上工程师的土壤、荷载、混凝土及钢筋规格。输入的参考资料未经独立核实。',
      'Adjunte las especificaciones del ingeniero sobre suelo, cargas, hormigón y armaduras. Las referencias introducidas no se verifican de forma independiente.',
    ],
  },
  'foundation-steel-omitted': {
    title: [
      'Le plan de ferraillage n’est pas renseigné',
      '尚未输入钢筋配置表',
      'No se ha introducido el despiece de armaduras',
    ],
    recommendation: [
      'Saisissez le ferraillage prescrit par l’ingénieur, ou documentez la conception de cet élément en béton non armé.',
      '请输入工程师指定的钢筋配置，或提供该构件按素混凝土设计的依据。',
      'Introduzca el despiece indicado por el ingeniero o documente el diseño del elemento como hormigón sin armar.',
    ],
  },
  'foundation-steel-lap': {
    title: [
      'Les barres dépassent la longueur commerciale sans recouvrement prévu',
      '钢筋长度超过库存定尺且未计搭接',
      'Las barras superan la longitud comercial sin empalme previsto',
    ],
    recommendation: [
      'Saisissez le recouvrement prescrit par l’ingénieur ou une longueur de barre adaptée. Ne commandez pas ce ferraillage incomplet.',
      '请输入工程师规定的搭接长度或更长的定尺钢筋。请勿按此不完整配置采购钢筋。',
      'Introduzca el solape indicado por el ingeniero o barras de mayor longitud. No compre acero con este despiece incompleto.',
    ],
  },
  'excavation-support': {
    title: [
      'L’excavation est un volume estimatif à parois verticales',
      '开挖模型为竖直侧壁的估算包络',
      'La excavación es un volumen estimado de paredes verticales',
    ],
    recommendation: [
      'Précisez le soutènement provisoire ou une géométrie d’excavation sûre, la maîtrise des eaux souterraines et les accès avant les travaux.',
      '施工前请明确临时支护或安全开挖形状、地下水控制和出入通道。',
      'Defina el sostenimiento temporal o una geometría segura, el control del agua subterránea y los accesos antes de ejecutar.',
    ],
  },
  'foundation-steel-incomplete': {
    title: [
      'Le métré des armatures de fondations est incomplet',
      '基础钢筋工程量不完整',
      'La medición de armaduras de cimentación está incompleta',
    ],
    recommendation: [
      'Résolvez les ferraillages superposés et les recouvrements non renseignés avant d’acheter l’acier.',
      '采购钢筋前请解决重复配置和未输入的搭接余量。',
      'Resuelva despieces superpuestos y solapes pendientes antes de comprar acero.',
    ],
  },
  'foundation-invalid': {
    title: [
      'Les données de fondations ne permettent pas une estimation',
      '基础输入数据无法估算',
      'Los datos de cimentación no permiten estimar',
    ],
  },
  'materials-incomplete': {
    title: [
      'Une quantité de matériau demandée est incomplète',
      '某项所需材料工程量不完整',
      'Una cantidad de material solicitada está incompleta',
    ],
  },
  'site-mix-strength': {
    title: [
      'Un dosage n’est pas une spécification de résistance du béton',
      '配合比例不是混凝土强度规格',
      'La dosificación no es una especificación de resistencia del hormigón',
    ],
    recommendation: [
      'Confirmez avec le fournisseur la classe prescrite, le dosage, la granulométrie, le rapport eau/ciment, la correction d’humidité et les résultats d’essais.',
      '请与混凝土供应商确认设计强度等级、配料方法、骨料级配、水灰比、含水修正及试验结果。',
      'Confirme con el proveedor la clase prescrita, el método de dosificación, granulometría, relación agua/cemento, corrección de humedad y ensayos.',
    ],
  },
  'roof-steel-omitted': {
    title: [
      'Les armatures de toiture sont exclues du métré',
      '屋面钢筋未计入材料工程量',
      'Las armaduras de cubierta están excluidas de la medición',
    ],
    recommendation: [
      'Renseignez le plan de ferraillage du projet avant de considérer les quantités de toiture comme complètes.',
      '认为屋面工程量完整之前，请输入项目钢筋配置表。',
      'Introduzca el despiece del proyecto antes de considerar completas las cantidades de cubierta.',
    ],
  },
  'service-disconnected': {
    title: [
      'Un raccordement de réseau n’est pas résolu',
      '某处管线连接尚未解决',
      'Una conexión de servicios está sin resolver',
    ],
  },
  'service-specification': {
    title: [
      'La canalisation ou gaine ne correspond pas à une référence catalogue',
      '管道或线管规格尚未匹配目录',
      'La tubería o conducto no coincide con una referencia del catálogo',
    ],
    recommendation: [
      'Confirmez avec le fournisseur le système, le diamètre nominal et extérieur réel, la pression ou classe électrique et la longueur commerciale.',
      '请向供应商确认系统类型、公称直径、实际外径、压力或电气等级及库存长度。',
      'Confirme con el proveedor sistema, diámetro nominal y exterior real, clasificación de presión o eléctrica y longitud comercial.',
    ],
  },
  'drainage-no-fall': {
    title: [
      'Le drainage n’a pas de pente dans le sens dessiné',
      '排水管在绘制的起点至终点方向没有降差',
      'El drenaje no tiene caída en el sentido dibujado',
    ],
    recommendation: [
      'Vérifiez le sens d’écoulement, les cotes de fil d’eau relevées et la conception du drainage. Ce contrôle ne détermine ni pente sûre ni diamètre.',
      '请核实流向、实测管底标高和排水设计。此检查不会确定安全坡度或管径。',
      'Verifique dirección del flujo, cotas medidas y diseño de drenaje. Esta comprobación no define una pendiente segura ni el diámetro.',
    ],
  },
  'utility-design': {
    title: [
      'La géométrie des réseaux n’est pas un calcul hydraulique ou électrique',
      '管线几何模型不等于水力或电气设计',
      'La geometría de servicios no es un diseño hidráulico o eléctrico',
    ],
    recommendation: [
      'Faites vérifier demande, pression, protections, sections de câbles, mise à la terre, drainage et raccordements. Un croisement ne crée pas de jonction.',
      '请审核需求与压力、保护装置、电缆尺寸、接地、排水及公用设施接入。线路交叉不会自动形成连接。',
      'Obtenga revisión de demanda, presión, protecciones, cables, puesta a tierra, drenaje y conexiones. Un cruce no crea una unión.',
    ],
  },
  'eco-input-invalid': {
    title: [
      'Les données écologiques sont invalides ou dupliquées',
      '生态输入包含无效或重复记录',
      'Los datos ecológicos son inválidos o están duplicados',
    ],
    recommendation: [
      'Corrigez l’ensemble du modèle écologique. Aucune entrée invalide n’a été convertie silencieusement en estimation.',
      '请修正完整生态模型。无效条目未被自动转换为估算值。',
      'Corrija el modelo ecológico completo. Ningún dato inválido se ha convertido silenciosamente en una estimación.',
    ],
  },
  'tree-rpa-missing': {
    title: [
      'Le périmètre de protection de l’arbre n’est pas confirmé',
      '树木保护范围尚未确认',
      'El perímetro de protección del árbol no está confirmado',
    ],
    recommendation: [
      'Obtenez un relevé arboricole. Pour un arbre non vétéran à tronc unique, saisissez le diamètre du tronc mesuré à 1,5 m. Les arbres multitroncs et vétérans nécessitent une méthode spécifique au relevé.',
      '请取得树木调查。对非古老、单干树的初步估算，输入离地 1.5 m 处的树干直径。多干树和古老树木需采用针对调查的专门方法。',
      'Obtenga un estudio arborícola. Para un árbol no veterano de un solo tronco, introduzca el diámetro medido a 1,5 m. Los árboles de varios troncos y veteranos requieren un método específico.',
    ],
  },
  'tree-rpa-basis': {
    title: [
      'Le rayon de protection est une donnée de présélection',
      '树木保护半径是初步筛查输入',
      'El radio de protección es un dato de revisión preliminar',
    ],
    recommendation: [
      'Confirmez périmètre, statut de l’arbre et protections adaptées avec un arboriculteur. Être hors du périmètre ne prouve pas qu’une fondation est protégée des mouvements du sol.',
      '请与树艺专业人员确认保护范围、树木状态和场地保护措施。位于范围外不能证明基础不受土体变形影响。',
      'Confirme perímetro, estado y medidas de protección con un especialista. Estar fuera no demuestra que la cimentación esté a salvo de movimientos del suelo.',
    ],
  },
  'tree-foundation-conflict': {
    title: [
      'La fondation ou l’excavation entre dans la zone de protection',
      '基础或开挖进入树木保护区域',
      'La cimentación o excavación invade la zona de protección',
    ],
    recommendation: [
      'Déplacez ou reconcevez la fondation ou l’excavation avec l’ingénieur structure et l’arboriculteur avant les travaux.',
      '施工前请与结构工程师及树艺专业人员协调移动或重新设计基础或开挖。',
      'Desplace o rediseñe la cimentación o excavación con el ingeniero estructural y el especialista arbóreo antes de ejecutar.',
    ],
  },
  'tree-service-conflict': {
    title: [
      'Un réseau enterré peut entrer dans la zone de protection',
      '地下管线可能进入树木保护区域',
      'Un servicio enterrado puede invadir la zona de protección',
    ],
    recommendation: [
      'Coordonnez largeur et profondeur réelles de tranchée et méthode de pose avec les spécialistes. Les axes des tuyaux ne représentent pas toute l’excavation.',
      '请与树艺及管线工程师协调实际沟槽宽度、深度和安装方法。管道中心线不代表全部开挖范围。',
      'Coordine anchura y profundidad reales de zanja y método de instalación con los especialistas. Los ejes de tuberías no representan toda la excavación.',
    ],
  },
  'tree-city-utility-conflict': {
    title: [
      'Une tranchée urbaine entre dans la zone de protection',
      '城市管线沟槽进入树木保护区域',
      'Una zanja urbana invade la zona de protección',
    ],
    recommendation: [
      'Déviez le réseau ou obtenez une méthode de pose arboricole approuvée et un projet de réseau basé sur des relevés.',
      '请改线，或取得经批准的树木保护安装方法及基于测量的管线设计。',
      'Desvíe la red u obtenga un método de instalación arborícola aprobado y un diseño de servicios basado en levantamientos.',
    ],
  },
  'tree-canopy-conflict': {
    title: [
      'La couronne de l’arbre recoupe une emprise bâtie en plan',
      '树冠在平面上与建筑占地重叠',
      'La copa del árbol se superpone a una huella edificada',
    ],
    recommendation: [
      'Vérifiez dégagement de la couronne, croissance future, branches et volume réel du bâtiment. Le recoupement en plan est une alerte de coordination, pas un verdict de collision 3D.',
      '请检查树冠净距、未来生长、枝条及实际建筑包络。平面重叠是协调提示，不是 3D 碰撞结论。',
      'Revise separación de copa, crecimiento futuro, ramas y volumen real del edificio. La superposición en planta es una alerta, no una conclusión de colisión 3D.',
    ],
  },
  'green-roof-area': {
    title: [
      'La surface végétalisée ne correspond pas à sa toiture',
      '绿化屋面面积无法匹配其屋面房间',
      'La superficie verde no coincide con su recinto de cubierta',
    ],
    recommendation: [
      'Choisissez une toiture existante et une surface au plus égale à son emprise mesurée. Les références de toiture absentes ou supprimées ne sont pas estimées.',
      '请选择现有屋面房间，面积不得超过其测量平面占地。缺失或已删除的屋面引用不予估算。',
      'Seleccione un recinto de cubierta existente y una superficie no mayor que su huella medida. Las referencias ausentes o eliminadas no se estiman.',
    ],
  },
  'green-roof-load': {
    title: [
      'La charge végétalisée nécessite une vérification du projet',
      '绿化屋面荷载需要项目核实',
      'La carga de cubierta verde requiere verificación del proyecto',
    ],
    criticalTitle: [
      'La charge végétalisée dépasse la capacité supplémentaire saisie',
      '绿化屋面荷载超过输入的附加承载能力',
      'La carga verde supera la capacidad adicional introducida',
    ],
    recommendation: [
      'Faites vérifier par l’ingénieur structure le complexe saturé, l’eau, les charges d’entretien et ponctuelles, combinaisons, supports, soulèvement au vent, étanchéité et drainage. La capacité saisie n’est pas vérifiée ici.',
      '请结构工程师检查饱和构造、水、活荷载与维护荷载、集中荷载、荷载组合、支承、风吸力、防水和排水。此处未核实输入的承载能力。',
      'El ingeniero debe revisar el sistema saturado, agua, cargas de uso y mantenimiento, cargas puntuales, combinaciones, apoyos, succión de viento, impermeabilización y drenaje. Aquí no se verifica la capacidad introducida.',
    ],
  },
  'green-roof-slope': {
    title: [
      'La masse végétalisée utilise actuellement la surface horizontale',
      '绿化屋面质量当前按水平投影面积计算',
      'La masa verde usa actualmente la superficie horizontal',
    ],
    recommendation: [
      'Obtenez la surface réelle en pente, le dispositif de retenue et la conception du système avant d’utiliser cette quantité pour une toiture inclinée.',
      '将此数量用于斜屋面前，请取得实际坡面面积、抗滑约束及产品系统设计。',
      'Obtenga la superficie inclinada real, la retención y el diseño del sistema antes de usar esta cantidad en una cubierta inclinada.',
    ],
  },
  'review-limit': {
    title: [
      'La limite de contrôle du projet est atteinte',
      '已达到项目筛查上限',
      'Se ha alcanzado el límite de revisión',
    ],
    recommendation: [
      'Vérifiez des sections coordonnées plus petites. Les éléments non contrôlés ne doivent pas être considérés sans conflit.',
      '请分成较小且相互协调的项目区域进行审核。未经检查的对象不能视为无冲突。',
      'Revise secciones coordinadas más pequeñas. Los elementos no comprobados no deben considerarse libres de conflictos.',
    ],
  },
} as const satisfies Record<string, ReviewCopy>;

export function localizeProjectReviewFinding(
  finding: ProjectReviewFinding,
  locale: AppLocale,
): ProjectReviewFinding {
  if (locale === 'en') return finding;
  const column = ({ fr: 0, 'zh-CN': 1, es: 2 } as const)[locale];
  const copy: ReviewCopy | undefined =
    PROJECT_REVIEW_COPY[finding.ruleId as keyof typeof PROJECT_REVIEW_COPY];
  if (!copy || column === undefined) return finding;
  const title =
    finding.ruleId === 'green-roof-load' &&
    finding.title === 'Green-roof load exceeds the entered additional capacity' &&
    copy.criticalTitle
      ? copy.criticalTitle[column]
      : copy.title[column];
  return {
    ...finding,
    title,
    recommendation: copy.recommendation?.[column] ?? finding.recommendation,
  };
}
