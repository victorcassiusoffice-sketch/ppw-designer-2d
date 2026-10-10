export const PACK_DATE = '9 October 2026';
export const MEETING = 'https://calendly.com/victorcassius-office/ppw-client-meeting-1-hour';
export const PACK_LINKS = [
  {
    path: '/pitch/plumbing',
    name: 'Plumbing presentation',
    market: 'Plumbing suppliers, installers and bathroom showrooms',
  },
  {
    path: '/studio/sales',
    name: 'Employee starter pack',
    market: 'Sales employees and design consultants',
  },
  {
    path: '/demo?view=2d&panel=services&pitch=1',
    name: 'Plumbing & Electric lab',
    market: 'Plumbing and electrical planning',
  },
  {
    path: '/demo?view=2d&pitch=1',
    name: '2D design lab',
    market: 'Furniture, interiors and space planning',
  },
  {
    path: '/demo?view=3d&pitch=1',
    name: 'Premium 3D design lab',
    market: 'Interiors, showrooms and property developers',
  },
  {
    path: '/demo?scene=paint&view=3d&pitch=1',
    name: 'Paint design lab',
    market: 'Paint suppliers and decorators',
  },
  {
    path: '/demo?view=2d&panel=import&pitch=1',
    name: 'Measured plan import',
    market: 'Designers, architects and contractors',
  },
  {
    path: '/demo?view=3d&panel=materials&pitch=1',
    name: 'Materials estimates',
    market: 'Construction and building materials',
  },
  {
    path: '/demo?view=2d&panel=foundation&pitch=1',
    name: 'Measured foundations lab',
    market: 'Builders, estimators and concrete suppliers',
  },
  {
    path: '/demo?view=3d&panel=ai&pitch=1',
    name: 'AI and guided design',
    market: 'Design consultants and project teams',
  },
  {
    path: '/pitch/developers',
    name: 'Developer presentation',
    market: 'Developers and off-plan apartments',
  },
  {
    path: '/pitch/merchants',
    name: 'Merchant presentation',
    market: 'Retailers, manufacturers and distributors',
  },
  {
    path: '/pitch/construction',
    name: 'Construction presentation',
    market: 'Builders and material suppliers',
  },
  {
    path: '/pitch/developers?client=cap-tamarin',
    name: 'Cap Tamarin example',
    market: 'Residential developments',
  },
  {
    path: '/pitch/merchants?client=spa-concept',
    name: 'Spa Concept example',
    market: 'Wellness facilities and suppliers',
  },
  {
    path: '/studio/merchants/connect',
    name: 'Catalogue preparation',
    market: 'Merchants and product onboarding teams',
  },
  { path: '/studio/shop', name: 'Shop showcase', market: 'Multi-merchant retail' },
  {
    path: '/embed/designer?view=2d&pitch=1',
    name: '2D embed example',
    market: 'Company websites and product pages',
  },
  {
    path: '/embed/designer?view=3d&pitch=1',
    name: '3D embed example',
    market: 'Company websites and showrooms',
  },
  {
    path: '/api/mcp',
    name: 'MCP server address',
    market: 'Technical and AI integration teams',
    api: true,
  },
] as const;

export const CAPABILITIES = [
  [
    'Demonstrate now',
    'Measured 2D and 3D',
    'Close polygonal rooms against existing walls: shared edges need no redraw. Floors and Materials are directly accessible in the plan. Sourced products share one published dimensional envelope in 2D and 3D; illustrations show fit, not exact manufacturer detail.',
  ],
  [
    'Demonstrate now',
    'Plumbing & Electric',
    'Draw per-floor water, drainage and conduit routes. Attach compatible same-floor ports: links follow fixture moves and rotation. Set surveyed elevations and review missing connections. Routing opens in 2D; choose a building floor to return to the view you entered from. Ports are schematic.',
  ],
  [
    'Demonstrate now',
    'Paint and material quantities',
    'Choose paint coats, coverage assumptions and allowance before whole-tin estimation. Select editable masonry/concrete ratios; ready-mix and site-mix ingredients are alternatives. Private quotation rates require a stated unit, specification and tax basis. Public pitch demos show quantities without prices.',
  ],
  [
    'Demonstrate now',
    'Measured foundations',
    'Choose Foundation in Floors. Measure an excavation and inspect its depth, then use Add concrete for the filled design. Excavation and concrete volumes are separate; overlapping concrete counts once. Review a UBP / Premix reference or a site-mix ratio and an engineer’s rebar schedule. This is quantity planning, not foundation approval.',
  ],
  [
    'Demonstrate now',
    'Sourced catalogue examples',
    'Try Espace Maison toilet, sink, bidet, garden sofa, PVC pipe and conduit examples alongside Resiglas tanks. Each has paired 2D/3D dimensions and a source note. Images and models are illustrative; quote-required items are not free. Confirm availability and specifications with the supplier; there is no live inventory feed.',
  ],
  [
    'Demonstrate now',
    'Plan imports',
    'Review supported straight-line ASCII DXF, SVG or Designer JSON with scale and floor mapping. Native DWG, RVT, SKP, IFC and photo/PDF reconstruction are outside this importer.',
  ],
  [
    'Demonstrate now',
    'Guided design and MCP',
    'Create measured guided drafts and review them before applying. MCP supports bounded reference, quantity-estimate and draft tools, including materials and foundations. It cannot order, publish products or operate a customer project autonomously.',
  ],
  [
    'Configured access',
    'Hosted AI',
    'Provider configuration, sign-in and quota controls apply. Confirm access before promising a live AI demonstration.',
  ],
  [
    'Configured access',
    'Catalogue publication',
    'The public connection wizard validates CSV/JSON. An authorized merchant account can publish reviewed new-product batches. It is not an automatic stock sync.',
  ],
  [
    'Configured access',
    'Commerce backend',
    'The codebase includes shop, checkout, order and merchant workflows. Deployment, payments and merchant configuration must be checked. Demo routes block purchases.',
  ],
  [
    'Scope and integrate',
    'Company-specific modules',
    '2D only, 3D only, both, furniture only or paint only are commercial scopes. Branding, approved domains and catalogue/module restrictions need implementation and acceptance testing.',
  ],
  [
    'Scope and integrate',
    'One coordinated project',
    'Agree a project owner, revision process and each company’s visibility. Multi-company permissions, live co-editing and client approval deadlines require a defined workflow and integration.',
  ],
  [
    'Scope and integrate',
    'Orders and deliveries',
    'ERP feeds, automatic purchase orders, supplier stock reservations, delivery dates and contractor scheduling need supplier-specific connections and approval rules.',
  ],
  [
    'Professional review',
    'Technical design',
    'No hydraulic sizing, pressure-loss certification, drainage compliance, electrical protection design or structural certification is promised. Qualified professionals approve installation details.',
  ],
] as const;

export const MARKETS = [
  {
    name: 'Plumbing & bathrooms',
    buyer: 'Branch manager, technical sales lead or installer owner',
    problem: 'Agree fixture positions and pipe routes before quoting.',
    demo: '/pitch/plumbing',
    offer: '2D services pilot + showroom products',
    ask: 'Where does a drawing turn into your bill of materials?',
  },
  {
    name: 'Furniture & homeware',
    buyer: 'Retail director, ecommerce manager or showroom manager',
    problem: 'Help customers judge fit and compare a room arrangement.',
    demo: '/demo?view=3d&pitch=1',
    offer: 'Furniture-only 2D embed, optional 3D',
    ask: 'Which product returns or objections relate to size and fit?',
  },
  {
    name: 'Paint & decorators',
    buyer: 'Paint retailer, brand manager or decorating contractor',
    problem: 'Compare finishes and review coverage assumptions.',
    demo: '/demo?scene=paint&view=3d&pitch=1',
    offer: 'Paint-focused embed',
    ask: 'How do customers choose a finish and estimate quantities today?',
  },
  {
    name: 'Flooring & tiles',
    buyer: 'Showroom manager or flooring contractor',
    problem: 'Review surfaces, area and waste allowances.',
    demo: '/demo?view=2d&pitch=1',
    offer: 'Surface planning + approved catalogue',
    ask: 'Who checks pack size, pattern, waste and installation scope?',
  },
  {
    name: 'Solar & electrical',
    buyer: 'Solar sales engineer or electrical distributor',
    problem: 'Explain equipment placement and energy assumptions.',
    demo: '/demo?view=3d&pitch=1',
    offer: 'Roof/product layout + energy review',
    ask: 'Which datasheets and site checks support your proposal?',
  },
  {
    name: 'Lighting',
    buyer: 'Lighting retailer or specification team',
    problem: 'Discuss fixture placement and published wattage.',
    demo: '/demo?view=3d&pitch=1',
    offer: 'Lighting catalogue pilot',
    ask: 'Do you need visual placement or certified lighting calculations?',
  },
  {
    name: 'Garden & outdoor',
    buyer: 'Landscaper, garden retailer or outdoor-furniture seller',
    problem: 'Arrange outside areas, paths and furniture.',
    demo: '/demo?view=3d&pitch=1',
    offer: 'Outdoor catalogue + plot design',
    ask: 'Which terrain and installation details need a site visit?',
  },
  {
    name: 'Construction materials',
    buyer: 'Merchant director, estimator or contractor',
    problem: 'Connect wall geometry with reviewable quantities.',
    demo: '/pitch/construction',
    offer: 'Optional Materials workspace',
    ask: 'Which dimensions and assumptions do you use for take-offs?',
  },
  {
    name: 'Developers & property',
    buyer: 'Development director or buyer-experience team',
    problem: 'Let buyers explore approved apartment options.',
    demo: '/pitch/developers',
    offer: 'Apartment pilot + client workflow design',
    ask: 'Which decisions can buyers change, and when do they freeze?',
  },
  {
    name: 'Designers & architects',
    buyer: 'Studio principal or design operations lead',
    problem: 'Turn a brief into a reviewable space and product shortlist.',
    demo: '/demo?view=2d&panel=import&pitch=1',
    offer: 'Internal design workstation',
    ask: 'What files, units and level of detail must your workflow preserve?',
  },
  {
    name: 'Kitchens & fitted interiors',
    buyer: 'Showroom designer or manufacturing sales team',
    problem: 'Communicate layouts using verified product footprints.',
    demo: '/demo?view=2d&pitch=1',
    offer: 'Catalogue pilot; bespoke manufacturing rules scoped separately',
    ask: 'What clearance and fabrication constraints must be checked?',
  },
  {
    name: 'Hotels & hospitality',
    buyer: 'Owner, procurement lead or refurbishment manager',
    problem: 'Compare repeatable room layouts and furnishing options.',
    demo: '/pitch/developers',
    offer: 'Room-type pilot + procurement discovery',
    ask: 'Who approves a room standard and supplier substitutions?',
  },
  {
    name: 'Offices & workspace',
    buyer: 'Facilities manager or workplace designer',
    problem: 'Compare measured furniture arrangements.',
    demo: '/demo?view=2d&pitch=1',
    offer: 'Furniture layout for one office',
    ask: 'Which accessibility, egress and workplace checks apply?',
  },
  {
    name: 'Wellness & fitness',
    buyer: 'Gym owner, spa operator or equipment distributor',
    problem: 'Place equipment and review space and power assumptions.',
    demo: '/pitch/merchants?client=spa-concept',
    offer: 'Equipment catalogue + 2D/3D planning',
    ask: 'What service clearances and technical needs come with each item?',
  },
  {
    name: 'Doors, windows & roofing',
    buyer: 'Joinery seller, roofer or building supplier',
    problem: 'Communicate openings and roof material scope.',
    demo: '/pitch/construction',
    offer: 'Building-envelope planning pilot',
    ask: 'What must a surveyor confirm before fabrication or installation?',
  },
  {
    name: 'Pools, water & specialist systems',
    buyer: 'Specialist contractor or distributor',
    problem: 'Explore equipment space and the desired customer journey.',
    demo: '/pitch/plumbing',
    offer: 'Discovery first; specialist models and engineering are scoped',
    ask: 'Which parts can use generic planning and which need specialist design?',
  },
  {
    name: 'Agencies & website partners',
    buyer: 'Agency owner or implementation lead',
    problem: 'Add an interactive product experience to a client site.',
    demo: '/embed/designer?view=2d&pitch=1',
    offer: 'Embed integration or a full website project',
    ask: 'Who owns hosting, catalogue updates, customer data and support?',
  },
] as const;

export const OFFERS = [
  {
    name: 'Single-category pilot',
    scope:
      'One customer task, one category and a small approved product set. Choose 2D, 3D or both.',
    work: 'Configuration, catalogue preparation, measured sample checks and a supervised trial.',
    acceptance: 'The customer can finish the agreed task on desktop and phone.',
  },
  {
    name: 'Website embed',
    scope: 'Add the selected design experience to an existing page.',
    work: 'Site access, embed layout, branding, catalogue filters, domains and mobile testing.',
    acceptance: 'The embed loads correctly and hands off to the agreed enquiry or shopping flow.',
  },
  {
    name: 'Standalone studio',
    scope: 'A dedicated destination for design and an optional shop.',
    work: 'Hosting, identity, catalogue ownership, shop configuration and employee training.',
    acceptance: 'Employees can run the agreed design and catalogue workflow with assigned access.',
  },
  {
    name: 'Full website project',
    scope: 'Website design and content plus the selected Designer modules.',
    work: 'Discovery, site build, content, accessibility, integrations, launch and ongoing support.',
    acceptance:
      'The agreed pages, devices, forms and handoffs pass a written acceptance checklist.',
  },
  {
    name: 'Connected operations',
    scope: 'Internal teams, customers and approved suppliers around one project process.',
    work: 'Project/revision permissions, system mapping, approvals, order connections and monitoring.',
    acceptance:
      'A test project completes without duplicates, unauthorized changes or unapproved orders.',
  },
] as const;

export const EXERCISES = [
  {
    name: 'A room that fits',
    time: '15 minutes',
    path: '/demo?view=2d&pitch=1',
    steps: [
      'Open a practice demo and use Clear only on your practice design. Draw a room, then two sides of an adjoining triangle against an existing wall. Check the new room and shared edge.',
      'Place an item from the catalogue. Inspect dimensions, move it, rotate it and undo once.',
      'Use the visible Floors and Materials controls. Switch to 3D, then back to 2D: confirm the same arrangement. Use Fit when the view gets lost.',
    ],
    pass: 'Explain the physical footprint, undo a mistake and recover the view without losing the plan.',
  },
  {
    name: 'A plumbing consultation',
    time: '20 minutes',
    path: '/demo?view=2d&panel=services&pitch=1',
    steps: [
      'Choose a floor. Place a toilet, sink and mains tap. Inspect fixture dimensions and schematic connection ports.',
      'Draw a Cold water route. Select it and attach Start and End to compatible ports. Move a linked fixture and verify that the endpoint follows.',
      'Set the surveyed drainage connection elevation before linking a drain. Check unresolved warnings and explain why crossing lines are not junctions.',
      'Enter services from 3D, then choose a building floor: the original view returns. Confirm floor separation; cross-floor risers need their own measured route.',
      'Place a sourced sink or pipe stock item in the main plan and inspect it in 3D. Explain that stock objects and measured route quantities are separate, not automatically connected parts.',
    ],
    pass: 'Explain centre-line length and supplier size designations, and identify what a plumber must still specify.',
  },
  {
    name: 'A client design brief',
    time: '15 minutes',
    path: '/demo?view=3d&panel=ai&pitch=1',
    steps: [
      'Use the measured guided draft first. Check the footprint and room sizes before applying.',
      'Explain how a hosted AI draft differs and why sign-in/provider access may be needed.',
      'Change one product or finish and explain that a visual proposal is not an installation drawing.',
    ],
    pass: 'Present a coherent design option and a revision without promising automatic professional sign-off.',
  },
  {
    name: 'A merchant onboarding rehearsal',
    time: '20 minutes',
    path: '/studio/merchants/connect',
    steps: [
      'Open the public preparation wizard. Download its current template or use its built-in example.',
      'Change a dimension to an invalid value and validate. Read the error, fix it, and validate again.',
      'Inspect Review and Connect. Explain why the public wizard cannot publish and why a merchant identifier alone grants no access.',
    ],
    pass: 'Show a clean reviewed batch, explain mm and currency units, and stop before publishing.',
  },
  {
    name: 'A materials conversation',
    time: '15 minutes',
    path: '/demo?view=3d&panel=materials&pitch=1',
    steps: [
      'Open Materials and inspect the scope. A shared wall counts once for masonry; finish paint is measured by face.',
      'Switch a loose-volume ratio and explain why ingredient quantities change while the drawn wall size stays the same.',
      'Compare ready-mix volume with site-mix ingredients. Never add both supply methods, or add a summary to its component quantities.',
      'Explain that a private quotation needs matching units, pack sizes and tax basis. Unknown or withheld amounts cannot form a complete estimate; public pitch mode hides prices.',
    ],
    pass: 'Distinguish an estimate from a supplier quotation or approved structural design.',
  },
  {
    name: 'Foundation quantities',
    time: '15 minutes',
    path: '/demo?view=2d&panel=foundation&pitch=1',
    steps: [
      'Use Floors → Foundation. Draw a practice excavation; enter its footprint, depth and datum, then inspect the cutaway in 3D.',
      'Choose Add concrete and set the fill thickness. Compare excavation, concrete and remaining void; this changes a design stage, not a record of site completion.',
      'Compare a UBP / Premix ready-mix reference with a site-mix ratio. The supplier confirms grade and quote. Overlapping concrete counts once; Foundation mode replaces the old ground-base estimate.',
      'Use a fictional engineer-provided reinforcement schedule for rehearsal. Explain whole stock lengths and why overlapping steel schedules are withheld. Choose a building floor to return to the original view.',
    ],
    pass: 'Explain what is measured and what requires soil investigation, load design and professional approval.',
  },
  {
    name: 'Paint coats and whole tins',
    time: '10 minutes',
    path: '/demo?scene=paint&view=3d&pitch=1',
    steps: [
      'Apply a finish to a wall and choose one coat, then two. The phone brush and paint sheet use the same saved setting.',
      'Explain area × coats ÷ coverage, followed by allowance and whole tins. Two coats double raw demand, not necessarily the number of tins.',
      'Keep primer separate. Check openings, inside/outside faces and the product datasheet before presenting an estimate.',
    ],
    pass: 'Distinguish physical area, raw litres and purchasable packs without claiming a supplier-confirmed order.',
  },
  {
    name: 'A five-minute pitch',
    time: '15 minutes',
    path: '/pitch/plumbing',
    steps: [
      'Choose a sector and ask about one painful customer task.',
      'Show one relevant tool, one customer example and one clear limit.',
      'Suggest a bounded pilot and ask for a meeting with the workflow owner and catalogue owner.',
    ],
    pass: 'A colleague can repeat the problem, proposed scope, integration dependency and next step.',
  },
] as const;

export const ONBOARDING = [
  [
    'Permission and owner',
    'Get written permission to use product information, images and models. Identify the merchant catalogue owner and who approves publication. John Lewis is a prospect example, not an onboarded partner or a connected feed.',
  ],
  [
    'A small verified sample',
    'Request stable SKU, name, category, width/depth/height, source units, product URL, permitted image and manufacturer specifications. Record the source and review date.',
  ],
  [
    'Map the data',
    'The current importer expects widthMm, depthMm and heightMm in millimetres. It also requires merchant-supplied priceMinor and currency. Record stock only when verified. Do not invent missing values.',
  ],
  [
    'Respect the existing contract',
    'Use the current JSON/CSV template from the connection wizard. It accepts 1–50 products per batch under 1 MB. Map to a supported category. Pipe specifications, service materials and exact manufacturer meshes need separate technical mapping.',
  ],
  [
    'Validate and inspect',
    'Fix duplicate SKUs and missing or invalid fields. Check length, width and height against the source in both 2D and 3D; zoom must not change physical size. Tank capacity, pipe bore, connector positions and installation clearance are separate specifications. A format-valid product is not an exact 3D replica.',
  ],
  [
    'Publish with authorization',
    'The merchant signs into the assigned workspace and confirms the reviewed batch. Use the existing secure workflow. Never exchange tokens by email or in a pitch. Stop and check the catalogue after an uncertain outcome.',
  ],
  [
    'Maintain the catalogue',
    'Name the person responsible for product changes, discontinuations and stock. Agree manual updates first or scope a feed. Confirm a review schedule and a rollback/support contact.',
  ],
] as const;

export const SCRIPTS = [
  {
    name: 'First email',
    text: 'Subject: A design demo for [company] customers\n\nHi [name],\n\nHow do your customers currently check [product fit / fixture positions / finish choices] before asking for a quote?\n\nPPW Room Designer lets us demonstrate a measured layout in 2D, Premium 3D or both. We could scope just your product category, an embed on your existing website, or a wider studio.\n\nFor your team I would suggest a short pilot around [one task]. Catalogue preparation and any order-system integration would be agreed separately.\n\nHere is the relevant demonstration: [verified sector pitch link]. Would a one-hour walkthrough with Victor and your catalogue or operations lead be useful?\n[meeting link]\n\n[employee name and approved business contact]',
  },
  {
    name: 'Plumbing email',
    text: 'Subject: A visual plumbing consultation for [company]\n\nHi [name],\n\nWe have a working demonstration where a customer or adviser can place a sink and toilet, draw water and drainage routes per floor, and inspect measured route lengths with supplier references. It can support an earlier discussion before your team prepares a quotation.\n\nThe plumber still checks sizing, pressure, falls, fittings and installation suitability. We can then scope your catalogue, customer journey and any connection to your own order process.\n\nCould we show one bathroom example to your technical sales lead?\n[plumbing pitch link]\n[meeting link]\n\n[employee name and approved business contact]',
  },
  {
    name: 'Telephone or showroom opening',
    text: 'Hello, I work with Victor on PPW Room Designer. Who looks after your customer design consultations or website product experience? We can show how customers explore your type of products in a measured room. Could I ask how you handle [one relevant task] today, then show a two-minute example if it is useful?',
  },
  {
    name: 'Follow-up after the demo',
    text: 'Subject: [company] design pilot recap\n\nThank you for the discussion. You want to improve [task] for [users]. We demonstrated [working features] and identified [integration or data gaps].\n\nProposed first scope: [category], [2D / 3D / both], [embed / standalone / internal], with [approved sample catalogue].\nSuccess check: [observable outcome].\nYour owner: [role]. PPW owner: [role].\nOpen questions: [dependencies].\nNext step: a scoping meeting on [proposed date], followed by a written proposal. Nothing is ordered or installed through this message.\n[meeting link]',
  },
  {
    name: 'Referral to another category',
    text: 'You mentioned that [another supplier/team] also takes part in this customer journey. Would you be comfortable introducing us? We can explore a coordinated workflow, agree what each party may see, and keep catalogue ownership with each company. We would scope those connections before promising shared approvals or automatic ordering.',
  },
] as const;

export const DISCOVERY = [
  'Company / sector / decision-maker role',
  'Customer task and current process',
  'Internal staff, customers or both',
  'Required categories and 2D, 3D or both',
  'Website embed, standalone, internal tool or full website',
  'Catalogue owner, permissions and available product data',
  'Existing shop, order system and technical contact',
  'Other suppliers and who can see or change each project revision',
  'Budget constraints and what can wait',
  'Target timing, approvals and dependencies',
  'Pilot outcome and how it will be measured',
  'Next step, owner and agreed follow-up date',
] as const;

export function absolutePackLink(path: string, origin: string) {
  return new URL(path, origin).href;
}
export function handbook(origin: string) {
  const links = PACK_LINKS.map(
    (l) =>
      `- ${absolutePackLink(l.path, origin)} - Room Designer: ${l.market}. ${l.name}${'api' in l ? ' (MCP client endpoint, not a webpage)' : ''}.`,
  ).join('\n');
  return `# Room Designer employee starter pack\nUpdated ${PACK_DATE}\n\n## Start here\nRole: employee design consultant and software sales representative. Demonstrate useful workflows, gather product data with permission, and bring qualified scopes to Victor. Do not present yourself as a licensed architect, engineer or plumber unless qualified.\n\n1. Open the Demo lab and complete the ${EXERCISES.length} exercises below.\n2. Pick one sector and one customer problem.\n3. Check the feature status and run the same demo before the meeting.\n4. Ask discovery questions, demonstrate one task, and agree a pilot.\n5. Send an approved recap and hand over the scope.\n\nPublic pitches and /demo are for exploration. Studio and onboarding may ask for access. Obtain approved employee access from Victor, never put access codes in a prospect email. Practice in /demo. Use only fictional rehearsal details. This pack contains templates, not a live CRM or permission to contact anyone.\n\n## Clickable link directory\n${links}\n- ${MEETING} - Room Designer: all prospect markets, book a one-hour meeting.\n\n## What may be promised\n${CAPABILITIES.map(([s, t, b]) => `### ${t} (${s})\n${b}`).join('\n\n')}\n\n## Demo lab\n${EXERCISES.map((e) => `### ${e.name} (${e.time})\n${absolutePackLink(e.path, origin)}\n${e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\nPass check: ${e.pass}`).join('\n\n')}\n\n## Sector map\n${MARKETS.map((m) => `### ${m.name}\nBuyer: ${m.buyer}.\nProblem: ${m.problem}\nStarting offer: ${m.offer}.\nAsk: ${m.ask}\nDemo: ${absolutePackLink(m.demo, origin)}`).join('\n\n')}\n\n## Commercial options\n${OFFERS.map((o) => `### ${o.name}\nScope: ${o.scope}\nInstallation work: ${o.work}\nAcceptance: ${o.acceptance}`).join('\n\n')}\n\nDiscuss budget openly and phase the scope. A budget discussion is not a promise to deliver any requested system at any budget. Separate setup/installation, catalogue and model work, integrations, website work, hosting and maintenance, support/training, third-party services and later upgrades in a written proposal. Victor approves commercial terms. Do not invent prices, commissions, savings or delivery dates.\n\n## Several companies, one customer project\nExample: a customer chooses furniture, paint and bathroom fixtures while a designer maintains the brief and installers review the work. Treat this as a proposed coordinated service. Agree a project owner and revision ID, supplier ownership, customer consent, permitted viewers/editors, a choice-freeze policy and who releases each order. Confirm stock, substitutions and accepted delivery dates with each supplier. Test failures and duplicate prevention. Do not claim live co-editing or universal ERP integration.\n\n## Product onboarding\n${ONBOARDING.map(([t, b], i) => `${i + 1}. ${t}: ${b}`).join('\n\n')}\n\n## Outreach templates\nReview with Victor, replace every placeholder and follow the company’s contact policy before sending. No outreach is sent by this pack.\n\n${SCRIPTS.map((s) => `### ${s.name}\n${s.text.split('[meeting link]').join(MEETING).replace('[plumbing pitch link]', absolutePackLink('/pitch/plumbing', origin))}`).join('\n\n')}\n\n## Discovery and handover\n${DISCOVERY.map((x) => `- ${x}: [complete in your approved CRM]`).join('\n')}\n- Record contact permission and agreed next action in the approved company system.\n- Keep identity documents, customer plans, payment data and credentials out of public demonstrations.\n- Hand over: agreed need, observed demo, data sample location, product rights, assumptions, exclusions, success check, owner and next date.\n- Pipeline: researched, contact authorized, contacted, discovery, demo, scoped, proposal, approved pilot, implementation, review. Keep next owner/date at every step.\n\n## Objections\n- Already have a website: propose one embedded task; check the platform and brand requirements.\n- Only need furniture: scope that catalogue and 2D first, with optional 3D.\n- Small budget: choose one measurable pilot; defer integrations and bespoke models.\n- Want exact product appearance: verify manufacturer models, dimensions and usage rights; generic envelopes are not exact replicas.\n- Want automatic ordering: map the existing system, authorization, retries, substitutions and test environment before committing.\n- Want clients and staff on one project: agree identity, permissions and revisions; collaboration is a separate acceptance scope.\n\n## Readiness check\nAn employee is ready for supervised pitches after a colleague observes: a five-minute sector demo, accurate explanation of feature status, recovery from a tool/view mistake, a catalogue validation rehearsal, a useful discovery summary and a clear meeting request.\n`;
}
