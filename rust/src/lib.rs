pub mod rf_model;

use rf_model::RandomForestRunner;
use std::ffi::{c_char, c_double, c_int, CStr, CString};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

#[cfg(target_os = "android")]
extern "C" {
    fn __android_log_write(prio: c_int, tag: *const c_char, text: *const c_char) -> c_int;
}

fn log_debug(message: &str) {
    #[cfg(target_os = "android")]
    {
        const ANDROID_LOG_DEBUG: c_int = 3;
        const TAG: &[u8] = b"NitroTempoCls\0";
        let safe_message = message.replace('\0', "\\0");
        if let Ok(c_message) = CString::new(safe_message) {
            unsafe {
                let _ = __android_log_write(
                    ANDROID_LOG_DEBUG,
                    TAG.as_ptr() as *const c_char,
                    c_message.as_ptr(),
                );
            }
        }
    }

    #[cfg(not(target_os = "android"))]
    {
        eprintln!("[NitroTempoCls] {message}");
    }
}

const EXERCISE_FALLBACK: usize = 0;

struct TempoState {
    model: Option<RandomForestRunner>,
    exercise_classes: Vec<String>,
    phase: String,
    phase_start: Option<Instant>,
    rep_start: Option<Instant>,
    mid_time: Option<Instant>,
    exercise: Option<String>,
    current_tempo: String,
    current_quality: f64,
}

impl Default for TempoState {
    fn default() -> Self {
        Self {
            model: None,
            exercise_classes: Vec::new(),
            phase: "UNKNOWN".to_string(),
            phase_start: None,
            rep_start: None,
            mid_time: None,
            exercise: None,
            current_tempo: "unknown".to_string(),
            current_quality: 0.0,
        }
    }
}

fn state() -> &'static Mutex<TempoState> {
    static STATE: OnceLock<Mutex<TempoState>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(TempoState::default()))
}

fn cstr_to_string(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        log_debug("cstr_to_string(): input pointer is null");
        return None;
    }
    let cstr = unsafe { CStr::from_ptr(ptr) };
    Some(cstr.to_string_lossy().into_owned())
}

#[no_mangle]
pub extern "C" fn tempo_load_model(model_json: *const c_char) -> c_int {
    log_debug("tempo_load_model(): begin");
    let Some(json) = cstr_to_string(model_json) else {
        log_debug("tempo_load_model(): failed to decode input json");
        return 0;
    };

    // Parse the model JSON, extract exercise_classes if present
    let parsed: serde_json::Value = match serde_json::from_str(&json) {
        Ok(v) => v,
        Err(e) => {
            log_debug(&format!("tempo_load_model(): json parse error: {e}"));
            return 0;
        }
    };

    let model = match RandomForestRunner::from_json(&json) {
        Some(m) => m,
        None => {
            log_debug("tempo_load_model(): RandomForestRunner::from_json failed");
            return 0;
        }
    };

    let exercise_classes: Vec<String> = parsed
        .get("exercise_classes")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    log_debug(&format!(
        "tempo_load_model(): loaded model with {} trees, {} exercise classes",
        model.trees.len(),
        exercise_classes.len()
    ));

    if let Ok(mut guard) = state().lock() {
        guard.model = Some(model);
        guard.exercise_classes = exercise_classes;
        guard.current_tempo = "unknown".to_string();
        guard.current_quality = 0.0;
        log_debug("tempo_load_model(): state updated");
        return 1;
    }

    log_debug("tempo_load_model(): failed to acquire state lock");
    0
}

#[no_mangle]
pub extern "C" fn tempo_set_exercise(exercise: *const c_char) {
    let name = cstr_to_string(exercise).unwrap_or_default();
    log_debug(&format!("tempo_set_exercise(): '{name}'"));

    if let Ok(mut guard) = state().lock() {
        if name.is_empty() {
            guard.exercise = None;
        } else {
            guard.exercise = Some(name);
        }
    }
}

#[no_mangle]
pub extern "C" fn tempo_update(phase: *const c_char, fps: c_double) {
    let phase_str = cstr_to_string(phase).unwrap_or_default();
    let now = Instant::now();

    if let Ok(mut guard) = state().lock() {
        let prev = guard.phase.clone();
        let current_phase = phase_str.clone();
        log_debug(&format!(
            "tempo_update(): phase='{current_phase}' prev='{prev}' fps={fps}"
        ));

        if current_phase != prev {
            if prev == "UNKNOWN" && (current_phase == "UP" || current_phase == "DOWN") {
                guard.rep_start = Some(now);
                guard.phase_start = Some(now);
                guard.mid_time = None;
                log_debug("tempo_update(): rep started");
            } else if (prev == "UP" || prev == "DOWN")
                && (current_phase == "UP" || current_phase == "DOWN")
            {
                guard.mid_time = Some(now);
                guard.phase_start = Some(now);

                if let (Some(rep_start), Some(mid_time)) = (guard.rep_start, guard.mid_time) {
                    let total_dur = now.duration_since(rep_start);
                    let total_s = total_dur.as_secs_f64();
                    log_debug(&format!("tempo_update(): rep completed in {total_s:.3}s"));

                    if total_s > 0.3 && total_s < 15.0 {
                        let half1_s = mid_time.duration_since(rep_start).as_secs_f64();
                        // Clamp half1_s to avoid division issues
                        let half1_s = if half1_s <= 0.0 { 0.05 } else { half1_s };
                        let half2_s = total_s - half1_s;
                        let half2_s = if half2_s <= 0.0 { 0.05 } else { half2_s };
                        let half_ratio = half1_s / half2_s;

                        let ex_enc = if let Some(ref ex) = guard.exercise {
                            guard
                                .exercise_classes
                                .iter()
                                .position(|c| c == ex)
                                .unwrap_or(EXERCISE_FALLBACK)
                        } else {
                            EXERCISE_FALLBACK
                        };

                        let features = vec![vec![
                            total_s as f32,
                            half1_s as f32,
                            half2_s as f32,
                            half_ratio as f32,
                            ex_enc as f32,
                        ]];

                        if let Some(ref model) = guard.model {
                            if let Some(probs) = model.predict_probabilities(&features) {
                                if let Some(row) = probs.first() {
                                    let mut best_idx = 0usize;
                                    let mut best_val = f32::NEG_INFINITY;
                                    for (i, &v) in row.iter().enumerate() {
                                        if v > best_val {
                                            best_val = v;
                                            best_idx = i;
                                        }
                                    }

                                    let tempo_label = match best_idx {
                                        0 => "fast",
                                        1 => "normal",
                                        2 => "slow",
                                        _ => "unknown",
                                    };
                                    guard.current_tempo = tempo_label.to_string();
                                    guard.current_quality = (best_val * 100.0).round() as f64;

                                    log_debug(&format!(
                                        "tempo_update(): predicted tempo='{tempo_label}' quality={:.0}",
                                        guard.current_quality
                                    ));
                                }
                            }
                        }
                    } else {
                        log_debug(&format!(
                            "tempo_update(): rep duration {total_s:.3}s out of range, skipping"
                        ));
                    }
                }

                guard.rep_start = Some(now);
            }
        }

        guard.phase = current_phase;
    }
}

#[no_mangle]
pub extern "C" fn tempo_get_tempo() -> *mut c_char {
    if let Ok(guard) = state().lock() {
        let tempo = guard.current_tempo.clone();
        if let Ok(c) = CString::new(tempo) {
            return c.into_raw();
        }
    }
    std::ptr::null_mut()
}

#[no_mangle]
pub extern "C" fn tempo_get_quality() -> c_double {
    if let Ok(guard) = state().lock() {
        return guard.current_quality;
    }
    0.0
}

#[no_mangle]
pub extern "C" fn tempo_reset() {
    log_debug("tempo_reset(): begin");
    if let Ok(mut guard) = state().lock() {
        guard.phase = "UNKNOWN".to_string();
        guard.phase_start = None;
        guard.rep_start = None;
        guard.mid_time = None;
        guard.current_tempo = "unknown".to_string();
        guard.current_quality = 0.0;
        log_debug("tempo_reset(): state cleared");
    }
}

#[no_mangle]
pub extern "C" fn tempo_string_free(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    unsafe {
        let _ = CString::from_raw(s);
    }
}
