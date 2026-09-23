/**
 * DiegeticTerminal.js - In-Game CRT Hacking Console
 * Inspired by the Enter the Matrix DOS Computer Easter Egg (Saved IG reel DdbWN9WzGO-)
 * 
 * Provides an authentic retro cyber-terminal overlay with real-time system introspection,
 * AI tensor diagnostics, AI Director manipulation, and barcode synthesis.
 */

class DiegeticTerminal {
  constructor(eventBus, gameState, director, barcodeScanner) {
    this.eventBus = eventBus;
    this.gameState = gameState;
    this.director = director;
    this.barcodeScanner = barcodeScanner;

    this.isOpen = false;
    this.history = [];
    this.historyIndex = -1;
    this.outputLines = [
      "NORTHSTAR KERNEL // SYSTEM 1 NEURAL BUS v4.7.2",
      "ENTER THE MATRIX // DIEGETIC CONSOLE ARMED",
      "Type 'help' for available commands, or 'matrix' for operator link.",
      "------------------------------------------------------------------"
    ];
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.eventBus?.publish('TERMINAL_TOGGLED', { isOpen: this.isOpen });
    return this.isOpen;
  }

  execute(rawCommand) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    this.history.push(trimmed);
    this.historyIndex = this.history.length;
    this.outputLines.push(`> ${trimmed}`);

    this.eventBus?.publish('TERMINAL_KEY', {});

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.outputLines.push(
          "AVAILABLE COMMANDS:",
          "  status               - Print live player telemetry, wave & director status",
          "  ai list              - Enumerate all active System 1 neural agents",
          "  ai inspect <id>      - Dump real-time feature vector & decision logits",
          "  director <peak|respite|set <val>> - Override AI Director tension",
          "  scan <barcode/text>  - Synthesize entity from barcode entropy (SKANNERZ)",
          "  spawn <archetype>    - Spawn: VOID_PROWLER, OBSIDIAN_SENTINEL, PRISM_WRAITH",
          "  matrix               - Access operator message & digital rain",
          "  godmode              - Toggle infinite player health/ammo",
          "  clear                - Clear terminal buffer",
          "  exit                 - Close terminal (or press ` ~)"
        );
        break;

      case 'status': {
        const p = this.gameState.player;
        const d = this.director;
        this.outputLines.push(
          `PLAYER: Health=${p.health}/${p.maxHealth} | Ammo=${p.ammo}/${p.maxAmmo} | Kills=${d.totalKills}`,
          `DIRECTOR: Phase=${d.phase} | Tension=${(d.tension * 100).toFixed(1)}% | Wave=${d.currentWave}`,
          `ACTIVE AGENTS: ${this.gameState.agents.filter(a => a.isAlive).length} alive (${this.gameState.agents.length} total allocated)`
        );
        break;
      }

      case 'ai': {
        const sub = (args[0] || '').toLowerCase();
        if (sub === 'list') {
          const agents = this.gameState.agents.filter(a => a.isAlive);
          if (agents.length === 0) {
            this.outputLines.push("No active AI agents currently deployed.");
          } else {
            agents.forEach(a => {
              this.outputLines.push(
                `  [${a.id}] Type: ${a.archetype} | Stance: ${a.activeDecision.stance} | Conf: ${(a.activeDecision.confidence * 100).toFixed(0)}% | Latency: ${a.activeDecision.inferenceMs}ms`
              );
            });
          }
        } else if (sub === 'inspect') {
          const targetId = (args[1] || '').toUpperCase();
          const agent = this.gameState.agents.find(a => a.id.toUpperCase() === targetId && a.isAlive);
          if (!agent) {
            this.outputLines.push(`ERROR: Agent [${targetId}] not found or inactive.`);
          } else {
            this.outputLines.push(
              `--- TENSOR INSPECT: ${agent.id} (${agent.archetype}) ---`,
              `  Active Stance: ${agent.activeDecision.stance} (Confidence: ${(agent.activeDecision.confidence * 100).toFixed(1)}%)`,
              `  Inference Time: ${agent.activeDecision.inferenceMs} ms (Sub-millisecond System 1)`,
              `  Position: (${Math.round(agent.x)}, ${Math.round(agent.y)}) -> Target: (${Math.round(agent.activeDecision.targetX)}, ${Math.round(agent.activeDecision.targetY)})`,
              `  Health: ${agent.health}/${agent.maxHealth} | Ammo: ${agent.ammo}/${agent.maxAmmo} | Reloading: ${agent.isReloading}`,
              `  Weight Biases: ${JSON.stringify(agent.weightBias)}`
            );
          }
        } else {
          this.outputLines.push("Usage: ai list | ai inspect <id>");
        }
        break;
      }

      case 'director': {
        const action = (args[0] || '').toLowerCase();
        if (action === 'peak') {
          this.director.phase = 'PEAK_CLIMAX';
          this.director.tension = 0.95;
          this.outputLines.push("DIRECTOR OVERRIDE: Forcing Phase -> PEAK_CLIMAX (Tension 95%)");
        } else if (action === 'respite') {
          this.director.enterRespite("TERMINAL_MANUAL_OVERRIDE");
          this.outputLines.push("DIRECTOR OVERRIDE: Forcing Phase -> RESPITE_RECOVERY");
        } else if (action === 'set') {
          const val = parseFloat(args[1]);
          if (!isNaN(val) && val >= 0 && val <= 1) {
            this.director.tension = val;
            this.outputLines.push(`DIRECTOR OVERRIDE: Tension set to ${(val * 100).toFixed(1)}%`);
          } else {
            this.outputLines.push("Usage: director set <0.0 - 1.0>");
          }
        } else {
          this.outputLines.push("Usage: director peak | director respite | director set <0.0-1.0>");
        }
        break;
      }

      case 'scan': {
        const code = args.join(' ');
        if (!code) {
          this.outputLines.push("Usage: scan <barcode_or_text_seed>");
          break;
        }
        const entity = this.barcodeScanner.scanBarcode(code);
        this.outputLines.push(
          `--- SKANNERZ ENTROPY SCAN: "${code}" ---`,
          `  Hash: ${entity.hashHex} | Pulse Strength: ${(entity.pulseStrength * 100).toFixed(0)}%`,
          `  Rarity: [${entity.rarity}] | Archetype: ${entity.archetype}`,
          `  Vitality: ${entity.isFlatline ? "FLATLINE (Defective)" : "STRONG DETECTED HEARTBEAT"}`,
          `  Stats: Speed=${entity.stats.speed} | HP=${entity.stats.maxHealth} | Damage=${entity.stats.damage}`
        );
        break;
      }

      case 'spawn': {
        const type = (args[0] || 'TACTICAL_OPERATOR').toUpperCase();
        const px = this.gameState.player.x + (Math.random() - 0.5) * 400;
        const py = this.gameState.player.y + (Math.random() - 0.5) * 400;
        const id = `FORCED_${Math.floor(Math.random() * 900 + 100)}`;
        const agent = new window.System1NeuralAgent(id, px, py, type, this.eventBus);
        this.gameState.agents.push(agent);
        this.outputLines.push(`SUCCESS: Spawned [${id}] of archetype ${type} at (${Math.round(px)}, ${Math.round(py)})`);
        break;
      }

      case 'matrix':
        this.outputLines.push(
          "==================================================================",
          "NEO: 'I know you're out there. I can feel you now.'",
          "EASTER EGG UNLOCKED: Matrix DOS sub-routine initialized.",
          "System 1 neural weights synchronized across the construct.",
          "=================================================================="
        );
        break;

      case 'godmode':
        this.gameState.player.isGodmode = !this.gameState.player.isGodmode;
        this.outputLines.push(`GODMODE: ${this.gameState.player.isGodmode ? "ENABLED (Infinite HP & Ammo)" : "DISABLED"}`);
        break;

      case 'clear':
        this.outputLines = [];
        break;

      case 'exit':
      case 'quit':
        this.toggle();
        break;

      default:
        this.outputLines.push(`Unknown command: '${cmd}'. Type 'help' for command list.`);
        break;
    }

    // Keep output bounded
    if (this.outputLines.length > 200) {
      this.outputLines = this.outputLines.slice(-100);
    }
  }
}

// Export for ES modules and browser global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiegeticTerminal;
}
if (typeof window !== 'undefined') {
  window.DiegeticTerminal = DiegeticTerminal;
}
