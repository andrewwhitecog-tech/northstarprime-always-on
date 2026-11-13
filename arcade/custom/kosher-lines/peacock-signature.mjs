// Original gameplay interpretation of the Brian Peacock / switch-back-3 kiosk lyric.
// This is not a claim that Brian invented a trick called Peacock.
export const PEACOCK_TRICK=Object.freeze({id:'switch-bs360',name:'Peacock · Switch backside 360',duration:.82,points:650,flip:0,spin:1,bodySpin:1,requiredStance:1});
export const PEACOCK_KIOSK=Object.freeze({x:13,z:6.5,radius:3.75});
export const PEACOCK_KIOSK_COLLIDER=Object.freeze({x:13,z:9.4,w:.8,d:.65,h:1.6});
export function isPeacockKioskLanding(e){return e?.id===PEACOCK_TRICK.id&&e.stance===1&&Number.isFinite(e.x)&&Number.isFinite(e.z)&&Math.hypot(e.x-PEACOCK_KIOSK.x,e.z-PEACOCK_KIOSK.z)<=PEACOCK_KIOSK.radius;}
