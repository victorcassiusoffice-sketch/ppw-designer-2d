/** Attached objects follow a preview without changing their saved placement. */
export function attachedDescendantIds(items: readonly {instanceId:string;parentInstanceId?:string}[], parentId:string): string[] {
  const seen = new Set([parentId]), queue = [parentId], result:string[] = [];
  for (let index=0; index<queue.length; index++) for (const item of items) {
    if (item.parentInstanceId === queue[index] && !seen.has(item.instanceId)) {
      seen.add(item.instanceId);queue.push(item.instanceId);result.push(item.instanceId);
    }
  }
  return result;
}
export function attachedPreviewPosition(
  point:{x:number;y:number}, parent:{x:number;y:number}, delta:{x:number;y:number}, rotationDeltaDeg:number,
): {x:number;y:number} {
  const angle=rotationDeltaDeg*Math.PI/180, x=point.x-parent.x, y=point.y-parent.y;
  return {x:parent.x+delta.x+x*Math.cos(angle)-y*Math.sin(angle),y:parent.y+delta.y+x*Math.sin(angle)+y*Math.cos(angle)};
}
