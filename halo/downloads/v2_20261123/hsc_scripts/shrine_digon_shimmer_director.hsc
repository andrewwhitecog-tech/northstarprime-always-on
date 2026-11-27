; ============================================================================
; NORTHSTAR HALO 3 SCENARIO SCRIPT: shrine_digon_shimmer_director.hsc
; Target Scenario: levels\multi\shrine\shrine (Sandtrap / Forerunner Shrine)
; Grounded in authentic H3EK shrine_main.hsc defense turrets + copper.shader
; verified 300-second (9000-tick @ 30Hz) dual-cloud shimmer harmonic cycle:
;   lcm(15s, 20s, 25s) = 300s (clouds_a Tx=15 Ty=20, clouds_b Tx=15 Ty=25)
; ============================================================================

(global boolean g_nsp_digon_director_online TRUE)
(global short g_nsp_shimmer_harmonic_phase 0)
(global long g_nsp_cycle_ticks 900)
(global real g_nsp_shimmer_period_sec 300.0)

(script static void nsp_init_sandtrap_perimeter_turrets
	(vehicle_auto_turret turret_north0 tv_turret_north0 185.0 195.0 10.0)
	(vehicle_auto_turret turret_north1 tv_turret_north1 195.0 205.0 10.0)
	(vehicle_auto_turret turret_side0 tv_turret_side0 185.0 190.0 10.0)
	(vehicle_auto_turret turret_side1 tv_turret_side1 182.5 190.0 10.0)
	(vehicle_auto_turret turret_south0 tv_turret_south0 189.0 195.0 10.0)
	(vehicle_auto_turret turret_south1 tv_turret_south1 190.0 200.0 10.0)
)

(script static void nsp_log_shimmer_phase
	(set g_nsp_shimmer_harmonic_phase (+ g_nsp_shimmer_harmonic_phase 1))
	(if (> g_nsp_shimmer_harmonic_phase 10)
		(set g_nsp_shimmer_harmonic_phase 1)
	)
	(print "NORTHSTAR SHRINE DIRECTOR: copper.shader 300s dual-cloud phase tick.")
)

(script dormant nsp_epitaph_resonance_alert
	(sleep 150)
	(print "NORTHSTAR TELEMETRY: Epitaph salvation weathering link confirmed.")
	(game_save)
)

(script startup shrine_digon_shimmer_director
	(print "NORTHSTAR H3EK: Sandtrap Digon Shimmer Director initialized.")
	(nsp_init_sandtrap_perimeter_turrets)
	(nsp_log_shimmer_phase)
	(wake nsp_epitaph_resonance_alert)
)

(script continuous shrine_digon_harmonic_heartbeat
	(sleep g_nsp_cycle_ticks)
	(if g_nsp_digon_director_online
		(begin
			(nsp_log_shimmer_phase)
		)
	)
)
