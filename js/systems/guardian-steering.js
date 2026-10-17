/* Adapted to 2D from Yuka ArriveBehavior (Mugen87 / Yuka authors).
 * Source blob: a51e7c1d388cf8e58d006c9064539bf80a18124c
 * Copyright © 2023 Yuka authors. MIT; full notice: assets/licenses/YUKA-MIT.txt.
 * Path direction, bounded collision steps and catch-up speed are local additions.
 */
G.GuardianSteering = {
  advance(actor, target, maxSpeed, dt, pathDirection) {
    let dx = target.x - actor.x, dy = target.y - actor.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5) { actor._vx = actor._vy = 0; return 0; }
    const speed = Math.min(maxSpeed, distance / .24);
    if (pathDirection) { dx = pathDirection[0] * distance; dy = pathDirection[1] * distance; }
    const blend = Math.min(1, dt * 12);
    actor._vx = (actor._vx || 0) + (dx / distance * speed - (actor._vx || 0)) * blend;
    actor._vy = (actor._vy || 0) + (dy / distance * speed - (actor._vy || 0)) * blend;
    const length = Math.hypot(actor._vx, actor._vy), step = Math.min(distance, length * dt);
    const count = Math.max(1, Math.ceil(step / 4)), x = actor.x, y = actor.y;
    for (let i = 0; i < count && length > 0; i++) {
      actor.x += actor._vx / length * step / count;
      actor.y += actor._vy / length * step / count;
      G.World.collide(actor);
    }
    const moved = Math.hypot(actor.x - x, actor.y - y);
    if (moved > .01) actor.moveAngle = Math.atan2(actor.y - y, actor.x - x);
    return moved;
  }
};
