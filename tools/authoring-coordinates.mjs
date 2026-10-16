import { PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';

/** Read-only DOM state: usable against the built preview, without dev imports. */
export async function planPoint(page, x, y) {
  const host=page.getByTestId('plan-drawing-viewport'), rect=await host.boundingBox();
  const {viewport,pxPerMetre}=JSON.parse(await host.getAttribute('data-view-transform'));
  return {x:rect.x+viewport.x+x*pxPerMetre*viewport.scale,y:rect.y+viewport.y+y*pxPerMetre*viewport.scale};
}
export async function houseCamera(page) {
  return JSON.parse(await page.getByTestId('wallpaint-3d-canvas').getAttribute('data-camera'));
}
export async function housePoint(page,x,y,z=0) {
  const host=page.getByTestId('wallpaint-3d-canvas'), rect=await host.boundingBox();
  const state=JSON.parse(await host.getAttribute('data-render-camera'));
  const aspect=rect.width/rect.height;
  const half=state.distanceM*Math.tan(state.fovRad/2);
  const camera=await host.getAttribute('data-projection')==='orthographic'
    ? new OrthographicCamera(-half*aspect,half*aspect,half,-half,.05,250)
    : new PerspectiveCamera(state.fovRad*180/Math.PI,aspect,.05,250);
  const c=Math.cos(state.elevationRad),t=state.target;
  camera.position.set(t.x+state.distanceM*c*Math.sin(state.azimuthRad),t.z+state.distanceM*Math.sin(state.elevationRad),t.y+state.distanceM*c*Math.cos(state.azimuthRad));
  camera.up.set(0,1,0);camera.lookAt(t.x,t.z,t.y);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const p=new Vector3(x,z,y).project(camera);
  return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2};
}
