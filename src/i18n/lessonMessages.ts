/**
 * Words for the lessons layer (tool cards, the Lessons list, the first-build
 * quest, tooltips and loading tips), in the same four columns as
 * `messages.ts`: [en, fr, zh-CN, es].
 *
 * Why a second file: `messages.ts` is in the first download, and these ~170
 * rows would add about 10 KB to it, so the first picture would get slower.
 * This file is imported only by the lessons code, which loads after the
 * first picture. The words that show before that (the `?` panel's tabs)
 * live in `messages.ts` as usual.
 *
 * Our own words. One idea per line. Product names are never translated.
 */
import { LOCALES, type AppLocale } from './messages';

export const lessonRows = {
  // ── Card chrome ─────────────────────────────────────────────────────
  'lesson.ui.tip': ['Tip', 'Astuce', '提示', 'Consejo'],
  'lesson.ui.gotIt': ['Got it', 'Compris', '知道了', 'Entendido'],
  'lesson.ui.noMoreTips': ['No more tips', 'Plus d’astuces', '不再提示', 'Sin más consejos'],
  'lesson.ui.sounds': ['Sounds', 'Sons', '声音', 'Sonidos'],
  'lesson.ui.soundsOn': ['Sounds on', 'Sons activés', '声音已开启', 'Sonidos activados'],
  'lesson.ui.soundsOff': ['Sounds off', 'Sons coupés', '声音已关闭', 'Sonidos desactivados'],
  'lesson.ui.key': ['Keys', 'Touches', '按键', 'Teclas'],
  'lesson.ui.showTip': ['Show the {tool} tip', 'Afficher l’astuce {tool}', '显示“{tool}”提示', 'Mostrar el consejo de {tool}'],
  'lesson.ui.closeTip': ['Close tip', 'Fermer l’astuce', '关闭提示', 'Cerrar consejo'],
  'lesson.ui.how': ['How', 'Comment', '用法', 'Cómo'],
  'lesson.ui.clipLabel': ['Short clip of {tool} in use', 'Court extrait de {tool} en action', '{tool}的使用短片', 'Clip corto de {tool} en uso'],
  'lesson.ui.cardLabel': ['{tool} tip', 'Astuce {tool}', '“{tool}”提示', 'Consejo de {tool}'],
  'lesson.ui.close': ['Close', 'Fermer', '关闭', 'Cerrar'],

  // ── Lessons list ────────────────────────────────────────────────────
  'lesson.list.title': ['Lessons', 'Leçons', '课程', 'Lecciones'],
  'lesson.list.done': ['{done} of {total} done', '{done} sur {total} faites', '已完成 {done}/{total}', '{done} de {total} hechas'],
  'lesson.list.showMe': ['Show me', 'Montrer', '演示', 'Muéstrame'],
  'lesson.list.tips': ['Tips when I pick a tool', 'Astuces quand je choisis un outil', '选择工具时显示提示', 'Consejos al elegir una herramienta'],
  'lesson.list.sounds': ['Quiet sounds', 'Sons discrets', '轻柔音效', 'Sonidos suaves'],
  'lesson.list.ticked': ['Done', 'Faite', '已完成', 'Hecha'],
  'lesson.list.notTicked': ['Not done yet', 'Pas encore faite', '尚未完成', 'Aún no hecha'],
  'lesson.list.houseGuide': ['House build guide', 'Guide de conception maison', '住宅设计指南', 'Guía de diseño de vivienda'],
  'lesson.list.houseGuideLine': ['19 review steps for a whole house.', '19 étapes de revue pour toute une maison.', '整栋房屋的 19 个复核步骤。', '19 pasos de revisión para toda una casa.'],
  'lesson.list.open': ['Open', 'Ouvrir', '打开', 'Abrir'],
  'lesson.list.reset': ['Show every tip again', 'Revoir toutes les astuces', '重新显示所有提示', 'Volver a ver todos los consejos'],
  'lesson.list.storage': ['Ticks are kept on this device only.', 'Les coches restent sur cet appareil.', '勾选记录只保存在本设备。', 'Las marcas se guardan solo en este dispositivo.'],
  'lesson.list.storageOff': ['This browser keeps no ticks: they last until you close the page.', 'Ce navigateur ne garde pas les coches : elles durent jusqu’à la fermeture.', '此浏览器不保存勾选，关闭页面后即消失。', 'Este navegador no guarda las marcas: duran hasta cerrar la página.'],
  'lesson.group.build': ['Build', 'Construire', '建造', 'Construir'],
  'lesson.group.finish': ['Finish', 'Finitions', '饰面', 'Acabados'],
  'lesson.group.furnish': ['Furnish and arrange', 'Meubler et arranger', '布置与摆放', 'Amueblar y ordenar'],
  'lesson.group.look': ['Look around', 'Regarder', '查看', 'Mirar'],

  // ── First-build quest ───────────────────────────────────────────────
  'lesson.quest.title': ['First build', 'Première construction', '第一次建造', 'Primera construcción'],
  'lesson.quest.offer': ['New here? Build your first home in 7 short steps.', 'Nouveau ici ? Construisez votre première maison en 7 petites étapes.', '第一次来？用 7 个小步骤建好你的第一个家。', '¿Eres nuevo? Construye tu primera casa en 7 pasos cortos.'],
  'lesson.quest.start': ['Start', 'Commencer', '开始', 'Empezar'],
  'lesson.quest.notNow': ['Not now', 'Plus tard', '以后再说', 'Ahora no'],
  'lesson.quest.continue': ['Continue', 'Continuer', '继续', 'Continuar'],
  'lesson.quest.again': ['Start again', 'Recommencer', '重新开始', 'Empezar de nuevo'],
  'lesson.quest.progress': ['{done} of {total}', '{done} sur {total}', '{done}/{total}', '{done} de {total}'],
  'lesson.quest.showMe': ['Show me', 'Montrer', '演示', 'Muéstrame'],
  'lesson.quest.hide': ['Hide', 'Réduire', '收起', 'Ocultar'],
  'lesson.quest.skip': ['Skip', 'Passer', '跳过', 'Omitir'],
  'lesson.quest.open': ['Open first build, {done} of {total} done', 'Ouvrir la première construction, {done} sur {total}', '打开第一次建造，已完成 {done}/{total}', 'Abrir primera construcción, {done} de {total}'],
  'lesson.quest.next': ['Next', 'Suivant', '下一步', 'Siguiente'],
  'lesson.quest.room': ['Build a room', 'Construire une pièce', '建一个房间', 'Construye una habitación'],
  'lesson.quest.openings': ['Add a door and a window', 'Ajouter une porte et une fenêtre', '加一扇门和一扇窗', 'Añade una puerta y una ventana'],
  'lesson.quest.paint': ['Paint a wall', 'Peindre un mur', '粉刷一面墙', 'Pinta una pared'],
  'lesson.quest.floor': ['Lay a floor', 'Poser un sol', '铺一块地面', 'Pon un suelo'],
  'lesson.quest.products': ['Place three products', 'Placer trois produits', '摆放三件产品', 'Coloca tres productos'],
  'lesson.quest.view3d': ['Look at it in 3D', 'La voir en 3D', '用 3D 查看', 'Mírala en 3D'],
  'lesson.quest.walk': ['Walk through it', 'La parcourir à pied', '走进去看看', 'Recórrela a pie'],
  'lesson.quest.count': ['{count} of {target}', '{count} sur {target}', '{count}/{target}', '{count} de {target}'],
  'lesson.quest.stepDone': ['Done: {step}', 'Fait : {step}', '完成：{step}', 'Hecho: {step}'],
  'lesson.quest.allDone': ['First build done!', 'Première construction terminée !', '第一次建造完成！', '¡Primera construcción terminada!'],
  'lesson.quest.allDoneLine': ['You built it, finished it, furnished it and walked through it.', 'Vous l’avez construite, finie, meublée et parcourue.', '你建好了它、装修了它、布置了它，还走了一遍。', 'La construiste, la acabaste, la amueblaste y la recorriste.'],

  // ── Loading tips ────────────────────────────────────────────────────
  'lesson.tip.esc': ['Esc puts any tool away.', 'Échap range n’importe quel outil.', 'Esc 可收起任何工具。', 'Esc guarda cualquier herramienta.'],
  'lesson.tip.floorShift': ['With Floor, Shift fills the whole room.', 'Avec Sol, Maj remplit toute la pièce.', '使用地面工具时，Shift 可填满整间。', 'Con Suelo, Mayús llena toda la habitación.'],
  'lesson.tip.undo': ['Ctrl+Z undoes your last step.', 'Ctrl+Z annule votre dernière action.', 'Ctrl+Z 撤销上一步。', 'Ctrl+Z deshace tu último paso.'],
  'lesson.tip.rotate': ['Press R to turn the object you picked.', 'Appuyez sur R pour tourner l’objet choisi.', '按 R 可旋转选中的物品。', 'Pulsa R para girar el objeto elegido.'],
  'lesson.tip.measure': ['Measure (M) sets a wall to an exact length.', 'Mesurer (M) donne à un mur une longueur exacte.', '测量（M）可把墙设为精确长度。', 'Medir (M) da a una pared una longitud exacta.'],
  'lesson.tip.paintRoom': ['Wall paint: Room paints every wall at once.', 'Peinture murale : Pièce peint tous les murs d’un coup.', '墙面涂料：“房间”可一次粉刷所有墙。', 'Pintura: Habitación pinta todas las paredes a la vez.'],
  'lesson.tip.walkDoors': ['In Walk, E opens doors.', 'En visite, E ouvre les portes.', '漫游时按 E 开门。', 'En el paseo, E abre puertas.'],
  'lesson.tip.lessons': ['The ? button lists every lesson.', 'Le bouton ? liste toutes les leçons.', '“?”按钮列出全部课程。', 'El botón ? muestra todas las lecciones.'],
  'lesson.tip.hold': ['On a phone, press and hold a tool to see its name.', 'Sur téléphone, appuyez longuement sur un outil pour voir son nom.', '在手机上，长按工具可查看名称。', 'En el móvil, mantén pulsada una herramienta para ver su nombre.'],

  // ── The lessons, one block each ─────────────────────────────────────
  'lesson.select.name': ['Select', 'Sélection', '选择', 'Seleccionar'],
  'lesson.select.line': ['Pick up, move, turn or delete what you placed.', 'Prenez, déplacez, tournez ou supprimez ce que vous avez placé.', '拿起、移动、旋转或删除你放置的物品。', 'Toma, mueve, gira o borra lo que colocaste.'],
  'lesson.select.s1': ['Click an object to pick it.', 'Cliquez sur un objet pour le prendre.', '点击物品即可选中。', 'Haz clic en un objeto para tomarlo.'],
  'lesson.select.s1t': ['Tap an object to pick it.', 'Touchez un objet pour le prendre.', '轻点物品即可选中。', 'Toca un objeto para tomarlo.'],
  'lesson.select.s2': ['Drag it to move it.', 'Faites-le glisser pour le déplacer.', '拖动即可移动。', 'Arrástralo para moverlo.'],
  'lesson.select.s3': ['The buttons beside it turn, copy or delete it.', 'Les boutons à côté le tournent, le copient ou le suppriment.', '旁边的按钮可旋转、复制或删除。', 'Los botones de al lado lo giran, copian o borran.'],
  'lesson.select.keys': ['H picks Select · Esc lets go', 'H choisit Sélection · Échap relâche', 'H 切换到选择 · Esc 取消选中', 'H elige Seleccionar · Esc suelta'],

  'lesson.walls.name': ['Walls', 'Murs', '墙', 'Paredes'],
  'lesson.walls.line': ['Draw walls corner by corner. Close the shape to make a room.', 'Tracez les murs coin par coin. Fermez la forme pour faire une pièce.', '一个角一个角地画墙。闭合形状即成房间。', 'Dibuja las paredes esquina a esquina. Cierra la forma para hacer una habitación.'],
  'lesson.walls.s1': ['Click to drop a corner.', 'Cliquez pour poser un coin.', '点击放下一个角。', 'Haz clic para poner una esquina.'],
  'lesson.walls.s1t': ['Tap to drop a corner.', 'Touchez pour poser un coin.', '轻点放下一个角。', 'Toca para poner una esquina.'],
  'lesson.walls.s2': ['Or drag to draw a straight wall.', 'Ou faites glisser pour tracer un mur droit.', '也可以拖动画出一段直墙。', 'O arrastra para dibujar una pared recta.'],
  'lesson.walls.s3': ['Click the first corner to close the room.', 'Cliquez sur le premier coin pour fermer la pièce.', '点击第一个角即可闭合房间。', 'Haz clic en la primera esquina para cerrar la habitación.'],
  'lesson.walls.s3t': ['Tap the first corner to close the room.', 'Touchez le premier coin pour fermer la pièce.', '轻点第一个角即可闭合房间。', 'Toca la primera esquina para cerrar la habitación.'],
  'lesson.walls.keys': ['Enter closes · Esc stops · + and − change the step', 'Entrée ferme · Échap arrête · + et − changent le pas', 'Enter 闭合 · Esc 停止 · + 和 − 改变步长', 'Intro cierra · Esc para · + y − cambian el paso'],

  'lesson.room.name': ['Room', 'Pièce', '房间', 'Habitación'],
  'lesson.room.line': ['Make a box room at an exact size.', 'Faites une pièce rectangulaire à la taille exacte.', '按精确尺寸建一个方形房间。', 'Haz una habitación rectangular a medida exacta.'],
  'lesson.room.s1': ['Pick Room, then type the length and width.', 'Choisissez Pièce, puis tapez la longueur et la largeur.', '选择“房间”，再输入长度和宽度。', 'Elige Habitación y escribe el largo y el ancho.'],
  'lesson.room.s2': ['Or use the 5 × 4 m room button.', 'Ou utilisez le bouton pièce 5 × 4 m.', '也可以用“5 × 4 m 房间”按钮。', 'O usa el botón de habitación de 5 × 4 m.'],
  'lesson.room.s3': ['In 3D, drag from corner to corner.', 'En 3D, faites glisser d’un coin à l’autre.', '在 3D 中，从一个角拖到对角。', 'En 3D, arrastra de esquina a esquina.'],

  'lesson.door.name': ['Doors and windows', 'Portes et fenêtres', '门和窗', 'Puertas y ventanas'],
  'lesson.door.line': ['Cut a door, doorway or window into a wall.', 'Percez une porte, un passage ou une fenêtre dans un mur.', '在墙上开门、门洞或窗。', 'Abre una puerta, un paso o una ventana en una pared.'],
  'lesson.door.s1': ['Choose Door, Doorway or Window.', 'Choisissez Porte, Passage ou Fenêtre.', '选择门、门洞或窗。', 'Elige Puerta, Paso o Ventana.'],
  'lesson.door.s2': ['Move along a wall, then click to place it.', 'Longez un mur, puis cliquez pour la placer.', '沿墙移动，然后点击放置。', 'Recorre una pared y haz clic para colocarla.'],
  'lesson.door.s2t': ['Tap a wall to place it.', 'Touchez un mur pour la placer.', '轻点墙面即可放置。', 'Toca una pared para colocarla.'],
  'lesson.door.s3': ['Click a placed one to change or remove it.', 'Cliquez sur une ouverture posée pour la modifier ou l’enlever.', '点击已放置的开口可修改或删除。', 'Haz clic en una ya puesta para cambiarla o quitarla.'],
  'lesson.door.s3t': ['Tap a placed one to change or remove it.', 'Touchez une ouverture posée pour la modifier ou l’enlever.', '轻点已放置的开口可修改或删除。', 'Toca una ya puesta para cambiarla o quitarla.'],
  'lesson.door.keys': ['F flips the side · H swaps the hinge', 'F change le côté · H inverse les gonds', 'F 翻转开向 · H 更换铰链边', 'F cambia el lado · H cambia la bisagra'],

  'lesson.stairs.name': ['Stairs', 'Escalier', '楼梯', 'Escalera'],
  'lesson.stairs.line': ['Join two floors with a stair.', 'Reliez deux étages par un escalier.', '用楼梯连接两层楼。', 'Une dos plantas con una escalera.'],
  'lesson.stairs.s1': ['Add a floor above first.', 'Ajoutez d’abord un étage au-dessus.', '先在上方加一层。', 'Primero añade una planta encima.'],
  'lesson.stairs.s2': ['Pick Stairs, then click the floor to place them.', 'Choisissez Escalier, puis cliquez sur le sol pour le placer.', '选择楼梯，然后点击地面放置。', 'Elige Escalera y haz clic en el suelo para colocarla.'],
  'lesson.stairs.s2t': ['Pick Stairs, then tap the floor to place them.', 'Choisissez Escalier, puis touchez le sol pour le placer.', '选择楼梯，然后轻点地面放置。', 'Elige Escalera y toca el suelo para colocarla.'],
  'lesson.stairs.s3': ['The stair goes up to the next floor.', 'L’escalier monte à l’étage suivant.', '楼梯通向上一层。', 'La escalera sube a la siguiente planta.'],

  'lesson.floor.name': ['Floor', 'Sol', '地面', 'Suelo'],
  'lesson.floor.line': ['Lay a floor, tile by tile or the whole room.', 'Posez un sol, carreau par carreau ou toute la pièce.', '逐块或整间铺设地面。', 'Pon un suelo, baldosa a baldosa o toda la habitación.'],
  'lesson.floor.s1': ['Pick a material.', 'Choisissez un matériau.', '选择一种材料。', 'Elige un material.'],
  'lesson.floor.s2': ['Click a tile, or drag over an area.', 'Cliquez sur un carreau ou faites glisser sur une zone.', '点击一块地砖，或拖过一片区域。', 'Haz clic en una baldosa o arrastra sobre una zona.'],
  'lesson.floor.s2t': ['Tap a tile, or drag over an area.', 'Touchez un carreau ou faites glisser sur une zone.', '轻点一块地砖，或拖过一片区域。', 'Toca una baldosa o arrastra sobre una zona.'],
  'lesson.floor.s3': ['Room covers the whole room.', 'Pièce couvre toute la pièce.', '“房间”铺满整间。', 'Habitación cubre toda la habitación.'],
  'lesson.floor.s3t': ['Fill room covers the whole room.', 'Remplir la pièce couvre toute la pièce.', '“填满房间”铺满整间。', 'Llenar habitación cubre toda la habitación.'],
  'lesson.floor.keys': ['Shift fills the room · Ctrl erases', 'Maj remplit la pièce · Ctrl efface', 'Shift 填满房间 · Ctrl 擦除', 'Mayús llena la habitación · Ctrl borra'],

  'lesson.wallpaint.name': ['Wall paint', 'Peinture murale', '墙面涂料', 'Pintura de pared'],
  'lesson.wallpaint.line': ['Paint one wall, or every wall of a room.', 'Peignez un mur, ou tous les murs d’une pièce.', '粉刷一面墙，或一间房的所有墙。', 'Pinta una pared o todas las de una habitación.'],
  'lesson.wallpaint.s1': ['Pick a paint and a colour.', 'Choisissez une peinture et une couleur.', '选择涂料和颜色。', 'Elige una pintura y un color.'],
  'lesson.wallpaint.s2': ['Click a wall to paint it.', 'Cliquez sur un mur pour le peindre.', '点击墙面即可粉刷。', 'Haz clic en una pared para pintarla.'],
  'lesson.wallpaint.s2t': ['Tap a wall to paint it.', 'Touchez un mur pour le peindre.', '轻点墙面即可粉刷。', 'Toca una pared para pintarla.'],
  'lesson.wallpaint.s3': ['Room paints every wall of that room.', 'Pièce peint tous les murs de la pièce.', '“房间”会粉刷该房间的所有墙。', 'Habitación pinta todas sus paredes.'],

  'lesson.cladding.name': ['Cladding', 'Bardage', '墙面覆层', 'Revestimiento'],
  'lesson.cladding.line': ['Cover a wall with sample boards.', 'Couvrez un mur de planches d’exemple.', '用示例板材覆盖墙面。', 'Cubre una pared con tablas de muestra.'],
  'lesson.cladding.s1': ['Pick a sample board.', 'Choisissez une planche d’exemple.', '选择一种示例板材。', 'Elige una tabla de muestra.'],
  'lesson.cladding.s2': ['Click a wall to clad it.', 'Cliquez sur un mur pour le couvrir.', '点击墙面即可覆层。', 'Haz clic en una pared para revestirla.'],
  'lesson.cladding.s2t': ['Tap a wall to clad it.', 'Touchez un mur pour le couvrir.', '轻点墙面即可覆层。', 'Toca una pared para revestirla.'],
  'lesson.cladding.s3': ['Room clads every wall of that room.', 'Pièce couvre tous les murs de la pièce.', '“房间”会覆盖该房间的所有墙。', 'Habitación reviste todas sus paredes.'],

  'lesson.measure.name': ['Measure', 'Mesurer', '测量', 'Medir'],
  'lesson.measure.line': ['Set a wall to an exact length.', 'Donnez à un mur une longueur exacte.', '把墙设为精确长度。', 'Da a una pared una longitud exacta.'],
  'lesson.measure.s1': ['Click a wall.', 'Cliquez sur un mur.', '点击一面墙。', 'Haz clic en una pared.'],
  'lesson.measure.s1t': ['Tap a wall.', 'Touchez un mur.', '轻点一面墙。', 'Toca una pared.'],
  'lesson.measure.s2': ['Type the length you want.', 'Tapez la longueur voulue.', '输入想要的长度。', 'Escribe la longitud que quieres.'],
  'lesson.measure.s3': ['Press Enter or Apply.', 'Appuyez sur Entrée ou Appliquer.', '按 Enter 或“应用”。', 'Pulsa Intro o Aplicar.'],
  'lesson.measure.keys': ['M', 'M', 'M', 'M'],

  'lesson.remove.name': ['Remove', 'Retirer', '移除', 'Quitar'],
  'lesson.remove.line': ['Take away a wall, door, floor or object.', 'Enlevez un mur, une porte, un sol ou un objet.', '移除墙、门、地面或物品。', 'Quita una pared, puerta, suelo u objeto.'],
  'lesson.remove.s1': ['Point at it: it turns red.', 'Pointez-le : il devient rouge.', '指向它，它会变红。', 'Señálalo: se pone rojo.'],
  'lesson.remove.s1t': ['Tap the wall or object to remove.', 'Touchez le mur ou l’objet à enlever.', '轻点要移除的墙或物品。', 'Toca la pared u objeto que quieres quitar.'],
  'lesson.remove.s2': ['Click to remove it. Undo brings it back.', 'Cliquez pour l’enlever. Annuler le remet.', '点击移除，撤销即可恢复。', 'Haz clic para quitarlo. Deshacer lo devuelve.'],
  'lesson.remove.s2t': ['Undo brings it back.', 'Annuler le remet.', '撤销即可恢复。', 'Deshacer lo devuelve.'],
  'lesson.remove.s3': ['Esc or Done stops removing.', 'Échap ou Terminé arrête.', 'Esc 或“完成”停止移除。', 'Esc o Hecho deja de quitar.'],
  'lesson.remove.keys': ['J · Ctrl+Z undoes', 'J · Ctrl+Z annule', 'J · Ctrl+Z 撤销', 'J · Ctrl+Z deshace'],

  'lesson.eyedropper.name': ['Copy', 'Copier', '复制', 'Copiar'],
  'lesson.eyedropper.line': ['Copy an object you placed, then place more of it.', 'Copiez un objet placé, puis placez-en d’autres.', '复制已放置的物品，再多放几个。', 'Copia un objeto colocado y coloca más.'],
  'lesson.eyedropper.s1': ['Press E.', 'Appuyez sur E.', '按 E。', 'Pulsa E.'],
  'lesson.eyedropper.s2': ['Click an object to copy it.', 'Cliquez sur un objet pour le copier.', '点击物品进行复制。', 'Haz clic en un objeto para copiarlo.'],
  'lesson.eyedropper.s3': ['Click the floor to place the copy.', 'Cliquez sur le sol pour placer la copie.', '点击地面放置副本。', 'Haz clic en el suelo para colocar la copia.'],
  'lesson.eyedropper.keys': ['E', 'E', 'E', 'E'],

  'lesson.item.name': ['Your object', 'Votre objet', '你的物品', 'Tu objeto'],
  'lesson.item.line': ['Turn, copy, light or delete the object you picked.', 'Tournez, copiez, allumez ou supprimez l’objet choisi.', '旋转、复制、开灯或删除选中的物品。', 'Gira, copia, enciende o borra el objeto elegido.'],
  'lesson.item.s1': ['R turns it 45°.', 'R le tourne de 45°.', 'R 旋转 45°。', 'R lo gira 45°.'],
  'lesson.item.s1t': ['Rotate turns it 45°.', 'Pivoter le tourne de 45°.', '“旋转”可转 45°。', 'Girar lo gira 45°.'],
  'lesson.item.s2': ['D makes a copy. L switches a lamp.', 'D fait une copie. L allume une lampe.', 'D 复制。L 开关灯。', 'D hace una copia. L enciende una lámpara.'],
  'lesson.item.s2t': ['Duplicate makes a copy.', 'Dupliquer fait une copie.', '“复制”可生成副本。', 'Duplicar hace una copia.'],
  'lesson.item.s3': ['Del removes it. Esc lets go.', 'Suppr l’enlève. Échap le relâche.', 'Del 删除。Esc 取消选中。', 'Supr lo quita. Esc lo suelta.'],
  'lesson.item.s3t': ['Delete removes it.', 'Supprimer l’enlève.', '“删除”将其移除。', 'Borrar lo quita.'],
  'lesson.item.keys': ['R · D · L · Del', 'R · D · L · Suppr', 'R · D · L · Del', 'R · D · L · Supr'],

  'lesson.furnish.name': ['Furnish', 'Meubler', '布置', 'Amueblar'],
  'lesson.furnish.line': ['Add products: furniture, gym kit, lights and more.', 'Ajoutez des produits : meubles, matériel de sport, lampes et plus.', '添加产品：家具、健身器材、灯具等。', 'Añade productos: muebles, equipo de gimnasio, luces y más.'],
  'lesson.furnish.s1': ['Pick a category, or search.', 'Choisissez une catégorie, ou cherchez.', '选择分类，或搜索。', 'Elige una categoría o busca.'],
  'lesson.furnish.s2': ['Drag a product onto the floor.', 'Faites glisser un produit sur le sol.', '把产品拖到地面上。', 'Arrastra un producto al suelo.'],
  'lesson.furnish.s2t': ['Tap a product, then tap the floor.', 'Touchez un produit, puis le sol.', '轻点产品，再轻点地面。', 'Toca un producto y luego el suelo.'],
  'lesson.furnish.s3': ['It sits flush to walls and corners.', 'Il se cale contre les murs et dans les coins.', '它会贴墙、靠角摆放。', 'Se ajusta a paredes y esquinas.'],

  'lesson.view3d.name': ['3D House', 'Maison 3D', '3D 房屋', 'Casa 3D'],
  'lesson.view3d.line': ['See your design in 3D, at real size.', 'Voyez votre projet en 3D, à taille réelle.', '以真实尺寸在 3D 中查看设计。', 'Ve tu diseño en 3D, a tamaño real.'],
  'lesson.view3d.s1': ['Drag to turn around the house.', 'Faites glisser pour tourner autour.', '拖动即可绕房屋旋转。', 'Arrastra para girar alrededor.'],
  'lesson.view3d.s1t': ['Drag with one finger to turn around.', 'Glissez d’un doigt pour tourner autour.', '单指拖动即可旋转。', 'Arrastra con un dedo para girar.'],
  'lesson.view3d.s2': ['Scroll to zoom. Shift-drag to move.', 'Molette pour zoomer. Maj-glisser pour déplacer.', '滚轮缩放。按住 Shift 拖动可平移。', 'Rueda para zoom. Mayús y arrastra para mover.'],
  'lesson.view3d.s2t': ['Pinch to zoom. Two fingers move the view.', 'Pincez pour zoomer. Deux doigts déplacent la vue.', '双指捏合缩放，双指拖动移动视图。', 'Pellizca para zoom. Dos dedos mueven la vista.'],
  'lesson.view3d.s3': ['2D Plan takes you back.', 'Plan 2D vous ramène.', '“2D 平面图”可返回。', 'Plano 2D te devuelve.'],

  'lesson.walk.name': ['Walk', 'Visite', '漫游', 'Paseo'],
  'lesson.walk.line': ['Walk through your home as a person.', 'Parcourez votre maison comme un visiteur.', '以人的视角走进你的家。', 'Recorre tu casa como una persona.'],
  'lesson.walk.s1': ['Pick a person, then Start walk.', 'Choisissez un personnage, puis Start walk.', '选择一个人物，再点 Start walk。', 'Elige un personaje y luego Start walk.'],
  'lesson.walk.s2': ['WASD or the arrows move. The mouse looks.', 'WASD ou les flèches pour bouger. La souris regarde.', 'WASD 或方向键移动，鼠标看向四周。', 'WASD o las flechas para moverte. El ratón mira.'],
  'lesson.walk.s2t': ['The pad moves you. Drag to look.', 'Le pavé vous déplace. Glissez pour regarder.', '摇杆移动，拖动看向四周。', 'El mando te mueve. Arrastra para mirar.'],
  'lesson.walk.s3': ['E opens doors. Esc leaves.', 'E ouvre les portes. Échap pour sortir.', 'E 开门，Esc 退出。', 'E abre puertas. Esc para salir.'],
  'lesson.walk.s3t': ['Tap a door button to open it.', 'Touchez le bouton d’une porte pour l’ouvrir.', '轻点门按钮即可开门。', 'Toca el botón de una puerta para abrirla.'],
  'lesson.walk.keys': ['WASD · E · Esc', 'WASD · E · Échap', 'WASD · E · Esc', 'WASD · E · Esc'],

  'lesson.garden.name': ['Garden', 'Jardin', '花园', 'Jardín'],
  'lesson.garden.line': ['Lay lawn, paths, a pool and fences outside.', 'Posez gazon, allées, piscine et clôtures dehors.', '在室外铺草坪、小路、泳池和围栏。', 'Pon césped, caminos, piscina y vallas fuera.'],
  'lesson.garden.s1': ['Pick a surface or a fence.', 'Choisissez une surface ou une clôture.', '选择一种地面或围栏。', 'Elige una superficie o una valla.'],
  'lesson.garden.s2': ['Drag two corners to draw it.', 'Faites glisser deux coins pour la tracer.', '拖出两个角即可绘制。', 'Arrastra dos esquinas para dibujarla.'],
  'lesson.garden.s3': ['Nothing is added until you let go.', 'Rien n’est ajouté avant de relâcher.', '松开之前不会添加任何东西。', 'No se añade nada hasta que sueltas.'],
} as const satisfies Record<string, readonly [string, string, string, string]>;

export type LessonTextKey = keyof typeof lessonRows;
export type LessonTextValues = Readonly<Record<string, string | number>>;

/** Same rules as `translate` in messages.ts: the locale's column, else English, then {name} fills. */
export function lessonText(locale: AppLocale, key: LessonTextKey, values: LessonTextValues = {}): string {
  const row = lessonRows[key];
  const pattern = row?.[LOCALES.indexOf(locale)] || row?.[0] || key;
  return pattern.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  );
}
