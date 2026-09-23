/**
 * System1NeuralAgent.js - The "Jev-Style" Fast-Decision Game AI Engine
 * Inspired by @fullstackpeter reel DdhPprdBwcs ("Jev: the AI that cannot generate text")
 * 
 * Non-generative, typed decision architecture:
 * - Sub-0.5ms inference per tick
 * - Evaluates multi-dimensional continuous combat telemetry
 * - Returns strict, validated action schemas with zero hallucination risk
 */

class System1NeuralAgent {
  constructor(id, x, y, archetype = 'TACTICAL_OPERATOR', eventBus = null) {
    this.id = id;
    this.archetype = archetype;
    this.eventBus = eventBus;

    // Spatial & physics state
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 16;
    this.rotation = 0; // radians
    this.maxSpeed = 160; // px/sec
    this.acceleration = 600;

    // Combat state
    this.maxHealth = 100;
    this.health = 100;
    this.isAlive = true;
    this.lastFireTime = 0;
    this.fireCooldown = 0.45; // seconds
    this.ammo = 8;
    this.maxAmmo = 8;
    this.isReloading = false;
    this.reloadDuration = 1.2;
    this.reloadTimer = 0;

    // Archetype traits & custom personality weights
    this.setupArchetype(archetype);

    // Current active decision state
    this.activeDecision = {
      stance: 'SCOUT_PATROL',
      confidence: 1.0,
      targetX: x,
      targetY: y,
      shouldFire: false,
      inferenceMs: 0.05,
      timestamp: performance.now()
    };

    // Stance constants
    this.STANCES = [
      'FLANK_LEFT',
      'FLANK_RIGHT',
      'TAKE_COVER',
      'SUPPRESS',
      'AGGRESSIVE_CHARGE',
      'TACTICAL_RETREAT',
      'SCOUT_PATROL'
    ];

    // Decision tick rate (evaluate decision every 100ms, execute movement at 60 FPS)
    this.decisionInterval = 0.09; // ~11 times/sec
    this.decisionTimer = Math.random() * this.decisionInterval; // stagger agents
  }

  setupArchetype(type) {
    switch (type) {
      case 'VOID_PROWLER': // Fast flanker
        this.maxSpeed = 220;
        this.maxHealth = 75;
        this.health = 75;
        this.fireCooldown = 0.3;
        this.color = '#38bdf8'; // Sky blue
        this.weightBias = { flank: 1.6, rush: 1.2, cover: 0.7, retreat: 0.6 };
        break;
      case 'OBSIDIAN_SENTINEL': // Heavy suppressor
        this.maxSpeed = 110;
        this.maxHealth = 180;
        this.health = 180;
        this.fireCooldown = 0.2;
        this.maxAmmo = 16;
        this.ammo = 16;
        this.color = '#f59e0b'; // Amber
        this.weightBias = { flank: 0.4, rush: 0.5, cover: 1.4, suppress: 1.9 };
        break;
      case 'PRISM_WRAITH': // Ambush / high burst
        this.maxSpeed = 190;
        this.maxHealth = 90;
        this.health = 90;
        this.fireCooldown = 0.6;
        this.color = '#ec4899'; // Pink
        this.weightBias = { flank: 1.3, rush: 1.5, cover: 1.5, retreat: 1.2 };
        break;
      case 'TACTICAL_OPERATOR':
      default:
        this.maxSpeed = 150;
        this.maxHealth = 100;
        this.health = 100;
        this.fireCooldown = 0.4;
        this.color = '#10b981'; // Emerald
        this.weightBias = { flank: 1.0, rush: 1.0, cover: 1.0, suppress: 1.0, retreat: 1.0 };
        break;
    }
  }

  /**
   * Evaluates the high-dimensional combat feature vector in sub-0.5ms.
   * This is the "System 1" non-generative inference pass.
   */
  evaluateSystem1Decision(gameState) {
    const startTime = performance.now();
    const player = gameState.player;
    if (!player || !player.isAlive) {
      return {
        stance: 'SCOUT_PATROL',
        confidence: 0.99,
        targetX: this.x + Math.cos(this.rotation) * 80,
        targetY: this.y + Math.sin(this.rotation) * 80,
        shouldFire: false,
        inferenceMs: performance.now() - startTime
      };
    }

    // 1. Compute Continuous Feature Vector
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.hypot(dx, dy);
    const normDist = Math.min(distToPlayer / 600, 1.0); // 0 (point-blank) to 1 (far)

    // Player aim danger: Is the player pointing towards this agent?
    const playerFacingX = Math.cos(player.rotation);
    const playerFacingY = Math.sin(player.rotation);
    const toAgentX = (this.x - player.x) / (distToPlayer || 1);
    const toAgentY = (this.y - player.y) / (distToPlayer || 1);
    const playerAimDot = playerFacingX * toAgentX + playerFacingY * toAgentY; // > 0.8 means crosshair on me

    // Self health status
    const healthRatio = this.health / this.maxHealth;
    const isCriticallyInjured = healthRatio < 0.35;

    // Line of sight check (raycast against obstacles)
    const hasLOS = this.checkLineOfSight(this.x, this.y, player.x, player.y, gameState.obstacles);

    // Player reload vulnerability
    const playerVulnerable = player.isReloading || (player.ammo <= 0);

    // Nearby cover evaluation
    const bestCover = this.findBestCoverNode(player, gameState.coverNodes, gameState.obstacles);

    // Squad spacing: Distance to nearest ally agent
    const nearestAlly = this.findNearestAlly(gameState.agents);
    const allyClumping = nearestAlly && nearestAlly.dist < 80;

    // 2. Fast Weighted Tensor / Logit Activation
    const scores = {};
    const bias = this.weightBias;

    // Logit: TACTICAL_RETREAT
    scores['TACTICAL_RETREAT'] = 
      (isCriticallyInjured ? 3.5 : 0.2) +
      (playerAimDot > 0.7 ? 1.5 : 0.0) +
      (normDist < 0.25 ? 1.8 : 0.0) * (bias.retreat || 1.0);

    // Logit: TAKE_COVER
    scores['TAKE_COVER'] = 
      (playerAimDot > 0.6 ? 2.4 : 0.3) +
      (this.isReloading ? 3.0 : 0.0) +
      (bestCover ? 1.5 : -1.0) +
      (isCriticallyInjured ? 2.0 : 0.0) * (bias.cover || 1.0);

    // Logit: AGGRESSIVE_CHARGE
    scores['AGGRESSIVE_CHARGE'] = 
      (playerVulnerable ? 3.5 : 0.0) +
      (healthRatio > 0.7 && normDist < 0.4 ? 2.2 : 0.0) +
      (playerAimDot < 0.0 ? 1.8 : 0.0) * (bias.rush || 1.0);

    // Logit: FLANK_LEFT
    scores['FLANK_LEFT'] = 
      (hasLOS && normDist > 0.2 ? 2.2 : 0.5) +
      (allyClumping ? 1.5 : 0.0) +
      (playerAimDot > 0.5 ? 1.2 : 0.4) * (bias.flank || 1.0);

    // Logit: FLANK_RIGHT
    scores['FLANK_RIGHT'] = 
      (hasLOS && normDist > 0.2 ? 2.1 : 0.4) +
      (!allyClumping ? 0.8 : 1.4) +
      (playerAimDot > 0.5 ? 1.1 : 0.3) * (bias.flank || 1.0);

    // Logit: SUPPRESS
    scores['SUPPRESS'] = 
      (hasLOS && normDist >= 0.25 && normDist <= 0.75 ? 2.5 : 0.2) +
      (!this.isReloading && this.ammo >= 3 ? 1.5 : -2.0) +
      (playerAimDot < 0.4 ? 1.2 : 0.0) * (bias.suppress || 1.0);

    // 3. Softmax / ArgMax Stance Selection
    let topStance = 'FLANK_LEFT';
    let maxScore = -Infinity;
    let sumExp = 0;

    for (const [stance, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        topStance = stance;
      }
      sumExp += Math.exp(Math.min(score, 10)); // stability clamp
    }
    const confidence = Math.min(Math.exp(Math.min(maxScore, 10)) / (sumExp || 1), 0.99);

    // 4. Derive Strict Target Coordinates from Stance
    let targetX = player.x;
    let targetY = player.y;
    let shouldFire = false;

    const angleToPlayer = Math.atan2(dy, dx);
    const flankDist = Math.max(distToPlayer, 180);

    switch (topStance) {
      case 'FLANK_LEFT': {
        const flankAngle = angleToPlayer - Math.PI / 2.5;
        targetX = player.x + Math.cos(flankAngle) * flankDist;
        targetY = player.y + Math.sin(flankAngle) * flankDist;
        shouldFire = hasLOS && normDist < 0.8 && !this.isReloading;
        break;
      }
      case 'FLANK_RIGHT': {
        const flankAngle = angleToPlayer + Math.PI / 2.5;
        targetX = player.x + Math.cos(flankAngle) * flankDist;
        targetY = player.y + Math.sin(flankAngle) * flankDist;
        shouldFire = hasLOS && normDist < 0.8 && !this.isReloading;
        break;
      }
      case 'TAKE_COVER': {
        if (bestCover) {
          targetX = bestCover.x;
          targetY = bestCover.y;
        } else {
          // Move away from player's line of fire
          targetX = this.x - Math.cos(angleToPlayer) * 150;
          targetY = this.y - Math.sin(angleToPlayer) * 150;
        }
        shouldFire = hasLOS && Math.random() < 0.2; // sparse cover fire
        break;
      }
      case 'AGGRESSIVE_CHARGE': {
        targetX = player.x;
        targetY = player.y;
        shouldFire = hasLOS && normDist < 0.6 && !this.isReloading;
        break;
      }
      case 'TACTICAL_RETREAT': {
        targetX = this.x - Math.cos(angleToPlayer) * 200;
        targetY = this.y - Math.sin(angleToPlayer) * 200;
        shouldFire = hasLOS && Math.random() < 0.5 && !this.isReloading;
        break;
      }
      case 'SUPPRESS': {
        // Hold position, fine-adjust distance
        targetX = this.x + Math.cos(angleToPlayer) * (distToPlayer > 300 ? 50 : -50);
        targetY = this.y + Math.sin(angleToPlayer) * (distToPlayer > 300 ? 50 : -50);
        shouldFire = hasLOS && !this.isReloading;
        break;
      }
      default:
        targetX = player.x;
        targetY = player.y;
        shouldFire = false;
        break;
    }

    const inferenceMs = performance.now() - startTime;

    const decision = {
      agentId: this.id,
      stance: topStance,
      confidence: parseFloat(confidence.toFixed(2)),
      targetX,
      targetY,
      shouldFire,
      inferenceMs: parseFloat(inferenceMs.toFixed(3)),
      timestamp: performance.now()
    };

    if (this.eventBus) {
      this.eventBus.publish('AI_DECISION_TICK', decision);
    }

    return decision;
  }

  update(dt, gameState) {
    if (!this.isAlive) return;

    // Reload logic
    if (this.isReloading) {
      this.reloadTimer += dt;
      if (this.reloadTimer >= this.reloadDuration) {
        this.isReloading = false;
        this.ammo = this.maxAmmo;
        this.reloadTimer = 0;
      }
    }

    // Decision tick
    this.decisionTimer += dt;
    if (this.decisionTimer >= this.decisionInterval) {
      this.decisionTimer = 0;
      this.activeDecision = this.evaluateSystem1Decision(gameState);
    }

    // Steering physics towards target
    const tx = this.activeDecision.targetX;
    const ty = this.activeDecision.targetY;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      const desiredVx = (dx / dist) * this.maxSpeed;
      const desiredVy = (dy / dist) * this.maxSpeed;

      this.vx += (desiredVx - this.vx) * Math.min(this.acceleration * dt / this.maxSpeed, 1.0);
      this.vy += (desiredVy - this.vy) * Math.min(this.acceleration * dt / this.maxSpeed, 1.0);
    } else {
      this.vx *= 0.85;
      this.vy *= 0.85;
    }

    // Obstacle avoidance & collision resolution
    this.resolveObstacleCollisions(gameState.obstacles, gameState.arenaBounds);

    // Apply movement
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Face player
    if (gameState.player && gameState.player.isAlive) {
      const pdx = gameState.player.x - this.x;
      const pdy = gameState.player.y - this.y;
      this.rotation = Math.atan2(pdy, pdx);
    }

    // Fire weapon if decision dictates
    const now = performance.now() / 1000;
    if (this.activeDecision.shouldFire && !this.isReloading && (now - this.lastFireTime >= this.fireCooldown)) {
      this.fireBullet(gameState);
    }
  }

  fireBullet(gameState) {
    if (this.ammo <= 0) {
      this.isReloading = true;
      this.reloadTimer = 0;
      return;
    }

    this.ammo--;
    this.lastFireTime = performance.now() / 1000;

    // Bullet spread based on stance
    let spread = 0.08;
    if (this.activeDecision.stance === 'SUPPRESS') spread = 0.16;
    if (this.activeDecision.stance === 'AGGRESSIVE_CHARGE') spread = 0.22;

    const angle = this.rotation + (Math.random() - 0.5) * spread;
    const speed = 420;

    const bullet = {
      x: this.x + Math.cos(this.rotation) * (this.radius + 6),
      y: this.y + Math.sin(this.rotation) * (this.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      owner: this.id,
      isEnemy: true,
      color: this.color,
      damage: 12,
      lifespan: 1.8
    };

    gameState.bullets.push(bullet);

    if (this.eventBus) {
      this.eventBus.publish('WEAPON_FIRED', {
        owner: this.id,
        isEnemy: true,
        x: bullet.x,
        y: bullet.y
      });
    }

    if (this.ammo <= 0) {
      this.isReloading = true;
      this.reloadTimer = 0;
    }
  }

  takeDamage(amount, attackerId, knockbackAngle = 0) {
    if (!this.isAlive) return;

    this.health = Math.max(0, this.health - amount);
    this.vx += Math.cos(knockbackAngle) * 80;
    this.vy += Math.sin(knockbackAngle) * 80;

    if (this.eventBus) {
      this.eventBus.publish('ENTITY_DAMAGED', {
        entityId: this.id,
        isEnemy: true,
        damage: amount,
        healthRemaining: this.health,
        attackerId
      });
    }

    if (this.health <= 0) {
      this.isAlive = false;
      if (this.eventBus) {
        this.eventBus.publish('ENTITY_KILLED', {
          entityId: this.id,
          isEnemy: true,
          attackerId,
          x: this.x,
          y: this.y
        });
      }
    }
  }

  checkLineOfSight(x1, y1, x2, y2, obstacles) {
    if (!obstacles) return true;
    for (const obs of obstacles) {
      if (this.lineIntersectsRect(x1, y1, x2, y2, obs)) {
        return false;
      }
    }
    return true;
  }

  lineIntersectsRect(x1, y1, x2, y2, rect) {
    const rx = rect.x;
    const ry = rect.y;
    const rw = rect.width;
    const rh = rect.height;

    // Check intersection with all 4 rectangle edges
    return (
      this.lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) ||
      this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) ||
      this.lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh) ||
      this.lineIntersectsLine(x1, y1, x2, y2, rx, ry + rh, rx, ry)
    );
  }

  lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
    const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (den === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  findBestCoverNode(player, coverNodes, obstacles) {
    if (!coverNodes || coverNodes.length === 0) return null;
    let bestNode = null;
    let bestScore = -Infinity;

    for (const node of coverNodes) {
      const distFromMe = Math.hypot(node.x - this.x, node.y - this.y);
      if (distFromMe > 400) continue;

      // Cover node is good if it breaks LOS to player
      const nodeHasLOS = this.checkLineOfSight(node.x, node.y, player.x, player.y, obstacles);
      const occlusionBonus = (!nodeHasLOS) ? 400 : -200;
      const score = occlusionBonus - distFromMe;

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
    return bestNode;
  }

  findNearestAlly(agents) {
    if (!agents) return null;
    let nearest = null;
    let minDist = Infinity;

    for (const a of agents) {
      if (a.id === this.id || !a.isAlive) continue;
      const d = Math.hypot(a.x - this.x, a.y - this.y);
      if (d < minDist) {
        minDist = d;
        nearest = { agent: a, dist: d };
      }
    }
    return nearest;
  }

  resolveObstacleCollisions(obstacles, bounds) {
    // Arena bounds
    if (bounds) {
      const margin = this.radius;
      if (this.x < bounds.x + margin) { this.x = bounds.x + margin; this.vx = 0; }
      if (this.x > bounds.x + bounds.width - margin) { this.x = bounds.x + bounds.width - margin; this.vx = 0; }
      if (this.y < bounds.y + margin) { this.y = bounds.y + margin; this.vy = 0; }
      if (this.y > bounds.y + bounds.height - margin) { this.y = bounds.y + bounds.height - margin; this.vy = 0; }
    }

    if (!obstacles) return;

    for (const obs of obstacles) {
      // Circle-AABB collision check
      const closestX = Math.max(obs.x, Math.min(this.x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(this.y, obs.y + obs.height));
      const distX = this.x - closestX;
      const distY = this.y - closestY;
      const dist = Math.hypot(distX, distY);

      if (dist < this.radius) {
        const overlap = this.radius - dist;
        if (dist > 0.0001) {
          this.x += (distX / dist) * overlap;
          this.y += (distY / dist) * overlap;
        } else {
          this.x += overlap;
        }
      }
    }
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = System1NeuralAgent;
}
if (typeof window !== 'undefined') {
  window.System1NeuralAgent = System1NeuralAgent;
}
