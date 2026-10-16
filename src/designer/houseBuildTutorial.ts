import type { AppLocale } from '../i18n/messages';

export type HouseTutorialAction =
  | 'project'
  | 'import'
  | 'foundation'
  | 'walls'
  | 'openings'
  | 'floors'
  | 'services'
  | 'services-plumbing'
  | 'services-hvac'
  | 'services-fire'
  | 'services-security'
  | 'roof'
  | 'furnish'
  | 'finishes'
  | 'garden'
  | 'materials'
  | 'review'
  | 'orders';
type Copy = readonly [title: string, instruction: string, review: string];
type Step = { id: string; action: HouseTutorialAction; copy: Record<AppLocale, Copy> };
/** Review sequence, never a site method statement or an automatic completion claim. */
export const HOUSE_TUTORIAL_STEPS: Step[] = [
  {
    id: 'brief',
    action: 'project',
    copy: {
      en: [
        'Project brief',
        'Open the project hub. Record the site, intended use and project assumptions before drawing.',
        'I have reviewed the brief and outstanding information.',
      ],
      fr: [
        'Programme du projet',
        'Ouvrez l’espace projet. Précisez le terrain, l’usage prévu et les hypothèses avant de dessiner.',
        'J’ai revu le programme et les informations manquantes.',
      ],
      es: [
        'Objetivo del proyecto',
        'Abra el centro del proyecto. Defina el terreno, el uso y las hipótesis antes de dibujar.',
        'He revisado el objetivo y la información pendiente.',
      ],
      'zh-CN': [
        '项目需求',
        '打开项目中心，先确认场地、用途和项目假设，再开始绘制。',
        '我已检查需求和待补充资料。',
      ],
    },
  },
  {
    id: 'survey',
    action: 'import',
    copy: {
      en: [
        'Plan and scale',
        'Import a supported plan or start with measured geometry. Check a known dimension; an image alone does not prove scale.',
        'I have checked the working units and a known dimension.',
      ],
      fr: [
        'Plan et échelle',
        'Importez un plan compatible ou dessinez avec des mesures. Vérifiez une cote connue : une image seule ne garantit pas l’échelle.',
        'J’ai vérifié les unités et une cote connue.',
      ],
      es: [
        'Plano y escala',
        'Importe un plano compatible o dibuje con medidas. Compruebe una distancia conocida; una imagen no demuestra la escala.',
        'He comprobado las unidades y una medida conocida.',
      ],
      'zh-CN': [
        '图纸与比例',
        '导入支持的图纸或输入测量尺寸。用已知尺寸核对比例，图片本身不能证明比例准确。',
        '我已核对单位和已知尺寸。',
      ],
    },
  },
  {
    id: 'excavation',
    action: 'foundation',
    copy: {
      en: [
        'Excavation',
        'Choose Dig rectangular hole or Circular hole. Enter depth; circular holes also have diameter. Place the hole, then check its position and bottom elevation.',
        'I have reviewed measured hole dimensions and requested ground/support review.',
      ],
      fr: [
        'Excavation',
        'Choisissez un trou rectangulaire ou circulaire. Saisissez la profondeur et, pour un cercle, le diamètre. Placez-le puis vérifiez sa position et le niveau du fond.',
        'J’ai revu les dimensions et demandé la vérification du sol et du soutènement.',
      ],
      es: [
        'Excavación',
        'Elija un hueco rectangular o circular. Introduzca profundidad y, para círculos, diámetro. Colóquelo y compruebe posición y cota inferior.',
        'He revisado las medidas y solicitado revisar suelo y sostenimiento.',
      ],
      'zh-CN': [
        '开挖协调',
        '选择矩形坑或圆孔，输入深度；圆孔还需直径。放置后核对位置和坑底标高。',
        '我已核对开挖尺寸，并提出土质及支护复核要求。',
      ],
    },
  },
  {
    id: 'concrete',
    action: 'foundation',
    copy: {
      en: [
        'Foundation concrete and steel',
        'Select a rectangular footing, enter approved thickness and the engineer’s reinforcement schedule, then Add concrete. Choose supply and allowance. Bore holes do not infer piles or fill.',
        'I have reviewed the quantities against the engineer’s drawings.',
      ],
      fr: [
        'Béton et armatures',
        'Sélectionnez une fondation rectangulaire, saisissez l’épaisseur validée et le ferraillage de l’ingénieur, puis ajoutez le béton. Les trous circulaires ne définissent pas des pieux.',
        'J’ai comparé les quantités aux plans de l’ingénieur.',
      ],
      es: [
        'Hormigón y acero',
        'Seleccione una cimentación rectangular, introduzca espesor aprobado y armaduras del ingeniero, y añada hormigón. Los huecos circulares no diseñan pilotes.',
        'He contrastado cantidades con los planos del ingeniero.',
      ],
      'zh-CN': [
        '基础混凝土与钢筋',
        '选择矩形基础，输入批准的厚度及工程师配筋表，再添加混凝土。选择供应方式与余量。圆孔不会自动推定桩或填充。',
        '我已将数量与工程师图纸核对。',
      ],
    },
  },
  {
    id: 'walls',
    action: 'walls',
    copy: {
      en: [
        'Walls and rooms',
        'Draw connected walls to close rooms. Check shared edges, wall height, thickness and material before reviewing quantities.',
        'I have reviewed room dimensions, shared walls and openings.',
      ],
      fr: [
        'Murs et pièces',
        'Reliez les murs pour fermer les pièces. Vérifiez les murs communs, hauteur, épaisseur et matériau avant les quantités.',
        'J’ai revu les dimensions, murs communs et ouvertures.',
      ],
      es: [
        'Muros y espacios',
        'Una los muros para cerrar habitaciones. Revise bordes compartidos, altura, espesor y material antes de calcular.',
        'He revisado dimensiones, muros compartidos y huecos.',
      ],
      'zh-CN': [
        '墙体与房间',
        '连接墙体形成封闭房间。先核对共用墙、高度、厚度及材料，再检查用量。',
        '我已检查房间尺寸、共用墙和洞口。',
      ],
    },
  },
  {
    id: 'openings',
    action: 'openings',
    copy: {
      en: [
        'Doors and windows',
        'Place doors and windows on their walls. Check width, height, swing and circulation in plan and 3D.',
        'I have reviewed opening sizes and usable clearances.',
      ],
      fr: [
        'Portes et fenêtres',
        'Placez les portes et fenêtres sur les murs. Vérifiez largeur, hauteur, sens d’ouverture et circulation en plan et en 3D.',
        'J’ai revu les dimensions des ouvertures et les dégagements.',
      ],
      es: [
        'Puertas y ventanas',
        'Coloque puertas y ventanas en sus muros. Compruebe ancho, altura, giro y circulación en planta y 3D.',
        'He revisado tamaños y espacios libres.',
      ],
      'zh-CN': [
        '门窗',
        '在墙上放置门窗，并在平面及3D中核对宽高、开启方向和通行空间。',
        '我已检查门窗尺寸和净空。',
      ],
    },
  },
  {
    id: 'storeys',
    action: 'floors',
    copy: {
      en: [
        'Floors and stairs',
        'Use the floor selector to add or select a storey. Check elevations, stair connections and the coordination of openings between floors.',
        'I have reviewed levels, floor heights and stair connections.',
      ],
      fr: [
        'Étages et escaliers',
        'Ajoutez ou sélectionnez un étage avec le sélecteur. Vérifiez les niveaux, les escaliers et les réservations entre étages.',
        'J’ai revu les niveaux, hauteurs et liaisons d’escalier.',
      ],
      es: [
        'Plantas y escaleras',
        'Añada o seleccione una planta en el selector. Revise cotas, escaleras y huecos entre plantas.',
        'He revisado cotas, alturas y conexiones de escaleras.',
      ],
      'zh-CN': [
        '楼层与楼梯',
        '通过楼层选择器添加或选择楼层，核对标高、楼梯连接及楼层间预留洞口。',
        '我已检查楼层标高、层高和楼梯连接。',
      ],
    },
  },
  {
    id: 'water',
    action: 'services-plumbing',
    copy: {
      en: [
        'Plumbing and drainage',
        'Select the floor and service type. Position mains and fixtures, then connect measured routes. Review underground levels, pipe sizes and maintenance access with the specialist.',
        'I have reviewed routing and requested hydraulic/drainage design.',
      ],
      fr: [
        'Plomberie et évacuation',
        'Choisissez l’étage et le réseau. Placez les arrivées et appareils, puis reliez les tracés mesurés. Faites vérifier niveaux enterrés, diamètres et accès.',
        'J’ai revu les tracés et demandé l’étude hydraulique et d’évacuation.',
      ],
      es: [
        'Agua y saneamiento',
        'Seleccione planta y red. Sitúe acometidas y aparatos y conecte rutas medidas. Revise niveles enterrados, diámetros y acceso con el especialista.',
        'He revisado recorridos y solicitado cálculo hidráulico y de drenaje.',
      ],
      'zh-CN': [
        '给排水',
        '选择楼层和管网类型，放置总管及设备，再连接测量路线。请专业人员核对地下标高、管径和维护空间。',
        '我已检查管线并提出给排水设计复核要求。',
      ],
    },
  },
  {
    id: 'power',
    action: 'services',
    copy: {
      en: [
        'Electrical and data routes',
        'Coordinate mains, distribution points and measured conduit/data routes. Separate service systems; circuit protection, loads and cable sizing need an electrical designer.',
        'I have reviewed routes and requested electrical design checks.',
      ],
      fr: [
        'Électricité et données',
        'Coordonnez arrivées, distribution et gaines. Séparez les réseaux ; protections, charges et sections nécessitent un concepteur électrique.',
        'J’ai revu les tracés et demandé les vérifications électriques.',
      ],
      es: [
        'Electricidad y datos',
        'Coordine acometidas, distribución y canalizaciones. Separe sistemas; protecciones, cargas y secciones requieren diseño eléctrico.',
        'He revisado rutas y solicitado comprobaciones eléctricas.',
      ],
      'zh-CN': [
        '电力与数据',
        '协调总接入、配电点和线管及数据路线。不同系统需分开；保护装置、负载及线径由电气设计人员确认。',
        '我已检查路线并提出电气设计复核要求。',
      ],
    },
  },
  {
    id: 'comfort',
    action: 'services-hvac',
    copy: {
      en: [
        'Ventilation and cooling',
        'Lay out measured equipment positions and HVAC routes. Check access, condensate and clashes; airflow and cooling capacity require specialist calculations.',
        'I have reviewed HVAC coordination and requested capacity checks.',
      ],
      fr: [
        'Ventilation et climatisation',
        'Positionnez les équipements et tracés CVC mesurés. Vérifiez accès, condensats et conflits ; débits et puissances nécessitent un calcul spécialisé.',
        'J’ai revu la coordination CVC et demandé les calculs de capacité.',
      ],
      es: [
        'Ventilación y climatización',
        'Sitúe equipos y recorridos de climatización. Revise acceso, condensados e interferencias; caudales y potencia requieren cálculo especializado.',
        'He revisado coordinación y solicitado cálculos de capacidad.',
      ],
      'zh-CN': [
        '通风与空调',
        '按尺寸布置设备和暖通路线，核对检修、冷凝水和碰撞。风量及冷量需专业计算。',
        '我已检查暖通协调并提出容量核算要求。',
      ],
    },
  },
  {
    id: 'life-safety',
    action: 'services-fire',
    copy: {
      en: [
        'Fire systems coordination',
        'Place the agreed system components and routes. This is coordination geometry; evacuation, fire coverage and approval require the responsible professionals.',
        'I have referred fire and escape provisions for professional review.',
      ],
      fr: [
        'Coordination incendie',
        'Placez les composants et tracés convenus. Il s’agit de géométrie de coordination ; évacuation, couverture et validation relèvent des professionnels.',
        'J’ai soumis les dispositions incendie et évacuation à une revue professionnelle.',
      ],
      es: [
        'Coordinación contra incendios',
        'Sitúe componentes y rutas acordados. Es geometría de coordinación; evacuación, cobertura y aprobación requieren profesionales responsables.',
        'He solicitado revisión profesional de protección y evacuación.',
      ],
      'zh-CN': [
        '消防协调',
        '布置商定的系统组件和路线。这只是协调模型；疏散、覆盖范围及审批由责任专业人员确认。',
        '我已将消防和疏散方案提交专业复核。',
      ],
    },
  },
  {
    id: 'security',
    action: 'services-security',
    copy: {
      en: [
        'Security and connected devices',
        'Coordinate device positions, power and data connections. Review privacy, maintenance access and coverage with the supplier.',
        'I have reviewed device locations and connection requirements.',
      ],
      fr: [
        'Sécurité et équipements connectés',
        'Coordonnez positions, alimentation et données. Vérifiez confidentialité, accès de maintenance et couverture avec le fournisseur.',
        'J’ai revu les positions et besoins de raccordement.',
      ],
      es: [
        'Seguridad y dispositivos',
        'Coordine posiciones, alimentación y datos. Revise privacidad, mantenimiento y cobertura con el proveedor.',
        'He revisado ubicaciones y conexiones necesarias.',
      ],
      'zh-CN': [
        '安防与智能设备',
        '协调设备位置、电源和数据连接，并与供应商检查隐私、检修空间和覆盖范围。',
        '我已检查设备位置和连接要求。',
      ],
    },
  },
  {
    id: 'roof',
    action: 'roof',
    copy: {
      en: [
        'Roof and solar',
        'Choose the roof level, shape and measured build-up. Position solar equipment; review orientation, shade and structural support separately.',
        'I have reviewed roof geometry and the limits of energy estimates.',
      ],
      fr: [
        'Toiture et solaire',
        'Choisissez niveau, forme et composition mesurée de la toiture. Placez le solaire et vérifiez séparément orientation, ombres et supports.',
        'J’ai revu la toiture et les limites des estimations énergétiques.',
      ],
      es: [
        'Cubierta y solar',
        'Elija nivel, forma y composición medida de cubierta. Sitúe equipos solares; revise orientación, sombra y soporte estructural por separado.',
        'He revisado geometría y límites de las estimaciones energéticas.',
      ],
      'zh-CN': [
        '屋面与太阳能',
        '选择屋面层、形状和构造尺寸，放置太阳能设备，并分别核对朝向、遮阴与结构支撑。',
        '我已检查屋面几何和能源估算的限制。',
      ],
    },
  },
  {
    id: 'finishes',
    action: 'finishes',
    copy: {
      en: [
        'Paint and surfaces',
        'Choose wall faces and flooring. Set paint coats and coverage, then check opening deductions, areas and supplier specifications.',
        'I have reviewed finish areas, coats and product coverage.',
      ],
      fr: [
        'Peinture et revêtements',
        'Choisissez faces des murs et sols. Saisissez couches et rendement, puis vérifiez ouvertures déduites, surfaces et fiches produits.',
        'J’ai revu surfaces, couches et rendement des produits.',
      ],
      es: [
        'Pintura y acabados',
        'Elija caras de muros y suelos. Defina manos y rendimiento; revise deducciones de huecos, áreas y especificaciones.',
        'He revisado superficies, manos y rendimiento.',
      ],
      'zh-CN': [
        '涂装与饰面',
        '选择墙面和地面，设置涂刷遍数及覆盖率，再核对洞口扣减、面积和产品参数。',
        '我已检查饰面面积、遍数和产品覆盖率。',
      ],
    },
  },
  {
    id: 'furniture',
    action: 'furnish',
    copy: {
      en: [
        'Furniture and equipment',
        'Place catalogue objects to scale. Compare plan and 3D, inspect product dimensions and leave access for use, doors and servicing.',
        'I have reviewed object sizes, clearances and product details.',
      ],
      fr: [
        'Mobilier et équipements',
        'Placez les objets à l’échelle. Comparez plan et 3D, contrôlez les dimensions et gardez les dégagements d’usage et d’entretien.',
        'J’ai revu dimensions, dégagements et détails produits.',
      ],
      es: [
        'Mobiliario y equipos',
        'Coloque productos a escala. Compare planta y 3D, compruebe medidas y deje espacios de uso, apertura y mantenimiento.',
        'He revisado tamaños, espacios libres y fichas.',
      ],
      'zh-CN': [
        '家具与设备',
        '按比例放置目录产品，对照平面和3D，检查产品尺寸并留足使用、开门和维护空间。',
        '我已检查物件尺寸、净空和产品信息。',
      ],
    },
  },
  {
    id: 'landscape',
    action: 'garden',
    copy: {
      en: [
        'Landscape and ecology',
        'Open Garden: drag a surface or use Custom outdoor outline for polygons and curves, then Finish. Select it to set material/sub-base depth. Add a Swimming pool to set basin/water depth and inspect excavation, empty or filled views. Review drainage, barriers and tree protection with the responsible designers.',
        'I have reviewed outdoor access, levels and ecological assumptions.',
      ],
      fr: [
        'Paysage et écologie',
        'Ouvrez Jardin : dessinez une surface ou un contour personnalisé avec segments et courbes, puis Terminer. Sélectionnez-la pour régler épaisseur et sous-couche. Ajoutez une piscine pour régler profondeur du bassin et de l’eau, puis voir excavation, bassin vide ou rempli. Faites vérifier drainage, barrières et arbres par les concepteurs responsables.',
        'J’ai revu accès extérieurs, niveaux et hypothèses écologiques.',
      ],
      es: [
        'Paisaje y ecología',
        'Abra Jardín: dibuje una superficie o un contorno personalizado con segmentos y curvas, y pulse Finalizar. Selecciónela para definir espesor y subbase. Añada una piscina para definir profundidad del vaso y del agua y ver excavación, vaso vacío o lleno. Revise drenaje, barreras y árboles con los responsables del diseño.',
        'He revisado acceso exterior, cotas e hipótesis ecológicas.',
      ],
      'zh-CN': [
        '景观与生态',
        '打开花园：拖动画出铺装，或用自定义轮廓绘制多边形和曲线，然后完成。选中后设置材料厚度和基层深度。添加泳池，设置池深及水深，并切换开挖、空池或蓄水视图。请负责设计的专业人员核查排水、防护栏及树木保护。',
        '我已检查室外通行、标高和生态假设。',
      ],
    },
  },
  {
    id: 'takeoff',
    action: 'materials',
    copy: {
      en: [
        'Quantities and assumptions',
        'Review Materials: units, net quantities, allowances, mix inputs and missing specifications. Do not combine duplicate foundation/base allowances.',
        'I have checked quantity assumptions and unresolved estimates.',
      ],
      fr: [
        'Quantités et hypothèses',
        'Revoyez les matériaux : unités, quantités nettes, pertes, mélanges et spécifications manquantes. Évitez les doubles comptes de fondations.',
        'J’ai vérifié les hypothèses et estimations non résolues.',
      ],
      es: [
        'Cantidades e hipótesis',
        'Revise materiales: unidades, cantidades netas, mermas, mezclas y datos pendientes. Evite duplicar cimentaciones y bases.',
        'He comprobado hipótesis y estimaciones pendientes.',
      ],
      'zh-CN': [
        '用量与假设',
        '检查材料的单位、净量、余量、配比和缺失参数，避免重复计算基础与底板余量。',
        '我已检查用量假设和未解决的估算问题。',
      ],
    },
  },
  {
    id: 'review',
    action: 'review',
    copy: {
      en: [
        'Professional review',
        'Inspect plan, elevations and 3D. Review project findings, clashes and missing information with the responsible designers before export or procurement.',
        'I have reviewed findings and assigned outstanding professional checks.',
      ],
      fr: [
        'Revue professionnelle',
        'Inspectez plans, élévations et 3D. Traitez constats, conflits et informations manquantes avec les concepteurs avant export ou achats.',
        'J’ai revu les constats et attribué les vérifications restantes.',
      ],
      es: [
        'Revisión profesional',
        'Inspeccione planos, alzados y 3D. Revise incidencias, interferencias y datos faltantes con los responsables antes de exportar o comprar.',
        'He revisado incidencias y asignado comprobaciones pendientes.',
      ],
      'zh-CN': [
        '专业复核',
        '检查平面、立面和3D，并在导出或采购前与责任设计人员核对问题、碰撞和缺失信息。',
        '我已检查问题并分配待完成的专业复核。',
      ],
    },
  },
  {
    id: 'procurement',
    action: 'orders',
    copy: {
      en: [
        'Supplier schedule and handover',
        'Review equipment packages, recipient emails and proposed order, invoice and delivery dates. Draft schedules do not send orders or invoices; verify backend capability and supplier approval.',
        'I have reviewed draft packages, dates, recipients and handover limits.',
      ],
      fr: [
        'Planning fournisseurs et remise',
        'Vérifiez lots, destinataires et dates proposées de commande, facture et livraison. Un brouillon n’envoie rien ; confirmez les capacités et accords fournisseurs.',
        'J’ai revu lots, dates, destinataires et limites de la remise.',
      ],
      es: [
        'Programa de proveedores y entrega',
        'Revise paquetes, destinatarios y fechas propuestas de pedido, factura y entrega. Los borradores no envían pedidos ni facturas; confirme capacidad y aprobación.',
        'He revisado paquetes, fechas, destinatarios y límites de entrega.',
      ],
      'zh-CN': [
        '供应计划与交付',
        '检查设备包、收件邮箱及拟定订购、开票和送货日期。草稿计划不会发送订单或发票；须确认后台能力及供应商批准。',
        '我已检查草稿设备包、日期、收件人和交付限制。',
      ],
    },
  },
];

export const houseTutorialStorageKey = (projectId: string) => `olb.house-tutorial.v1:${projectId}`;
export function readHouseTutorialProgress(projectId: string): { step: number; reviewed: string[] } {
  try {
    const value = JSON.parse(localStorage.getItem(houseTutorialStorageKey(projectId)) ?? 'null');
    return {
      step:
        Number.isInteger(value?.step) && value.step >= 0 && value.step < HOUSE_TUTORIAL_STEPS.length
          ? value.step
          : 0,
      reviewed: Array.isArray(value?.reviewed)
        ? [
            ...new Set<string>(
              value.reviewed.filter((id: unknown) =>
                HOUSE_TUTORIAL_STEPS.some((step) => step.id === id),
              ),
            ),
          ]
        : [],
    };
  } catch {
    return { step: 0, reviewed: [] };
  }
}
