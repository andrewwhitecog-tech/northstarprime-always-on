/**
 * AIDirector.js - Dynamic Tension & Pacing Engine
 * Left 4 Dead inspired adaptive game director running on real-time player telemetry.
 * 
 * Modulates combat intensity, spawn waves, power-up distributions, and ambient audio
 * to keep the player in the optimal psychological flow channel.
 */

class AIDirector {
  constructor(eventBus, arenaBounds, coverNodes) {
    this.eventBus = eventBus;
    this.arenaBounds = arenaBounds;
    this.coverNodes = coverNodes || [];

    // Director states: BUILD_UP, PEAK_CLIMAX, RESPITE_RECOVERY, SUSTAIN
    this.phase = 'BUILD_UP';
    this.tension = 0.15; // 0.0 to 1.0
    this.targetTension = 0.5;

    // Player telemetry rolling window (last 20 seconds)
    this.playerTelemetry = {
      shotsFired: 0,
      shotsHit: 0,
      damageTaken: 0,
      damageDealt: 0,
      dashesUsed: 0,
      timeSinceLastDamage: 0,
      isNearDeath: false
    };

    // Pacing timers
    this.respiteTimer = 0;
    this.respiteDuration = 8.0; // seconds of rest
    this.peakTimer = 0;
    this.peakDuration = 12.0;

    // Wave spawning knobs
    this.spawnTimer = 0;
    this.spawnInterval = 5.0; // base interval
    this.maxSimultaneousEnemies = 4;
    this.currentWave = 1;
    this.totalKills = 0;

    // Wire up EventBus listeners
    this.setupListeners();
  }

  setupListeners() {
    if (!this.eventBus) return;

    this.eventBus.subscribe('WEAPON_FIRED', (payload) => {
      if (!payload.isEnemy) {
        this.playerTelemetry.shotsFired++;
      }
    });

    this.eventBus.subscribe('ENTITY_DAMAGED', (payload) => {
      if (payload.isEnemy) {
        this.playerTelemetry.shotsHit++;
        this.playerTelemetry.damageDealt += payload.damage;
        // Successful hit raises tension moderately
        this.tension = Math.min(this.tension + 0.02, 1.0);
      } else {
        // Player took damage!
        this.playerTelemetry.damageTaken += payload.damage;
        this.playerTelemetry.timeSinceLastDamage = 0;
        this.tension = Math.min(this.tension + 0.12, 1.0);

        if (payload.healthRemaining <= 25) {
          this.playerTelemetry.isNearDeath = true;
          // Player critically low -> trigger emergency respite to prevent cheap deaths
          if (this.phase !== 'RESPITE_RECOVERY' && Math.random() < 0.6) {
            this.enterRespite("PLAYER_CRITICAL");
          }
        }
      }
    });

    this.eventBus.subscribe('PLAYER_DASH', () => {
      this.playerTelemetry.dashesUsed++;
      this.tension = Math.min(this.tension + 0.04, 1.0);
    });

    this.eventBus.subscribe('ENTITY_KILLED', (payload) => {
      if (payload.isEnemy) {
        this.totalKills++;
        this.tension = Math.min(this.tension + 0.05, 1.0);
      }
    });
  }

  update(dt, gameState) {
    this.playerTelemetry.timeSinceLastDamage += dt;

    // 1. Phase Machine Execution
    switch (this.phase) {
      case 'BUILD_UP':
        this.tension += 0.025 * dt;
        if (this.tension >= 0.75) {
          this.phase = 'PEAK_CLIMAX';
          this.peakTimer = 0;
          this.eventBus?.publish('DIRECTOR_PHASE_CHANGE', { phase: 'PEAK_CLIMAX', tension: this.tension });
        }
        break;

      case 'PEAK_CLIMAX':
        this.peakTimer += dt;
        this.tension = Math.min(0.85 + Math.sin(this.peakTimer * 2) * 0.1, 1.0);
        if (this.peakTimer >= this.peakDuration || gameState.agents.length === 0) {
          this.enterRespite("PEAK_CONCLUDED");
        }
        break;

      case 'RESPITE_RECOVERY':
        this.respiteTimer += dt;
        this.tension = Math.max(0.15, this.tension - 0.1 * dt);
        if (this.respiteTimer >= this.respiteDuration) {
          this.phase = 'BUILD_UP';
          this.currentWave++;
          this.eventBus?.publish('DIRECTOR_PHASE_CHANGE', { phase: 'BUILD_UP', tension: this.tension, wave: this.currentWave });
        }
        break;
    }

    // 2. Wave Reinforcement Spawning
    this.spawnTimer += dt;
    const currentAliveEnemies = gameState.agents.filter(a => a.isAlive).length;

    // Compute dynamic spawn interval based on tension & current enemies
    const effectiveInterval = (this.phase === 'RESPITE_RECOVERY') ? 999.0 : Math.max(2.5, this.spawnInterval - (this.tension * 2.0));

    if (this.spawnTimer >= effectiveInterval && currentAliveEnemies < this.maxSimultaneousEnemies) {
      this.spawnTimer = 0;
      this.spawnReinforcement(gameState);
    }

    // 3. Periodic Broadcast to EventBus (for AudioSynthesizer filter & HUD)
    this.eventBus?.publish('DIRECTOR_TENSION_UPDATE', {
      phase: this.phase,
      tension: parseFloat(this.tension.toFixed(3)),
      wave: this.currentWave,
      aliveEnemies: currentAliveEnemies,
      kills: this.totalKills
    });
  }

  enterRespite(reason) {
    this.phase = 'RESPITE_RECOVERY';
    this.respiteTimer = 0;
    this.respiteDuration = 7.0 + Math.random() * 4.0;
    this.eventBus?.publish('DIRECTOR_PHASE_CHANGE', {
      phase: 'RESPITE_RECOVERY',
      reason,
      duration: this.respiteDuration,
      tension: this.tension
    });

    // Often spawn a health / battery pickup during respite
    this.eventBus?.publish('SPAWN_PICKUP', {
      type: 'MEDKIT_AMMO_CORE',
      x: this.arenaBounds.x + Math.random() * (this.arenaBounds.width - 80) + 40,
      y: this.arenaBounds.y + Math.random() * (this.arenaBounds.height - 80) + 40
    });
  }

  spawnReinforcement(gameState) {
    const player = gameState.player;
    if (!player) return;

    // Pick spawn position that is out of direct player line-of-sight if possible
    let spawnPos = null;
    let attempts = 0;

    while (attempts < 10 && !spawnPos) {
      attempts++;
      const angle = Math.random() * Math.PI * 2;
      const dist = 320 + Math.random() * 200;
      const testX = Math.max(this.arenaBounds.x + 40, Math.min(this.arenaBounds.x + this.arenaBounds.width - 40, player.x + Math.cos(angle) * dist));
      const testY = Math.max(this.arenaBounds.y + 40, Math.min(this.arenaBounds.y + this.arenaBounds.height - 40, player.y + Math.sin(angle) * dist));

      // Check distance from player
      if (Math.hypot(testX - player.x, testY - player.y) > 200) {
        spawnPos = { x: testX, y: testY };
      }
    }

    if (!spawnPos) {
      spawnPos = {
        x: this.arenaBounds.x + 80,
        y: this.arenaBounds.y + 80
      };
    }

    // Choose archetype based on wave and tension
    const archetypes = ['TACTICAL_OPERATOR', 'VOID_PROWLER', 'OBSIDIAN_SENTINEL', 'PRISM_WRAITH'];
    let chosenArchetype = 'TACTICAL_OPERATOR';

    if (this.tension > 0.6) {
      chosenArchetype = (Math.random() < 0.5) ? 'VOID_PROWLER' : 'OBSIDIAN_SENTINEL';
    } else if (this.currentWave >= 3) {
      chosenArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];
    }

    const newId = `BOT_${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const newAgent = new window.System1NeuralAgent(newId, spawnPos.x, spawnPos.y, chosenArchetype, this.eventBus);
    gameState.agents.push(newAgent);

    this.eventBus?.publish('ENEMY_SPAWNED', {
      id: newId,
      archetype: chosenArchetype,
      x: spawnPos.x,
      y: spawnPos.y
    });
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIDirector;
}
if (typeof window !== 'undefined') {
  window.AIDirector = AIDirector;
}
