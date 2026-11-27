; ============================================================================
; NORTHSTAR HALO 3 SCENARIO SCRIPT: nsp_digon_sanctum_arena.hsc
; Target Scenario: levels\test\nsp_digon_sanctum\nsp_digon_sanctum
; Standalone compiled H3EK mod scenario with Vorath Oracle Eye phase pacing
; ============================================================================

(global boolean g_digon_sanctum_active TRUE)
(global short g_overload_tier 0)
(global long g_sanctum_pulse_ticks 180)
(global real g_overload_damage_scale 1.0)

(script static void nsp_advance_overload_tier
	(set g_overload_tier (+ g_overload_tier 1))
	(if (> g_overload_tier 5)
		(set g_overload_tier 1)
	)
	(print "DIGON SANCTUM: Escalating Forerunner arena resonance tier.")
)

(script dormant nsp_oracle_eye_awakening
	(sleep 90)
	(print "VORATH ORACLE EYE: Hardlight sanctum aperture stabilized.")
	(game_save)
)

(script startup nsp_digon_sanctum_init
	(print "NORTHSTAR H3EK MOD ONLINE // NSP_DIGON_SANCTUM")
	(nsp_advance_overload_tier)
	(wake nsp_oracle_eye_awakening)
)

(script continuous nsp_digon_sanctum_loop
	(sleep g_sanctum_pulse_ticks)
	(if g_digon_sanctum_active
		(begin
			(nsp_advance_overload_tier)
		)
	)
)
